import { NextResponse } from 'next/server';
import { z } from 'zod';

// Import service role key for admin operations
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  designation: z.string().min(2, 'Designation must be at least 2 characters'),
  role: z.enum(['admin', 'employee']),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

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

    const { email, full_name, designation, role, password } = parsed.data;

    console.log('Creating user:', { email, full_name, role });
    console.log('Service role key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

    // Create auth user with admin client (service role key)
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          designation,
          role,
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

      // Insert into users table with admin client to bypass RLS
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: authData.user.id,
          email,
          full_name,
          designation,
          role,
        }, {
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
