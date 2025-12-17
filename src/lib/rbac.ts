/**
 * RBAC (Role-Based Access Control) Helpers
 * 
 * This module provides functions to check granular permissions for users.
 * It replaces hardcoded role checks (e.g., `role === 'admin'`) with dynamic
 * permission checks (e.g., `hasPermission('project.create')`).
 */

import { supabaseAdmin } from '@/lib/supabase-server';

// Define all permission nodes in the system
export const PERMISSION_NODES = {
    // Project Permissions
    PROJECT_CREATE: 'project.create',
    PROJECT_EDIT: 'project.edit',
    PROJECT_DELETE: 'project.delete',
    PROJECT_VIEW_BUDGET: 'project.view_budget',

    // Design Permissions
    DESIGN_UPLOAD: 'design.upload',
    DESIGN_APPROVE: 'design.approve',
    DESIGN_FREEZE: 'design.freeze',

    // BOQ Permissions
    BOQ_CREATE: 'boq.create',
    BOQ_EDIT: 'boq.edit',
    BOQ_APPROVE: 'boq.approve',
    BOQ_IMPORT: 'boq.import',

    // Proposal Permissions
    PROPOSAL_CREATE: 'proposal.create',
    PROPOSAL_SEND: 'proposal.send',
    PROPOSAL_APPROVE: 'proposal.approve',

    // Order & Payment Permissions
    ORDER_CREATE: 'order.create',
    ORDER_APPROVE: 'order.approve',
    PAYMENT_CREATE: 'payment.create',
    PAYMENT_APPROVE: 'payment.approve',

    // Snag Permissions
    SNAG_CREATE: 'snag.create',
    SNAG_RESOLVE: 'snag.resolve',
    SNAG_VERIFY: 'snag.verify',

    // Inventory Permissions
    INVENTORY_ADD: 'inventory.add',
    INVENTORY_REMOVE: 'inventory.remove',

    // Site Visit Permissions
    SITE_VISIT_CREATE: 'site_visit.create',
    SITE_VISIT_APPROVE: 'site_visit.approve',

    // User Management
    USER_CREATE: 'user.create',
    USER_EDIT: 'user.edit',
    USER_DELETE: 'user.delete',
    ROLE_MANAGE: 'role.manage',
} as const;

export type PermissionNode = typeof PERMISSION_NODES[keyof typeof PERMISSION_NODES];

interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
}

/**
 * Check if a user has a specific permission.
 * 
 * @param userId - The user's UUID
 * @param permissionNode - The permission to check (e.g., 'project.create')
 * @param projectId - Optional project ID for project-specific permissions
 * @returns Promise<PermissionCheckResult>
 */
export async function checkPermission(
    userId: string,
    permissionNode: PermissionNode,
    projectId?: string
): Promise<PermissionCheckResult> {
    try {
        // 1. Get user's role
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role, role_id')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return { allowed: false, reason: 'User not found' };
        }

        // 2. Admin bypass - admins have all permissions
        if (userData.role === 'admin') {
            return { allowed: true };
        }

        // 3. Check role-based permissions
        if (userData.role_id) {
            const { data: rolePermissions, error: permError } = await supabaseAdmin
                .from('role_permissions')
                .select(`
                    permissions (
                        code
                    )
                `)
                .eq('role_id', userData.role_id);

            if (permError) {
                console.error('Error fetching role permissions:', permError);
                return { allowed: false, reason: 'Permission check failed' };
            }

            // Check if any of the user's permissions match the required permission
            const hasPermission = rolePermissions?.some((rp: any) => {
                const permCode = rp.permissions?.code;
                if (!permCode) return false;

                // Direct match
                if (permCode === permissionNode) return true;

                // Wildcard match (e.g., 'project.*' matches 'project.create')
                if (permCode.endsWith('.*')) {
                    const prefix = permCode.slice(0, -2);
                    return permissionNode.startsWith(prefix + '.');
                }

                return false;
            });

            if (hasPermission) {
                return { allowed: true };
            }
        }

        // 4. Check project-level permissions (if projectId is provided)
        if (projectId) {
            const { data: projectMember, error: memberError } = await supabaseAdmin
                .from('project_members')
                .select('permissions')
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .single();

            if (!memberError && projectMember?.permissions) {
                const projectPerms = projectMember.permissions as string[];
                if (projectPerms.includes(permissionNode) || projectPerms.includes('*')) {
                    return { allowed: true };
                }
            }
        }

        return { allowed: false, reason: 'Permission denied' };
    } catch (error) {
        console.error('Permission check error:', error);
        return { allowed: false, reason: 'Permission check failed' };
    }
}

/**
 * Verify permission and throw/return 403 if not allowed.
 * Use this in API routes for cleaner code.
 */
export async function verifyPermission(
    userId: string,
    permissionNode: PermissionNode,
    projectId?: string
): Promise<{ allowed: true } | { allowed: false; status: 403; message: string }> {
    const result = await checkPermission(userId, permissionNode, projectId);

    if (!result.allowed) {
        return {
            allowed: false,
            status: 403,
            message: `Permission denied: ${permissionNode} is required`
        };
    }

    return { allowed: true };
}

/**
 * Check if user has ANY of the specified permissions.
 * Useful for OR conditions (e.g., can approve OR is owner).
 */
export async function hasAnyPermission(
    userId: string,
    permissionNodes: PermissionNode[],
    projectId?: string
): Promise<boolean> {
    for (const node of permissionNodes) {
        const result = await checkPermission(userId, node, projectId);
        if (result.allowed) return true;
    }
    return false;
}

/**
 * Check if user has ALL of the specified permissions.
 * Useful for AND conditions.
 */
export async function hasAllPermissions(
    userId: string,
    permissionNodes: PermissionNode[],
    projectId?: string
): Promise<boolean> {
    for (const node of permissionNodes) {
        const result = await checkPermission(userId, node, projectId);
        if (!result.allowed) return false;
    }
    return true;
}
