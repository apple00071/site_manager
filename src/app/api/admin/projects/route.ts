import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NotificationService } from '@/lib/notificationService';
import { sendCustomWhatsAppNotification } from '@/lib/whatsapp';
import { getCurrentUser, supabaseAdmin } from '@/lib/supabase-server';
import { createNoCacheResponse } from '@/lib/apiHelpers';

// Optimize caching for projects API
export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes cache

// Schema for project validation
const projectSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
  customer_name: z.string().min(2, 'Customer name is required'),
  phone_number: z.string().min(10, 'Phone number is required'),
  alt_phone_number: z.string().optional().nullable(),
  address: z.string().min(5, 'Address is required'),
  property_type: z.string().optional().nullable(),
  apartment_name: z.string().optional().nullable(),
  block_number: z.string().optional().nullable(),
  flat_number: z.string().optional().nullable(),
  floor_number: z.string().optional().nullable(),
  area_sqft: z.string().optional().nullable(),
  start_date: z.string().min(1, 'Start date is required'),
  estimated_completion_date: z.string().min(1, 'Estimated completion date is required'),
  assigned_employee_id: z.string().min(1, 'Designer selection is required'),
  carpenter_name: z.string().optional().nullable(),
  carpenter_phone: z.string().optional().nullable(),
  electrician_name: z.string().optional().nullable(),
  electrician_phone: z.string().optional().nullable(),
  plumber_name: z.string().optional().nullable(),
  plumber_phone: z.string().optional().nullable(),
  painter_name: z.string().optional().nullable(),
  painter_phone: z.string().optional().nullable(),
  granite_worker_name: z.string().optional().nullable(),
  granite_worker_phone: z.string().optional().nullable(),
  glass_worker_name: z.string().optional().nullable(),
  glass_worker_phone: z.string().optional().nullable(),
  project_budget: z.string().optional().nullable(),
  requirements_pdf_url: z.string().optional().nullable(),
  project_notes: z.string().optional().nullable(),
  created_by: z.string().uuid('Invalid user ID format').optional(),
});

