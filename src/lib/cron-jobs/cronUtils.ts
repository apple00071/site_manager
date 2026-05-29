import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

/**
 * Fetches all active users with their role name from the roles table.
 * This is the single source of truth for determining who is Admin/HR.
 *
 * Role logic:
 *   - users.role === 'admin'       → system admin (always management-level)
 *   - users.roles.name includes 'hr' OR 'admin' → management-level via RBAC role
 *   - Everyone else                → regular member/employee
 */
export async function fetchUsersWithRoles(): Promise<any[]> {
    const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, full_name, role, designation, roles(id, name)')
        .eq('is_active', true);

    if (error) throw error;
    return users || [];
}

/**
 * Determines if a user is management-level (Admin or HR).
 * Uses the RBAC roles table name as the source of truth.
 *
 * Matches:
 *   - users.role === 'admin'              (system-level admin)
 *   - roles.name includes 'admin'         (e.g. "Admin HR")
 *   - roles.name includes 'hr'            (e.g. "HR", "Admin HR")
 */
export function isAdminOrHR(user: {
    role: string;
    designation?: string | null;
    roles?: { name: string } | null;
}): boolean {
    // 1. System-level admin (legacy role field)
    if (user.role === 'admin') return true;

    // 2. Designation check (case-insensitive)
    const des = user.designation?.toLowerCase() || '';
    if (des.includes('admin') || des.includes('hr')) return true;

    // 3. RBAC role name check (roles table)
    const roleName = user.roles?.name?.toLowerCase() || '';
    if (roleName.includes('admin') || roleName.includes('hr')) return true;

    return false;
}
