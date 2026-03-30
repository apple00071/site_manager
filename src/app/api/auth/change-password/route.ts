import { NextResponse } from 'next/server';
import { createAuthenticatedClient, supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering - never cache authentication
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const { new_password } = await request.json();

    if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
      return NextResponse.json(
        { error: 'New password is required and must be at least 6 characters' },
        { status: 400 }
      );
    }

    const supabase = await createAuthenticatedClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateError) {
      console.error('Password update error (admin):', updateError);
      return NextResponse.json({ 
        error: updateError.message || 'Failed to update password',
        details: 'The system could not update your password at this time.'
      }, { status: 400 });
    }

    // Mark password as changed in the users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ password_changed: true })
      .eq('id', user.id);

    if (dbError) {
      console.error('Database update error after password change:', dbError);
      // We don't fail here because the auth password was already updated,
      // but we should log it. Actually, if it fails, the user will be asked again.
    }

    console.log('Password successfully updated for user:', user.id);
    return NextResponse.json({ success: true, message: 'Password updated successfully' }, { status: 200 });
  } catch (err: any) {
    console.error('Error in change-password route:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during password change', details: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
