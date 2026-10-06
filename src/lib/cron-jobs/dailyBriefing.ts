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

        // Build snag section only if there's something to report
        let snagSection = '';
        if (isAdmin) {
            if (totalOpen + totalAssigned + totalResolved > 0) {
                snagSection = `\n\n🔧 Snag Summary:\n- Open (Unassigned): ${totalOpen}\n- Assigned (In Progress): ${totalAssigned}\n- Resolved (Pending Verification): ${totalResolved}`;
            }
        } else {
            const parts = [];
            if (snags.assigned > 0) parts.push(`- Assigned to You: ${snags.assigned}`);
            if (snags.open > 0) parts.push(`- Open (Unassigned): ${snags.open}`);
            if (parts.length > 0) {
                snagSection = `\n\n🔧 Snag Summary:\n${parts.join('\n')}`;
            }
        }

        // Build design status section for designers
        let designSection = '';
        if (designData && designData.items.length > 0) {
            const lines = designData.items.slice(0, 5).map(item => {
                const dueStr = item.deadline ? ` (Due: ${item.deadline})` : '';
                const overdueTag = item.isOverdue ? ' ⚠️ OVERDUE' : '';
                return `• [${item.projectCode}] ${item.taskTitle}: ${item.status}${dueStr}${overdueTag}`;
            });
            const extra = designData.items.length > 5 ? `\n...and ${designData.items.length - 5} more design task(s)` : '';
            designSection = `\n\n🎨 Design Tasks (${designData.projectCount} Project${designData.projectCount > 1 ? 's' : ''}, ${designData.activeTasksCount} Active${designData.overdueTasksCount > 0 ? `, ⚠️ ${designData.overdueTasksCount} Overdue` : ''}):\n${lines.join('\n')}${extra}`;
        } else if (isAdmin && totalActiveDesignTasks > 0) {
            designSection = `\n\n🎨 Design Pipeline:\n- Active Projects: ${totalDesignProjects}\n- Active Tasks: ${totalActiveDesignTasks}${totalOverdueDesignTasks > 0 ? ` (⚠️ ${totalOverdueDesignTasks} Overdue)` : ''}`;
        }

        // Build pending site deliveries section for site engineers & admins
        let deliverySection = '';
        if (pendingDeliveriesForUser.length > 0) {
            const dLines = pendingDeliveriesForUser.slice(0, 3).map(d => `• [${d.projectTitle}] ${d.billNumber} (${d.itemCount} items)`);
            const extra = pendingDeliveriesForUser.length > 3 ? `\n...and ${pendingDeliveriesForUser.length - 3} more` : '';
            deliverySection = `\n\n📦 Pending Site Deliveries (${pendingDeliveriesForUser.length} awaiting verification):\n${dLines.join('\n')}${extra}\nPlease inspect on site & upload delivery challan copy.`;
        } else if (isAdmin && totalPendingDeliveriesAcrossProjects > 0) {
            deliverySection = `\n\n📦 Site Deliveries Pending:\n- ${totalPendingDeliveriesAcrossProjects} material order(s) awaiting site verification.`;
        }

        // Build task summary line
        const taskLine = `\n\n📋 Task Summary:\n- Due Today: ${stats.today}\n- Overdue: ${stats.overdue}`;

        const message = `Good morning, ${user.full_name}! 🌅\n\nHere's your daily briefing for today:${taskLine}${snagSection}${designSection}${deliverySection}\n\nHave a productive day ahead!`;

        console.log(`[DailyBriefing] Constructing message for ${user.full_name} (isAdmin: ${isAdmin}, hasSnags: ${!!snagSection}, hasDesign: ${!!designSection}, hasDeliveries: ${pendingDeliveriesForUser.length > 0})`);

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
