import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getAuthUser } from '@/lib/supabase-server';
import { verifyPermission } from '@/lib/rbac';
import { PERMISSION_NODES } from '@/lib/rbac-constants';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { attachProjectCodes } from '@/lib/projectUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            console.error('supabaseAdmin is not initialized');
            return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const year = searchParams.get('year');
        const userIdFilter = searchParams.get('user_id');
        const projectIdFilter = searchParams.get('project_id'); // 'all', 'office', or project UUID

        // Calculate start and end of date filter if specified
        let startDate: string | null = null;
        let endDateStr: string | null = null;
        if (month && year) {
            if (month === 'all') {
                startDate = `${year}-01-01T00:00:00.000Z`;
                endDateStr = `${year}-12-31T23:59:59.999Z`;
            } else {
                const sMonth = month.padStart(2, '0');
                startDate = `${year}-${sMonth}-01T00:00:00.000Z`;
                const lastDay = new Date(Number(year), Number(month), 0).getDate();
                endDateStr = `${year}-${sMonth}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;
            }
        }

        // Fetch user data for role check
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        if (userError) {
            console.error('Error fetching userData:', userError);
        }

        const isAdmin = userData?.role === 'admin';

        // 1. Fetch Office Expenses (if not filtered strictly to a specific project)
        let mappedOfficeExpenses: any[] = [];
        if (!projectIdFilter || projectIdFilter === 'all' || projectIdFilter === 'office') {
            let officeQuery = supabaseAdmin
                .from('office_expenses')
                .select(`
                    *,
                    user:users!user_id(full_name, email)
                `)
                .order('expense_date', { ascending: false });

            if (startDate && endDateStr) {
                officeQuery = officeQuery.gte('expense_date', startDate).lte('expense_date', endDateStr);
            }

            if (!isAdmin) {
                officeQuery = officeQuery.eq('user_id', user.id);
            } else if (userIdFilter) {
                officeQuery = officeQuery.eq('user_id', userIdFilter);
            }

            const { data: officeExpenses, error: officeError } = await officeQuery;
            if (officeError) throw officeError;

            mappedOfficeExpenses = (officeExpenses || []).map((e: any) => {
                let project_name = 'Office';
                const desc = e.description || '';
                const match = desc.match(/^\[(.*?)\]/);
                if (match) {
                    project_name = match[1];
                }
                return {
                    id: e.id,
                    source: 'office',
                    project_id: null,
                    project_name,
                    project_code: null,
                    description: e.description,
                    amount: e.amount || 0,
                    expense_date: e.expense_date,
                    status: e.status || 'pending',
                    admin_remarks: e.admin_remarks || null,
                    category: e.category || 'Office Expense',
                    bill_urls: e.bill_urls || (e.bill_url ? [e.bill_url] : []),
                    user_id: e.user_id,
                    user: e.user || null,
                    created_at: e.created_at
                };
            });
        }

        // 2. Fetch Project Expenses from inventory_items (if not filtered strictly to 'office')
        let mappedProjExpenses: any[] = [];
        if (!projectIdFilter || projectIdFilter !== 'office') {
            try {
                let projQuery = supabaseAdmin
                    .from('inventory_items')
                    .select(`
                        id,
                        project_id,
                        item_name,
                        total_cost,
                        date_purchased,
                        bill_approval_status,
                        bill_rejection_reason,
                        bill_urls,
                        created_by,
                        created_at,
                        supplier_name,
                        project:projects(id, title),
                        created_by_user:users!inventory_items_created_by_fkey(full_name, email)
                    `)
                    .order('created_at', { ascending: false });

                if (startDate && endDateStr) {
                    const sDate = startDate.split('T')[0];
                    const eDate = endDateStr.split('T')[0];
                    projQuery = projQuery.gte('date_purchased', sDate).lte('date_purchased', eDate);
                }

                if (!isAdmin) {
                    projQuery = projQuery.eq('created_by', user.id);
                } else if (userIdFilter) {
                    projQuery = projQuery.eq('created_by', userIdFilter);
                }

                if (projectIdFilter && projectIdFilter !== 'all' && projectIdFilter !== 'office') {
                    projQuery = projQuery.eq('project_id', projectIdFilter);
                }

                const { data: projExpenses, error: projError } = await projQuery;
                if (!projError && projExpenses) {
                    const uniqueProjects = projExpenses.map((e: any) => e.project).filter(Boolean);
                    if (uniqueProjects.length > 0) {
                        await attachProjectCodes(uniqueProjects);
                    }

                    mappedProjExpenses = projExpenses.map((e: any) => {
                        const rawCode = e.project?.project_code || e.project?.ref_no || `AI-${e.project_id ? e.project_id.slice(0, 4) : ''}`;
                        const projectCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');
                        return {
                            id: e.id,
                            source: 'project',
                            project_id: e.project_id,
                            project_name: e.project ? e.project.title : 'Project',
                            project_code: projectCode,
                            description: e.item_name,
                            amount: e.total_cost || 0,
                            expense_date: e.date_purchased || (e.created_at ? e.created_at.split('T')[0] : null),
                            status: e.bill_approval_status || 'pending',
                            admin_remarks: e.bill_rejection_reason || null,
                            category: e.supplier_name || 'Project Expense',
                            bill_urls: e.bill_urls || [],
                            user_id: e.created_by,
                            requested_by: e.created_by_user?.full_name || e.created_by_user?.email || 'Unknown',
                            user: e.created_by_user || null,
                            payment_status: e.bill_approval_status === 'approved' ? 'paid' : 'pending',
                            created_at: e.created_at
                        };
                    });
                } else if (projError) {
                    console.error('Error querying project expenses for common view:', projError);
                }
            } catch (err) {
                console.error('Error fetching project expenses in common view:', err);
            }
        }

        // Combine and sort by date descending
        const finalExpenses = [...mappedOfficeExpenses, ...mappedProjExpenses];
        finalExpenses.sort((a: any, b: any) => {
            const dateA = a.expense_date ? new Date(a.expense_date).getTime() : 0;
            const dateB = b.expense_date ? new Date(b.expense_date).getTime() : 0;
            return dateB - dateA;
        });

        return NextResponse.json({
            expenses: finalExpenses
        });
    } catch (error: any) {
        console.error('Error fetching office expenses:', error);
        return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing expense ID' }, { status: 400 });
        }

        const body = await request.json();
        const { amount, description, category, expense_date, bill_urls, status, admin_remarks } = body;

        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        const isAdmin = userData?.role === 'admin';

        // Check office_expenses first
        const { data: existing } = await supabaseAdmin
            .from('office_expenses')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (!existing) {
            // Check inventory_items (project expenses)
            const { data: invItem } = await supabaseAdmin
                .from('inventory_items')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (invItem) {
                if (!isAdmin && invItem.created_by !== user.id) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                if (!isAdmin && invItem.bill_approval_status !== 'pending') {
                    return NextResponse.json({ error: 'Cannot update non-pending expense' }, { status: 400 });
                }

                const updateInvData: any = {};
                if (status !== undefined && isAdmin) {
                    updateInvData.bill_approval_status = status;
                }
                if (admin_remarks !== undefined && isAdmin) {
                    updateInvData.bill_rejection_reason = admin_remarks;
                }
                if (amount !== undefined) {
                    updateInvData.total_cost = parseFloat(amount);
                }
                if (description !== undefined) {
                    updateInvData.item_name = description;
                }
                if (category !== undefined) {
                    updateInvData.supplier_name = (category && typeof category === 'string' && category.trim()) ? category.trim() : 'Project Expense';
                }
                if (expense_date !== undefined) {
                    updateInvData.date_purchased = expense_date;
                }
                if (bill_urls !== undefined) {
                    updateInvData.bill_urls = bill_urls;
                }

                const { data: updatedInv, error: updateInvErr } = await supabaseAdmin
                    .from('inventory_items')
                    .update(updateInvData)
                    .eq('id', id)
                    .select(`
                        *,
                        project:projects(id, title),
                        created_by_user:users!inventory_items_created_by_fkey(full_name, email)
                    `)
                    .single();

                if (updateInvErr) throw updateInvErr;

                // Send notification on approval/rejection
                try {
                    if (isAdmin && status !== undefined && invItem.bill_approval_status !== status && invItem.created_by) {
                        if (status === 'approved') {
                            await NotificationService.notifyExpenseApproved(
                                invItem.created_by,
                                invItem.item_name,
                                invItem.total_cost || 0,
                                id
                            );
                        } else if (status === 'rejected') {
                            await NotificationService.notifyExpenseRejected(
                                invItem.created_by,
                                invItem.item_name,
                                invItem.total_cost || 0,
                                id
                            );
                        }
                    }
                } catch (notifErr) {
                    console.error('Error sending project expense notification:', notifErr);
                }

                const codedProj = updatedInv.project ? await attachProjectCodes(updatedInv.project) : null;
                const rawCode = codedProj?.project_code || codedProj?.ref_no || `AI-${updatedInv.project_id ? updatedInv.project_id.slice(0, 4) : ''}`;
                const projectCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');

                return NextResponse.json({
                    expense: {
                        id: updatedInv.id,
                        source: 'project',
                        project_id: updatedInv.project_id,
                        project_name: updatedInv.project?.title || 'Project',
                        project_code: projectCode,
                        description: updatedInv.item_name,
                        amount: updatedInv.total_cost || 0,
                        expense_date: updatedInv.date_purchased,
                        status: updatedInv.bill_approval_status || 'pending',
                        admin_remarks: updatedInv.bill_rejection_reason || null,
                        category: updatedInv.supplier_name,
                        bill_urls: updatedInv.bill_urls || [],
                        user_id: updatedInv.created_by,
                        user: updatedInv.created_by_user || null,
                        created_at: updatedInv.created_at
                    }
                });
            }

            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        if (!isAdmin && existing.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updateData: any = {};
        if (amount !== undefined) updateData.amount = parseFloat(amount);
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) {
            updateData.category = (category && typeof category === 'string' && category.trim()) ? category.trim() : 'General';
        }
        if (expense_date !== undefined) updateData.expense_date = expense_date;
        if (bill_urls !== undefined) updateData.bill_urls = bill_urls;

        if (isAdmin) {
            if (status !== undefined) {
                updateData.status = status;
                updateData.approved_by = user.id;
                updateData.approved_at = new Date().toISOString();
            }
            if (admin_remarks !== undefined) updateData.admin_remarks = admin_remarks;
        } else {
            // Non-admins can only update if status is pending
            if (existing.status !== 'pending') {
                return NextResponse.json({ error: 'Cannot update non-pending expense' }, { status: 400 });
            }
        }

        const { data: expense, error } = await supabaseAdmin
            .from('office_expenses')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // --- NOTIFICATIONS ---
        try {
            if (isAdmin && existing.status !== status && existing.user_id) {
                if (status === 'approved') {
                    await NotificationService.notifyExpenseApproved(
                        existing.user_id,
                        existing.description,
                        existing.amount,
                        id
                    );
                } else if (status === 'rejected') {
                    await NotificationService.notifyExpenseRejected(
                        existing.user_id,
                        existing.description,
                        existing.amount,
                        id
                    );
                }
            }
        } catch (notifError) {
            console.error('Error sending expense status notification:', notifError);
        }

        return NextResponse.json({ expense });
    } catch (error: any) {
        console.error('Error updating office expense:', error);
        return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing expense ID' }, { status: 400 });
        }

        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        const isAdmin = userData?.role === 'admin';

        // Check office_expenses first
        const { data: existing } = await supabaseAdmin
            .from('office_expenses')
            .select('user_id, status')
            .eq('id', id)
            .maybeSingle();

        if (!existing) {
            // Check inventory_items
            const { data: invItem } = await supabaseAdmin
                .from('inventory_items')
                .select('created_by, bill_approval_status')
                .eq('id', id)
                .maybeSingle();

            if (invItem) {
                if (!isAdmin && invItem.created_by !== user.id) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                await supabaseAdmin.from('inventory_items').delete().eq('id', id);
                return NextResponse.json({ success: true });
            }

            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        if (!isAdmin && existing.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!isAdmin && existing.status !== 'pending') {
            return NextResponse.json({ error: 'Cannot delete non-pending expense' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('office_expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting office expense:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const check = await verifyPermission(user.id, PERMISSION_NODES.OFFICE_EXPENSES_CREATE);
        const invCheck = await verifyPermission(user.id, PERMISSION_NODES.INVENTORY_ADD);
        if (!check.allowed && !invCheck.allowed && !user.isAdmin) {
            return NextResponse.json({ error: 'You do not have permission to add expenses' }, { status: 403 });
        }

        const body = await request.json();
        const { amount, description, category, expense_date, bill_urls, project_id } = body;

        if (!amount || !expense_date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const safeDescription = (description && typeof description === 'string' && description.trim())
            ? description.trim()
            : ((category && typeof category === 'string' && category.trim()) || (project_id && project_id !== 'office' ? 'Site Expense' : 'Office Expense'));

        // If a specific project is selected, record directly in inventory_items
        // so it immediately appears in that project's Expenses tab!
        if (project_id && project_id !== 'office') {
            const parsedAmt = parseFloat(amount);
            const { data: item, error: itemError } = await supabaseAdmin
                .from('inventory_items')
                .insert({
                    project_id,
                    item_name: safeDescription,
                    total_cost: parsedAmt,
                    date_purchased: expense_date,
                    supplier_name: (category && typeof category === 'string' && category.trim()) ? category.trim() : 'Project Expense',
                    bill_urls: bill_urls || [],
                    created_by: user.id,
                    bill_approval_status: 'pending',
                })
                .select(`
                    *,
                    project:projects(id, title),
                    created_by_user:users!inventory_items_created_by_fkey(full_name, email)
                `)
                .single();

            if (itemError) {
                console.error('Error creating project expense via office-expenses endpoint:', itemError);
                throw itemError;
            }

            // Notify stakeholders
            try {
                const requesterName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team member';
                await NotificationService.notifyStakeholders(project_id, user.id, {
                    title: 'New Project Expense Added',
                    message: `${requesterName} added expense "${safeDescription}" (₹${amount}) to project "${item.project?.title || 'Project'}"`,
                    type: 'inventory_added',
                    relatedId: project_id,
                    relatedType: 'project',
                    metadata: { expenseId: item.id }
                });
            } catch (notifErr) {
                console.error('Failed to notify stakeholders of project expense:', notifErr);
            }

            const codedProj = item.project ? await attachProjectCodes(item.project) : null;
            const rawCode = codedProj?.project_code || codedProj?.ref_no || `AI-${item.project_id ? item.project_id.slice(0, 4) : ''}`;
            const projectCode = rawCode.replace('AI/PRJ/', 'AI/').replace('PRJ/', '');

            return NextResponse.json({
                expense: {
                    id: item.id,
                    source: 'project',
                    project_id: item.project_id,
                    project_name: item.project?.title || 'Project',
                    project_code: projectCode,
                    description: item.item_name,
                    amount: item.total_cost || 0,
                    expense_date: item.date_purchased,
                    status: item.bill_approval_status || 'pending',
                    category: item.supplier_name,
                    bill_urls: item.bill_urls || [],
                    user_id: item.created_by,
                    user: item.created_by_user || null,
                    created_at: item.created_at
                }
            }, { status: 201 });
        }

        // Otherwise save as Office Expense
        const { data: expense, error } = await supabaseAdmin
            .from('office_expenses')
            .insert({
                user_id: user.id,
                amount: parseFloat(amount),
                description: safeDescription,
                category: (category && typeof category === 'string' && category.trim()) ? category.trim() : 'General',
                expense_date,
                bill_urls: bill_urls || [],
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        // --- NOTIFICATIONS ---
        try {
            const adminAndHrIds = await NotificationService.getAdminAndHrUserIds();

            const { data: requester } = await supabaseAdmin
                .from('users')
                .select('full_name')
                .eq('id', user.id)
                .single();

            const requesterName = requester?.full_name || 'Unknown User';

            if (adminAndHrIds.length > 0) {
                await Promise.all(adminAndHrIds.map((adminId: string) =>
                    NotificationService.notifyExpenseCreated(
                        adminId,
                        description,
                        amount,
                        requesterName,
                        expense.id
                    )
                ));
            }
        } catch (notifError) {
            console.error('Error sending expense creation notification:', notifError);
        }

        return NextResponse.json({
            expense: {
                ...expense,
                source: 'office',
                project_name: 'Office',
                project_id: null,
                project_code: null
            }
        }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating office expense:', error);
        return NextResponse.json({ error: error?.message || 'Internal server error', details: error?.details || null }, { status: 500 });
    }
}