// GET handler for fetching projects
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Admin projects API called');
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('id');
    
    console.log('📋 Request details:', {
      url: request.url,
      projectId,
      method: request.method
    });
    
    // Get current user using secure authentication
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const isAdmin = user.role === 'admin';
    const userId = user.id;
    
    console.log(`Fetching projects for ${isAdmin ? 'admin' : 'user'}:`, user.email);
    
    let projectsQuery = supabaseAdmin
      .from('projects')
      .select(`
        id, 
        title, 
        description,
        status, 
        workflow_stage,
        estimated_completion_date,
        customer_name,
        phone_number,
        alt_phone_number,
        address,
        flat_number,
        block_number,
        apartment_name,
        property_type,
        area_sqft,
        floor_number,
        assigned_employee_id,
        created_at,
        updated_at
      `);
    
    // If requesting a specific project, add ID filter
    if (projectId) {
      projectsQuery = projectsQuery.eq('id', projectId);
    }
    
    // If user is not admin, only fetch projects they are assigned to
    if (!isAdmin) {
      // Get project IDs the user is a member of via project_members table
      const { data: memberProjects, error: memberError } = await supabaseAdmin
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

      const memberProjectIds = memberProjects?.map(p => p.project_id) || [];

      // Get projects directly assigned via assigned_employee_id field
      const { data: assignedProjects, error: assignedError } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('assigned_employee_id', userId);

      if (assignedError) {
        console.error('Error fetching assigned projects:', assignedError.message);
        return NextResponse.json(
          { error: { message: 'Error fetching assigned projects', code: 'PROJECT_FETCH_ERROR' } },
          { status: 500 }
        );
      }

      const assignedProjectIds = assignedProjects?.map(p => p.id) || [];

      // Get projects assigned via designer_id field
      const { data: designerProjects, error: designerError } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('designer_id', userId);

      if (designerError) {
        console.error('Error fetching designer projects:', designerError.message);
        return NextResponse.json(
          { error: { message: 'Error fetching designer projects', code: 'PROJECT_FETCH_ERROR' } },
          { status: 500 }
        );
      }

      const designerProjectIds = designerProjects?.map(p => p.id) || [];

      // Combine all lists (remove duplicates)
      const allProjectIds = [...new Set([...memberProjectIds, ...assignedProjectIds, ...designerProjectIds])];

      if (allProjectIds.length === 0) {
        // User is not assigned to any projects
        return NextResponse.json([], { status: 200 });
      }

      // Filter projects by the ones the user has access to
      projectsQuery = projectsQuery.in('id', allProjectIds);
    }
    
    // Add ordering and execute the query
    let query = projectsQuery;
    if (!projectId) {
      query = query.order('created_at', { ascending: false });
    }
    
    const { data: projects, error } = projectId 
      ? await query.single()
      : await query;
    
    console.log('Query result:', { projects, error, projectId });
    
    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json(
        { error: error.message || 'Error fetching projects', code: error.code || 'PROJECT_FETCH_ERROR' },
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
    
    // Get current user using secure authentication
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return NextResponse.json(
        { error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    
    // Check if user is admin
    if (user.role !== 'admin') {
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
      property_type: parsed.data.property_type || null,
      apartment_name: parsed.data.apartment_name || null,
      block_number: parsed.data.block_number || null,
      flat_number: parsed.data.flat_number || null,
      floor_number: parsed.data.floor_number || null,
      area_sqft: parsed.data.area_sqft ? parseFloat(parsed.data.area_sqft) : null,
      start_date: parsed.data.start_date,
      estimated_completion_date: parsed.data.estimated_completion_date,
      assigned_employee_id: parsed.data.assigned_employee_id,
      carpenter_name: parsed.data.carpenter_name || null,
      carpenter_phone: parsed.data.carpenter_phone || null,
      electrician_name: parsed.data.electrician_name || null,
      electrician_phone: parsed.data.electrician_phone || null,
      plumber_name: parsed.data.plumber_name || null,
      plumber_phone: parsed.data.plumber_phone || null,
      painter_name: parsed.data.painter_name || null,
      painter_phone: parsed.data.painter_phone || null,
      granite_worker_name: parsed.data.granite_worker_name || null,
      granite_worker_phone: parsed.data.granite_worker_phone || null,
      glass_worker_name: parsed.data.glass_worker_name || null,
      glass_worker_phone: parsed.data.glass_worker_phone || null,
      project_budget: parsed.data.project_budget ? parseFloat(parsed.data.project_budget) : null,
      requirements_pdf_url: parsed.data.requirements_pdf_url || null,
      project_notes: parsed.data.project_notes || null,
      created_by: user.id,
      updated_by: user.id,
    };
    
    // Insert the new project
    const { data: project, error: insertError } = await supabaseAdmin
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
    const { error: memberError } = await supabaseAdmin
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
      const { error: assigneeError } = await supabaseAdmin
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

    // Send notification to assigned employee
    if (parsed.data.assigned_employee_id !== user.id) {
      try {
        await NotificationService.createNotification({
          userId: parsed.data.assigned_employee_id,
          title: 'New Project Assigned',
          message: `You have been assigned to project "${parsed.data.title}" for customer ${parsed.data.customer_name}`,
          type: 'task_assigned',
          relatedId: project.id,
          relatedType: 'project'
        });
        console.log('Assignment notification sent to employee:', parsed.data.assigned_employee_id);

        try {
          const { data: employee } = await supabaseAdmin
            .from('users')
            .select('phone_number')
            .eq('id', parsed.data.assigned_employee_id)
            .single();
          if (employee?.phone_number) {
            const origin = (req as Request).headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const link = `${origin}/dashboard/projects/${project.id}`;
            await sendCustomWhatsAppNotification(
              employee.phone_number,
              `🆕 New Project Assigned\n\nYou have been assigned to project "${parsed.data.title}" for customer ${parsed.data.customer_name}\n\nOpen: ${link}`
            );
          }
        } catch (_) {}
      } catch (notificationError) {
        console.error('Failed to send assignment notification:', notificationError);
        // Don't fail the main operation if notification fails
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