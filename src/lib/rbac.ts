'use server';

/**
 * RBAC (Role-Based Access Control) Helpers
 * 
 * This module provides functions to check granular permissions for users.
 * It replaces hardcoded role checks (e.g., `role === 'admin'`) with dynamic
 * permission checks (e.g., `hasPermission('project.create')`).
 */

import { supabaseAdmin } from '@/lib/supabase-server';
import { PERMISSION_NODES, PermissionNode } from './rbac-constants';

export type { PermissionNode };

interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
}

// Bidirectional singular <-> plural alias map for permission prefixes
const ALIAS_PREFIX_MAP: Record<string, string> = {
    project: 'projects',
    projects: 'project',
    design: 'designs',
    designs: 'design',
    order: 'orders',
    orders: 'order',
    invoice: 'invoices',
    invoices: 'invoice',
    payment: 'payments',
    payments: 'payment',
    supplier: 'suppliers',
    suppliers: 'supplier',
    worker: 'workers',
    workers: 'worker',
    vendor: 'vendors',
    vendors: 'vendor',
    task: 'tasks',
    tasks: 'task',
    user: 'users',
    users: 'user',
    update: 'updates',
    updates: 'update',
    snag: 'snags',
    snags: 'snag',
    holiday: 'holidays',
    holidays: 'holiday',
    leave: 'leaves',
    leaves: 'leave',
    popup: 'popups',
    popups: 'popup'
};

function getCodeVariants(code: string): string[] {
    const variants = [code];
    const dotIndex = code.indexOf('.');
    if (dotIndex > 0) {
        const prefix = code.slice(0, dotIndex);
        const rest = code.slice(dotIndex + 1);
        const alternatePrefix = ALIAS_PREFIX_MAP[prefix];
        if (alternatePrefix) {
            variants.push(`${alternatePrefix}.${rest}`);
        }
    }
    return variants;
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
            .select('role, role_id, roles(name)')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return { allowed: false, reason: 'User not found' };
        }

        // 2. Admin bypass - admins have all permissions
        const isAdmin = 
            userData.role?.toLowerCase() === 'admin' || 
            (userData.roles as any)?.name?.toLowerCase() === 'admin';

        if (isAdmin) {
            return { allowed: true };
        }

        const variants = getCodeVariants(permissionNode);

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

                if (permCode === '*') return true;

                // Check direct and alias match
                for (const variant of variants) {
                    if (permCode === variant) return true;

                    // Wildcard match (e.g., 'projects.*' matches 'projects.create')
                    if (permCode.endsWith('.*')) {
                        const prefix = permCode.slice(0, -2);
                        if (variant.startsWith(prefix + '.')) return true;
                    }
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
