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

export interface DesignerStatusItem {
    projectCode: string;
    projectTitle: string;
    taskTitle: string;
    status: string;
    deadline?: string | null;
    isOverdue: boolean;
}

export interface DesignerStatusSummary {
    projectCount: number;
    activeTasksCount: number;
    overdueTasksCount: number;
    items: DesignerStatusItem[];
}

/**
 * Gathers active design projects and tasks grouped by designer (assigned_employee_id / designer_id).
 * Uses parseProjectTasks from project_notes to reflect the exact state on the Daily Status board.
 */
export async function fetchDesignerDesignStatusMap(): Promise<Record<string, DesignerStatusSummary>> {
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: projects, error } = await supabaseAdmin
        .from('projects')
        .select('id, title, status, workflow_stage, unified_status, project_notes, assigned_employee_id, designer_id, deadline')
        .not('status', 'eq', 'completed')
        .not('workflow_stage', 'eq', 'completed');

    if (error || !projects) return {};

    const { attachProjectCodes } = await import('@/lib/projectUtils');
    const { parseProjectTasks } = await import('@/lib/designTaskUtils');

    const codedProjects = await attachProjectCodes(projects);
    const map: Record<string, DesignerStatusSummary> = {};

    for (const p of codedProjects) {
        const designerIds = new Set<string>();
        if (p.assigned_employee_id) designerIds.add(p.assigned_employee_id);
        if (p.designer_id) designerIds.add(p.designer_id);
        if (designerIds.size === 0) continue;

        const rawCode = p.project_code || p.ref_no || `AI-${p.id.slice(0, 4)}`;
        const projectCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
        const cleanTitle = (p.title || 'Project').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

        const tasksData = parseProjectTasks(p.project_notes, p);
        const activeTasks = (tasksData.tasks || []).filter((t: any) => (t.status || '').toLowerCase() !== 'done');

        for (const designerId of designerIds) {
            if (!map[designerId]) {
                map[designerId] = {
                    projectCount: 0,
                    activeTasksCount: 0,
                    overdueTasksCount: 0,
                    items: [],
                };
            }

            map[designerId].projectCount++;

            if (activeTasks.length > 0) {
                for (const t of activeTasks) {
                    map[designerId].activeTasksCount++;
                    const isOverdue = Boolean(t.deadline && t.deadline < todayStr);
                    if (isOverdue) map[designerId].overdueTasksCount++;

                    map[designerId].items.push({
                        projectCode,
                        projectTitle: cleanTitle,
                        taskTitle: t.title || 'Design Task',
                        status: t.status || 'In Progress',
                        deadline: t.deadline || null,
                        isOverdue,
                    });
                }
            } else {
                const projStatus = p.unified_status || p.status || 'In Progress';
                if (projStatus.toLowerCase() !== 'done') {
                    const isOverdue = Boolean(p.deadline && p.deadline < todayStr);
                    if (isOverdue) map[designerId].overdueTasksCount++;

                    map[designerId].items.push({
                        projectCode,
                        projectTitle: cleanTitle,
                        taskTitle: projStatus,
                        status: projStatus,
                        deadline: p.deadline || null,
                        isOverdue,
                    });
                }
            }
        }
    }

    return map;
}
