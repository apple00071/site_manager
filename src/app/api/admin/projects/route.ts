import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Schema for project validation
const projectSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
  client_id: z.string().uuid('Invalid client ID format'),
  deadline: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
});

// Helper function to create a server-side Supabase client
const createServerSupabaseClient = async () => {
  const cookieStore = cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore;
          return cookie.get(name)?.value;
        },
        async set(name: string, value: string, options: any) {
          try {
            const cookie = await cookieStore;
            cookie.set({ 
              name, 
              value, 
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            });
          } catch (error) {
            console.error('Error setting cookie:', error);
          }
        },
        async remove(name: string, options: any) {
          try {
            const cookie = await cookieStore;
            cookie.set({ 
              name, 
              value: '',
              ...options,
              maxAge: 0,
              path: '/',
            });
          } catch (error) {
            console.error('Error removing cookie:', error);
          }
        },
      },
    }
  );
};

// GET handler for fetching projects
export async function GET() {
  try {
    console.log('Fetching projects...');
    
    const supabase = await createServerSupabaseClient();
    
    // Get the current user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('No session found:', sessionError?.message);
      return NextResponse.json(
        { error: { message: 'Not authenticated', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    
    // Get user role and ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', session.user.id)
      .single();
    
    if (userError || !userData) {
      console.error('Error fetching user data:', userError?.message);
      return NextResponse.json(
        { error: { message: 'Error fetching user data', code: 'USER_FETCH_ERROR' } },
        { status: 500 }
      );
    }
    
    const isAdmin = userData.role === 'admin';
    const userId = userData.id;
    
    console.log(`Fetching projects for ${isAdmin ? 'admin' : 'user'}:`, session.user.email);
    
    let projectsQuery = supabase
      .from('projects')
      .select(`
        id, 
        title, 
        description,
        status, 
        deadline,
        client_id,
        created_at,
        clients ( id, name, email )
      `);
    
    // If user is not admin, only fetch projects they are assigned to
    if (!isAdmin) {
      // First, get project IDs the user is a member of
      const { data: memberProjects, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);
      
      if (memberError) {
        console.error('Error fetching member projects:', memberError.message);
        return NextResponse.json(
          { error: { message: 'Error fetching assigned projects', code: 'PROJECT_FETCH_ERROR' } },
          { status: 500 }
        );
      }
      
      const projectIds = memberProjects?.map(p => p.project_id) || [];
      
      if (projectIds.length === 0) {
        // User is not assigned to any projects
        return NextResponse.json([], { status: 200 });
      }
      
      // Filter projects by the ones the user is a member of
      projectsQuery = projectsQuery.in('id', projectIds);
    }
    
    // Add ordering and execute the query
    const { data: projects, error } = await projectsQuery
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json(
        { error: { message: 'Error fetching projects', code: 'PROJECT_FETCH_ERROR' } },
        { status: 500 }
      );
    }
    
    return NextResponse.json(projects);
    
  } catch (error) {
    console.error('Unexpected error in GET /api/admin/projects:', error);
    return NextResponse.json(
      { error: { message: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' } },
      { status: 500 }
    );
  }
}

// POST handler for creating a new project
export async function POST(req: Request) {
  try {
    console.log('Creating new project...');
    
    const supabase = await createServerSupabaseClient();
    
    // Get the current user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('No session found:', sessionError?.message);
      return NextResponse.json(
        { error: { message: 'Not authenticated', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    
    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();
    
    if (userData?.role !== 'admin') {
      return NextResponse.json(
        { error: { message: 'Not authorized', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }
    
    // Parse and validate the request body
    const body = await req.json();
    console.log('Request body:', body);
    
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      console.error('Validation error:', parsed.error.format());
      return NextResponse.json(
        { 
          error: {
            message: 'Invalid request data',
            details: parsed.error.format(),
            code: 'VALIDATION_ERROR'
          }
        },
        { status: 400 }
      );
    }

    const { title, description, client_id, deadline, status } = parsed.data;
    console.log('Creating project with data:', { title, client_id, status });

    // Verify the client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      console.error('Client not found:', clientError);
      return NextResponse.json(
        { 
          error: {
            message: 'Client not found',
            details: `No client found with ID: ${client_id}`,
            code: 'CLIENT_NOT_FOUND'
          }
        },
        { status: 404 }
      );
    }

    // Insert the project
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert([
        {
          title,
          description,
          client_id,
          deadline: deadline || null,
          status: status || 'pending',
          created_by: session.user.id
        }
      ])
      .select(`
        id, 
        title, 
        description,
        status, 
        deadline,
        client_id,
        created_at,
        clients ( id, name, email )
      `);

    if (insertError) {
      console.error('Database error:', insertError);
      return NextResponse.json(
        { 
          error: {
            message: 'Database operation failed',
            details: insertError.message,
            code: insertError.code || 'DATABASE_ERROR'
          }
        },
        { status: 500 }
      );
    }

    console.log('Project created successfully:', project);
    return NextResponse.json(
      { 
        success: true, 
        project: project?.[0] 
      }, 
      { status: 201 }
    );
    
  } catch (error) {
    console.error('Unexpected error in projects API:', error);
    return NextResponse.json(
      { 
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR'
        }
      },
      { status: 500 }
    );
  }
}