import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function generateTemporaryPassword(): string {
  const raw = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return raw.slice(0, 10);
}

// GET: Fetch status, linked user info, and project default customer name
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { user: authedUser, role } = await getAuthUser();
        if (!authedUser || role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get project info
        const { data: project, error: projectErr } = await supabaseAdmin
            .from('projects')
            .select('portal_user_id, customer_name')
            .eq('id', projectId)
            .single();

        if (projectErr) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

        // Get access status
        const { data: access } = await supabaseAdmin
            .from('project_client_access')
            .select('is_active')
            .eq('project_id', projectId)
            .maybeSingle();

        let linkedUser = null;
        if (project.portal_user_id) {
            const { data: user } = await supabaseAdmin
                .from('users')
                .select('id, full_name, username, email')
                .eq('id', project.portal_user_id)
                .single();
            linkedUser = user;
        }

        return NextResponse.json({ 
            linkedUser,
            customerName: project.customer_name,
            isActive: access?.is_active ?? false
        });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: Create and link a new client account using only Full Name
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { user: authedUser, role } = await getAuthUser();
        if (!authedUser || role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { fullName } = await request.json();
        if (!fullName) return NextResponse.json({ error: 'Full Name is required' }, { status: 400 });

        // Generate base username: lowercase, no spaces, no special chars except _
        let baseUsername = fullName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (!baseUsername) baseUsername = 'client';

        // Ensure uniqueness for username
        let uniqueUsername = baseUsername;
        let counter = 1;
        while (true) {
            const { data: existing } = await supabaseAdmin.from('users').select('id').eq('username', uniqueUsername).maybeSingle();
            if (!existing) break;
            uniqueUsername = `${baseUsername}_${counter}`;
            counter++;
        }
        
        // Generate internal email for Supabase Auth requirement
        const internalEmail = `${uniqueUsername}@portal.appleinteriors.in`;
        const temporaryPassword = generateTemporaryPassword();

        // Create new auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: internalEmail,
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName, role: 'client', username: uniqueUsername }
        });

        if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
        const userId = authData.user.id;

        // Create profile in users table
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .upsert({
                id: userId,
                email: internalEmail,
                full_name: fullName,
                username: uniqueUsername,
                role: 'client',
                password_changed: false
            });

        if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

        // Link project to this user
        const { error: updateError } = await supabaseAdmin
            .from('projects')
            .update({ portal_user_id: userId })
            .eq('id', projectId);

        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

        // Ensure project access is active
        await supabaseAdmin
            .from('project_client_access')
            .upsert({ project_id: projectId, is_active: true, token: crypto.randomUUID() }, { onConflict: 'project_id' });

        return NextResponse.json({ success: true, temporaryPassword, username: uniqueUsername, userId });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH: Reset password or Toggle status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { user: authedUser, role } = await getAuthUser();
        if (!authedUser || role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { action, isActive } = await request.json();

        if (action === 'toggle_status') {
            const { error } = await supabaseAdmin
                .from('project_client_access')
                .upsert({ project_id: projectId, is_active: isActive, token: crypto.randomUUID() }, { onConflict: 'project_id' });

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }

        if (action === 'reset_password') {
            const { data: project } = await supabaseAdmin
                .from('projects')
                .select('portal_user_id')
                .eq('id', projectId)
                .single();

            if (!project?.portal_user_id) return NextResponse.json({ error: 'No user linked' }, { status: 400 });

            const newPassword = generateTemporaryPassword();
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
                project.portal_user_id,
                { password: newPassword }
            );

            if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
            return NextResponse.json({ success: true, newPassword });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (err) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
