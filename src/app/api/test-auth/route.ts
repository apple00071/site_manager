import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Simple test endpoint to verify authentication is working
 * GET /api/test-auth
 */
export async function GET(request: Request) {
  try {
    console.log('=== Test Auth Endpoint Called ===');
    
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader) {
      return NextResponse.json(
        { 
          error: 'No authorization header',
          hint: 'Make sure you are logged in and the session token is being sent'
        },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token preview:', token.substring(0, 20) + '...');

    // Try to get user with the token
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error } = await supabaseClient.auth.getUser();
    
    if (error) {
      console.error('Error getting user:', error);
      return NextResponse.json(
        { 
          error: 'Failed to authenticate',
          details: error.message,
          hint: 'Token may be invalid or expired. Try logging out and back in.'
        },
        { status: 401 }
      );
    }

    if (!user) {
      console.error('No user found');
      return NextResponse.json(
        { 
          error: 'No user found',
          hint: 'Token is valid but no user associated. This should not happen.'
        },
        { status: 401 }
      );
    }

    console.log('✅ User authenticated:', user.email);

    // Get user role from database
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

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, full_name')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('Error fetching user data:', userError);
    }

    return NextResponse.json(
      { 
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: userData?.role || 'unknown',
          full_name: userData?.full_name || 'unknown',
        },
        message: 'Authentication successful!'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

