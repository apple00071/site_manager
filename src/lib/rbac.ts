/**
 * RBAC (Role-Based Access Control) Helpers
 * 
 * This module provides functions to check granular permissions for users.
 * It replaces hardcoded role checks (e.g., `role === 'admin'`) with dynamic
 * permission checks (e.g., `hasPermission('project.create')`).
 */

import { supabaseAdmin } from '@/lib/supabase-server';

// Define all permission nodes in the system
// Uses plural module names to match database structure (projects.*, designs.*, etc.)
export const PERMISSION_NODES = {
    // Project Permissions
    PROJECTS_VIEW: 'projects.view',
    PROJECTS_CREATE: 'projects.create',
    PROJECTS_EDIT: 'projects.edit',
    PROJECTS_DELETE: 'projects.delete',
    PROJECTS_ASSIGN: 'projects.assign',
    PROJECTS_VIEW_BUDGET: 'projects.view_budget',

    // Design Permissions
    DESIGNS_VIEW: 'designs.view',
    DESIGNS_UPLOAD: 'designs.upload',
    DESIGNS_DELETE: 'designs.delete',
    DESIGNS_APPROVE: 'designs.approve',
    DESIGNS_FREEZE: 'designs.freeze',
    DESIGNS_COMMENT: 'designs.comment',

    // BOQ Permissions
    BOQ_VIEW: 'boq.view',
    BOQ_CREATE: 'boq.create',
    BOQ_EDIT: 'boq.edit',
    BOQ_DELETE: 'boq.delete',
    BOQ_IMPORT: 'boq.import',

    // Proposal Permissions
    PROPOSALS_VIEW: 'proposals.view',
    PROPOSALS_CREATE: 'proposals.create',
    PROPOSALS_SEND: 'proposals.send',
    PROPOSALS_APPROVE: 'proposals.approve',
    PROPOSALS_REJECT: 'proposals.reject',
    PROPOSALS_DELETE: 'proposals.delete',

    // Order Permissions (Purchase Orders)
    ORDERS_VIEW: 'orders.view',
    ORDERS_CREATE: 'orders.create',
    ORDERS_EDIT: 'orders.edit',
    ORDERS_DELETE: 'orders.delete',

    // Invoice Permissions
    INVOICES_VIEW: 'invoices.view',
    INVOICES_CREATE: 'invoices.create',
    INVOICES_EDIT: 'invoices.edit',
    INVOICES_APPROVE: 'invoices.approve',
    INVOICES_DELETE: 'invoices.delete',

    // Payment Permissions
    PAYMENTS_VIEW: 'payments.view',
    PAYMENTS_CREATE: 'payments.create',
    PAYMENTS_EDIT: 'payments.edit',
    PAYMENTS_DELETE: 'payments.delete',

    // Supplier Permissions
    SUPPLIERS_VIEW: 'suppliers.view',
    SUPPLIERS_CREATE: 'suppliers.create',

    // Inventory Permissions
    INVENTORY_VIEW: 'inventory.view',
    INVENTORY_ADD: 'inventory.add',
    INVENTORY_APPROVE: 'inventory.approve',
    INVENTORY_APPROVE_BILL: 'inventory.approve_bill',
    INVENTORY_REJECT_BILL: 'inventory.reject_bill',
    INVENTORY_RESUBMIT_BILL: 'inventory.resubmit_bill',

    // Update Permissions (Work Progress)
    UPDATES_VIEW: 'updates.view',
    UPDATES_CREATE: 'updates.create',

    // Site Logs Permissions
    SITE_LOGS_VIEW: 'site_logs.view',
    SITE_LOGS_CREATE: 'site_logs.create',
    SITE_LOGS_EDIT: 'site_logs.edit',
    SITE_LOGS_DELETE: 'site_logs.delete',

    // Snag Permissions
    SNAGS_VIEW: 'snags.view',
    SNAGS_CREATE: 'snags.create',
    SNAGS_RESOLVE: 'snags.resolve',
    SNAGS_VERIFY: 'snags.verify',

    // Finance Permissions
    FINANCE_VIEW: 'finance.view',

    // User Management
    USERS_VIEW: 'users.view',
    USERS_CREATE: 'users.create',
    USERS_EDIT: 'users.edit',
    USERS_DELETE: 'users.delete',
    USERS_MANAGE_ROLES: 'users.manage_roles',

    // Settings Permissions
    SETTINGS_VIEW: 'settings.view',
    SETTINGS_EDIT: 'settings.edit',
    SETTINGS_WORKFLOWS: 'settings.workflows',

    // Task Permissions
    TASKS_VIEW: 'tasks.view',
    TASKS_CREATE: 'tasks.create',
    TASKS_EDIT: 'tasks.edit',
    TASKS_BULK: 'tasks.bulk',

    // Office Expenses Permissions
    OFFICE_EXPENSES_VIEW: 'office_expenses.view',
    OFFICE_EXPENSES_CREATE: 'office_expenses.create',
    OFFICE_EXPENSES_APPROVE: 'office_expenses.approve',
    OFFICE_EXPENSES_DELETE: 'office_expenses.delete',

    // Attendance & Leave Permissions
    ATTENDANCE_VIEW: 'attendance.view',
    ATTENDANCE_LOG: 'attendance.log',
    LEAVES_VIEW: 'leaves.view',
    LEAVES_APPLY: 'leaves.apply',
    LEAVES_APPROVE: 'leaves.approve',

    // Payroll Permissions
    PAYROLL_VIEW: 'payroll.view',
    PAYROLL_MANAGE: 'payroll.manage',
    PAYROLL_CONFIG: 'payroll.config',
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
