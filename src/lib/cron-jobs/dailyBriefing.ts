import { supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';
import { fetchUsersWithRoles, isAdminOrHR, fetchDesignerDesignStatusMap } from '@/lib/cron-jobs/cronUtils';

export async function runDailyBriefing() {
    console.log('🌅 Starting Daily Briefing Logic');

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Fetch tasks due TODAY or OVERDUE (status=todo/in_progress)
    const { data: allTasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('id, title, assigned_to, end_at, estimated_completion_date, status')
        .neq('status', 'done')
        .neq('status', 'cancelled')
        .or(`end_at.lte.${todayStr}T23:59:59,estimated_completion_date.lte.${todayStr}`);

    if (tasksError) throw tasksError;

    // 2. Fetch open/assigned/resolved snags for briefing
    const { data: openSnags, error: snagsQueryError } = await supabaseAdmin
        .from('snags')
        .select('id, assigned_to_user_id, created_by, status')
        .in('status', ['open', 'assigned', 'resolved']);

    if (snagsQueryError) {
        console.error('❌ Error fetching snags in daily briefing:', snagsQueryError);
    }

    const totalOpen = (openSnags || []).filter((s: any) => s.status === 'open').length;
    const totalAssigned = (openSnags || []).filter((s: any) => s.status === 'assigned').length;
    const totalResolved = (openSnags || []).filter((s: any) => s.status === 'resolved').length;
    console.log(`[DailyBriefing] Snag counts: Open: ${totalOpen}, Assigned: ${totalAssigned}, Resolved: ${totalResolved}`);

    // Build a map: userId -> { assignedSnags, openSnags }
    const snagStats: Record<string, { assigned: number; open: number }> = {};

    (openSnags || []).forEach((snag: any) => {
        if (snag.status === 'open' || snag.status === 'assigned') {
            // Count snags assigned to this user
            if (snag.assigned_to_user_id) {
                if (!snagStats[snag.assigned_to_user_id]) snagStats[snag.assigned_to_user_id] = { assigned: 0, open: 0 };
                snagStats[snag.assigned_to_user_id].assigned++;
            }
            // Count open (unassigned) snags for the creator
            if (!snag.assigned_to_user_id && snag.created_by) {
                if (!snagStats[snag.created_by]) snagStats[snag.created_by] = { assigned: 0, open: 0 };
                snagStats[snag.created_by].open++;
            }
        }
    });

    // 3. Group tasks by User
    const userStats: Record<string, { today: number; overdue: number }> = {};

    const processTask = (userId: string, dueDate: string | Date) => {
        if (!userStats[userId]) userStats[userId] = { today: 0, overdue: 0 };

        const taskDate = new Date(dueDate).toISOString().split('T')[0];
        if (taskDate === todayStr) {
            userStats[userId].today++;
        } else if (taskDate < todayStr) {
            userStats[userId].overdue++;
        }
    };

    allTasks?.forEach((t: any) => {
        const dueDate = t.estimated_completion_date || (t.end_at ? new Date(t.end_at).toISOString().split('T')[0] : todayStr);
        if (t.assigned_to) {
            if (Array.isArray(t.assigned_to)) {
                t.assigned_to.forEach((uid: string) => processTask(uid, dueDate));
            } else {
                processTask(t.assigned_to, dueDate);
            }
        }
    });

    // 4. Fetch Designer active design tasks & status
    const designerDesignMap = await fetchDesignerDesignStatusMap();
    const totalDesignProjects = Object.values(designerDesignMap).reduce((s, d) => s + d.projectCount, 0);
    const totalActiveDesignTasks = Object.values(designerDesignMap).reduce((s, d) => s + d.activeTasksCount, 0);
    const totalOverdueDesignTasks = Object.values(designerDesignMap).reduce((s, d) => s + d.overdueTasksCount, 0);

    // 4b. Fetch pending site delivery items (ordered or partially delivered)
    const { data: pendingDeliveries } = await supabaseAdmin
        .from('boq_items')
        .select(`
            id,
            item_name,
            quantity,
            unit,
            bill_number,
            order_status,
            project_id,
            projects!inner(id, title, site_supervisor_id, assigned_employee_id)
        `)
        .in('order_status', ['ordered', 'partial']);

    // Group pending deliveries by Site Engineer / Supervisor
    const engineerDeliveryMap: Record<string, Array<{ projectId: string; projectTitle: string; billNumber: string; itemCount: number }>> = {};
    const projectDeliveryMap = new Map<string, { projectId: string; projectTitle: string; billNumber: string; itemCount: number; supervisors: Set<string> }>();

    (pendingDeliveries || []).forEach((item: any) => {
        const proj = item.projects;
        if (!proj) return;
        const billKey = `${item.project_id}_${item.bill_number || 'Bill #1'}`;
        if (!projectDeliveryMap.has(billKey)) {
            const supSet = new Set<string>();
            if (proj.site_supervisor_id) supSet.add(proj.site_supervisor_id);
            if (proj.assigned_employee_id) supSet.add(proj.assigned_employee_id);
            projectDeliveryMap.set(billKey, {
                projectId: proj.id,
                projectTitle: proj.title,
                billNumber: item.bill_number || 'Delivery Bill',
                itemCount: 0,
                supervisors: supSet
            });
        }
        projectDeliveryMap.get(billKey)!.itemCount++;
    });

    projectDeliveryMap.forEach((entry) => {
        entry.supervisors.forEach(supId => {
            if (!engineerDeliveryMap[supId]) engineerDeliveryMap[supId] = [];
            engineerDeliveryMap[supId].push({
                projectId: entry.projectId,
                projectTitle: entry.projectTitle,
                billNumber: entry.billNumber,
                itemCount: entry.itemCount
            });
        });
    });

    const totalPendingDeliveriesAcrossProjects = projectDeliveryMap.size;

    // 5. Send Briefings to ALL active users (with roles joined)
    const allUsers = await fetchUsersWithRoles();

    const updates = [];
    for (const user of (allUsers || [])) {
        const stats = userStats[user.id] || { today: 0, overdue: 0 };
        const snags = snagStats[user.id] || { assigned: 0, open: 0 };
        const isAdmin = isAdminOrHR(user);
        const designData = designerDesignMap[user.id];
        const pendingDeliveriesForUser = engineerDeliveryMap[user.id] || [];

        // Build compact summary items (only include lines with non-zero activity)
        const summaryItems: string[] = [];

        // 1. Task Summary
        if (stats.today > 0 || stats.overdue > 0) {
            const taskParts = [];
            if (stats.today > 0) taskParts.push(`${stats.today} due today`);
            if (stats.overdue > 0) taskParts.push(`${stats.overdue} overdue`);
            summaryItems.push(`• Tasks: ${taskParts.join(', ')}`);
        }

        // 2. Snags Summary
        if (isAdmin) {
            const totalPendingSnags = totalOpen + totalAssigned;
            if (totalPendingSnags > 0) {
                summaryItems.push(`• Snags: ${totalPendingSnags} pending${totalOpen > 0 ? ` (${totalOpen} unassigned)` : ''}`);
            }
        } else {
            const userSnags = snags.assigned + snags.open;
            if (userSnags > 0) {
                summaryItems.push(`• Snags: ${userSnags} pending`);
            }
        }

        // 3. Design Tasks Summary
        if (designData && designData.activeTasksCount > 0) {
            const overdue = designData.overdueTasksCount > 0 ? ` (${designData.overdueTasksCount} overdue)` : '';
            summaryItems.push(`• Design: ${designData.activeTasksCount} active task${designData.activeTasksCount > 1 ? 's' : ''}${overdue}`);
        } else if (isAdmin && totalActiveDesignTasks > 0) {
            const overdue = totalOverdueDesignTasks > 0 ? ` (${totalOverdueDesignTasks} overdue)` : '';
            summaryItems.push(`• Design: ${totalActiveDesignTasks} active across ${totalDesignProjects} projects${overdue}`);
        }

        // 4. Site Deliveries Summary
        if (pendingDeliveriesForUser.length > 0) {
            summaryItems.push(`• Deliveries: ${pendingDeliveriesForUser.length} order${pendingDeliveriesForUser.length > 1 ? 's' : ''} awaiting verification`);
        } else if (isAdmin && totalPendingDeliveriesAcrossProjects > 0) {
            summaryItems.push(`• Deliveries: ${totalPendingDeliveriesAcrossProjects} order${totalPendingDeliveriesAcrossProjects > 1 ? 's' : ''} awaiting verification`);
        }

        const body = summaryItems.length > 0
            ? `Today's Overview:\n${summaryItems.join('\n')}`
            : `All caught up! No pending tasks today.`;

        const message = `Good morning, ${user.full_name}! ☀️\n\n${body}\n\nHave a great day ahead!`;

        console.log(`[DailyBriefing] Constructing message for ${user.full_name} (${summaryItems.length} items)`);

        console.log(`Sending briefing to ${user.full_name}`);
        updates.push(
            NotificationService.createNotification({
                userId: user.id,
                title: 'Daily Briefing',
                message,
                type: 'general',
                relatedId: user.id,
                relatedType: 'daily_briefing',
                skipInApp: true
            })
        );

        // Send individual in-app & push delivery verification reminders to Site Engineers
        for (const pd of pendingDeliveriesForUser) {
            updates.push(
                NotificationService.createNotification({
                    userId: user.id,
                    title: `Delivery Reminder: ${pd.projectTitle}`,
                    message: `${pd.billNumber} (${pd.itemCount} items) is awaiting delivery confirmation on site. Please verify and upload challan.`,
                    type: 'material_ordered',
                    relatedId: pd.projectId,
                    relatedType: 'project',
                    metadata: {
                        project_id: pd.projectId,
                        bill_number: pd.billNumber
                    }
                })
            );
        }
    }


    await Promise.allSettled(updates);

    return {
        success: true,
        message: `Sent ${updates.length} daily briefings`,
        stats: userStats,
        snagStats
    };
}
