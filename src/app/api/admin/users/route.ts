import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { NotificationService } from '@/lib/notificationService';
import { createAuthenticatedClient, supabaseAdmin } from '@/lib/supabase-server';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';

// Force dynamic rendering - never cache user data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_\.\-]+$/, 'Only letters, numbers, underscore, dot and hyphen allowed'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  designation: z.string().min(2, 'Designation must be at least 2 characters').optional().or(z.literal('')),
  role: z.enum(['admin', 'employee']),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  phone_number: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
});

function generateTemporaryPassword(): string {
  const raw = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return raw.slice(0, 10);
}

const updateUserSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_\.\-]+$/, 'Only letters, numbers, underscore, dot and hyphen allowed'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  designation: z.string().min(2, 'Designation must be at least 2 characters').optional().or(z.literal('')),
  role: z.enum(['admin', 'employee']),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  phone_number: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
});

// GET handler for fetching users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');
    
    const supabase = await createAuthenticatedClient();
    
    const { data: { user }, error: userAuthError } = await supabase.auth.getUser();
    
    if (userAuthError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Check if user is admin
    const isAdmin = (user.app_metadata?.role || user.user_metadata?.role) === 'admin';
    
    // Build query
    let query = supabaseAdmin
      .from('users')
      .select('*')
      .order('full_name');
    
    // Add role filter if provided
    if (roleFilter) {
      query = query.eq('role', roleFilter);
    }
    
    const { data: users, error } = await query;
    
    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, username, full_name, designation, role, password, phone_number } = parsed.data;

    const finalPassword =
      password && password.trim() !== ''
        ? password
        : generateTemporaryPassword();

    console.log('Creating user:', { email, full_name, role });
    console.log('Service role key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

    // Create auth user with admin client (service role key)
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: {
          full_name,
          designation,
          role,
          username,
        },
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        console.error('Auth error details:', JSON.stringify(authError, null, 2));
        return NextResponse.json(
          { error: authError.message || 'Failed to create user', details: authError },
          { status: authError.status || 500 }
        );
      }

      if (!authData.user) {
        console.error('No user returned from auth creation');
        return NextResponse.json(
          { error: 'User was not created' },
          { status: 500 }
        );
      }

      console.log('Auth user created successfully:', authData.user.id);

      let hasUsername = true;
      try {
        const { error: unameErr } = await supabaseAdmin.from('users').select('username').limit(1);
        if (unameErr) hasUsername = false;
      } catch (_) { hasUsername = false; }

      const profile: any = {
        id: authData.user.id,
        email,
        full_name,
        designation,
        role,
        phone_number: phone_number || null,
      };
      if (hasUsername) profile.username = username;

      const { error: profileError } = await supabaseAdmin
        .from('users')
        .upsert(profile, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        return NextResponse.json(
          { error: profileError.message || 'Failed to create user profile' },
          { status: 500 }
        );
      }

      console.log('User profile created successfully');

      // Send welcome notification to new user
      try {
        await NotificationService.createNotification({
          userId: authData.user.id,
          title: 'Welcome to Apple Interior Manager',
          message: `Welcome ${full_name}! Your account has been created successfully. You can now access the system with your assigned role: ${role}.`,
          type: 'general',
          relatedId: authData.user.id,
          relatedType: 'user'
        });
        console.log('Welcome notification sent to new user:', authData.user.id);
      } catch (notificationError) {
        console.error('Failed to send welcome notification:', notificationError);
        // Don't fail the main operation if notification fails
      }

      // Send WhatsApp welcome message if phone number is available
      if (phone_number && phone_number.trim() !== '') {
        try {
          const origin =
            req.headers.get('origin') ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            'http://localhost:3000';

          const loginLink = `${origin}/login`;

          const whatsappMessage = `Welcome ${full_name}! Your account has been created successfully. Please find your temporary login details below:\n\nUsername: ${username}\nTemporary password: ${finalPassword}\nLogin link: ${loginLink}\n\nPlease log in and change your password from the Settings page.`;

          await sendCustomWhatsAppNotification(phone_number, whatsappMessage);
        } catch (whatsAppError) {
          console.error('Failed to send WhatsApp welcome message:', whatsAppError);
        }
      }

      return NextResponse.json(
        { 
          success: true, 
          user: { 
            id: authData.user.id, 
            email: authData.user.email 
          } 
        },
        { status: 201 }
      );
    } catch (createError: any) {
      console.error('Exception during user creation:', createError);
      return NextResponse.json(
        { error: 'Failed to create user', details: createError.message },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('Unexpected error in POST handler:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { id, email, username, full_name, designation, role, password, phone_number } = parsed.data;

    console.log('Updating user:', { id, email, full_name, role });

    // Update user profile in database
    let hasUsername = true;
    try {
      const { error: unameErr } = await supabaseAdmin.from('users').select('username').limit(1);
      if (unameErr) hasUsername = false;
    } catch (_) { hasUsername = false; }

    const profileUpdate: any = {
      email,
      full_name,
      designation,
      role,
      phone_number: phone_number || null,
    };
    if (hasUsername) profileUpdate.username = username;

    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update(profileUpdate)
      .eq('id', id);

    if (profileError) {
      console.error('Error updating user profile:', profileError);
      return NextResponse.json(
        { error: profileError.message || 'Failed to update user profile' },
        { status: 500 }
      );
    }

    // Update password if provided
    if (password && password.trim() !== '') {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        { password }
      );

      if (passwordError) {
        console.error('Error updating password:', passwordError);
        return NextResponse.json(
          { error: passwordError.message || 'Failed to update password' },
          { status: 500 }
        );
      }
      console.log('Password updated successfully');
    }

    // Update auth user metadata
    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      {
        user_metadata: {
          full_name,
          designation,
          role,
          phone_number: phone_number || null,
          username,
        },
      }
    );

    if (metadataError) {
      console.error('Error updating user metadata:', metadataError);
      // Don't fail the operation if metadata update fails
    }

    console.log('User updated successfully');

    return NextResponse.json(
      { 
        success: true, 
        message: 'User updated successfully'
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Unexpected error in PATCH handler:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const id = body?.id as string | undefined;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createAuthenticatedClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const isAdmin = (user.app_metadata?.role || user.user_metadata?.role) === 'admin';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    console.log('Deleting user:', { id });

    // Delete from Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return NextResponse.json(
        { error: authDeleteError.message || 'Failed to delete auth user' },
        { status: 500 }
      );
    }

    // Delete profile row from users table
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (profileError) {
      console.error('Error deleting user profile:', profileError);
      return NextResponse.json(
        { error: profileError.message || 'Failed to delete user profile' },
        { status: 500 }
      );
    }

    console.log('User deleted successfully:', id);

    return NextResponse.json(
      {
        success: true,
        message: 'User deleted successfully',
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Unexpected error in DELETE handler:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: err.message },
      { status: 500 }
    );
  }
}
