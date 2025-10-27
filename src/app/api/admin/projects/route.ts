import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Schema for project validation
const projectSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
  customer_name: z.string().min(2, 'Customer name is required'),
  phone_number: z.string().min(10, 'Phone number is required'),
  alt_phone_number: z.string().optional().nullable(),
  address: z.string().min(5, 'Address is required'),
  start_date: z.string().min(1, 'Start date is required'),
  estimated_completion_date: z.string().min(1, 'Estimated completion date is required'),
  assigned_employee_id: z.string().uuid('Invalid employee ID format'),
  designer_name: z.string().min(2, 'Designer name is required'),
  designer_phone: z.string().min(10, 'Designer phone is required'),
  carpenter_name: z.string().optional().nullable(),
  carpenter_phone: z.string().optional().nullable(),
  electrician_name: z.string().optional().nullable(),
  electrician_phone: z.string().optional().nullable(),
  plumber_name: z.string().optional().nullable(),
  plumber_phone: z.string().optional().nullable(),
  painter_name: z.string().optional().nullable(),
  painter_phone: z.string().optional().nullable(),
  project_budget: z.string().optional().nullable(),
  project_notes: z.string().optional().nullable(),
  created_by: z.string().uuid('Invalid user ID format').optional(),
});

// Helper function to create a server-side Supabase client
const createServerSupabaseClient = async () => {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ 
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
        remove(name: string, options: any) {
          try {
            cookieStore.set({ 
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
    
    const { data: { user }, error: userAuthError } = await supabase.auth.getUser();
    
    if (userAuthError || !user) {
      console.error('No authenticated user:', userAuthError?.message);
      return NextResponse.json(
        { error: { message: 'Not authenticated', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    
    const isAdmin = (user.app_metadata?.role || user.user_metadata?.role) === 'admin';
    const userId = user.id;
    
    console.log(`Fetching projects for ${isAdmin ? 'admin' : 'user'}:`, user.email);
    
    let projectsQuery = supabase
      .from('projects')
      .select(`
        id, 
        title, 
        description,
        status, 
        estimated_completion_date,
        customer_name,
        created_at
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
      console.error('Validation error:', parsed.error);
      return NextResponse.json(
        { error: { message: 'Invalid input', details: parsed.error.format() } },
        { status: 400 }
      );
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: { message: 'User not found' } },
        { status: 404 }
      );
    }
    
    // Prepare project data with all fields
    const projectData = {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      customer_name: parsed.data.customer_name,
      phone_number: parsed.data.phone_number,
      alt_phone_number: parsed.data.alt_phone_number || null,
      address: parsed.data.address,
      start_date: parsed.data.start_date,
      estimated_completion_date: parsed.data.estimated_completion_date,
      assigned_employee_id: parsed.data.assigned_employee_id,
      designer_name: parsed.data.designer_name,
      designer_phone: parsed.data.designer_phone,
      carpenter_name: parsed.data.carpenter_name || null,
      carpenter_phone: parsed.data.carpenter_phone || null,
      electrician_name: parsed.data.electrician_name || null,
      electrician_phone: parsed.data.electrician_phone || null,
      plumber_name: parsed.data.plumber_name || null,
      plumber_phone: parsed.data.plumber_phone || null,
      painter_name: parsed.data.painter_name || null,
      painter_phone: parsed.data.painter_phone || null,
      project_budget: parsed.data.project_budget ? parseFloat(parsed.data.project_budget) : null,
      project_notes: parsed.data.project_notes || null,
      created_by: user.id,
      updated_by: user.id,
    };
    
    // Insert the new project
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();
      
    if (insertError) {
      console.error('Error creating project:', insertError);
      return NextResponse.json(
        { error: { message: 'Failed to create project', details: insertError } },
        { status: 500 }
      );
    }
    
    // Add the current user as a project member with admin role
    const { error: memberError } = await supabase
      .from('project_members')
      .insert([
        {
          project_id: project.id,
          user_id: user.id,
          role: 'admin',
          created_by: user.id,
        },
      ]);
      
    if (memberError) {
      console.error('Error adding project member:', memberError);
      // Don't fail the request if we can't add the member
      // Just log it and continue
    }

    // Add the assigned employee as a project member if they're not the current user
    if (parsed.data.assigned_employee_id !== user.id) {
      const { error: assigneeError } = await supabase
        .from('project_members')
        .insert([
          {
            project_id: project.id,
            user_id: parsed.data.assigned_employee_id,
            role: 'member',
            created_by: user.id,
          },
        ]);
        
      if (assigneeError) {
        console.error('Error adding assigned employee to project:', assigneeError);
        // Don't fail the request if we can't add the assignee
        // Just log it and continue
      }
    }

    console.log('Project created successfully:', project);
    return NextResponse.json(
      { 
        success: true, 
        project: project
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