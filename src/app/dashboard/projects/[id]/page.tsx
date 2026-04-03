import React, { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { ProjectDetailsClient, Project } from '@/components/projects/ProjectDetailsClient';
import { ProjectSkeleton } from '@/components/projects/ProjectSkeleton';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Server Component that fetches project data
 */
async function ProjectDataFetcher({ id }: { id: string }) {
  // 1. Get current user
  const { user, error: authError } = await getAuthUser();
  if (authError || !user) {
    redirect('/login');
  }

  // 2. Fetch project data with same JOINS as admin API for parity
  const { data: projectData, error: projectError } = await supabaseAdmin
    .from('projects')
    .select(`
      *,
      assigned_employee:assigned_employee_id(
        id,
        email,
        name:full_name,
        designation
      )
    `)
    .eq('id', id)
    .single();

  if (projectError || !projectData) {
    console.error('Project fetch error:', projectError);
    return notFound();
  }

  // 3. Simple permission check (can be expanded)
  // For now, we trust the server fetching logic but we could verify roles/members here
  
  return <ProjectDetailsClient initialProject={projectData as unknown as Project} />;
}

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  if (!id) return notFound();

  return (
    <div className="w-full h-full">
      <Suspense fallback={<ProjectSkeleton />}>
        <ProjectDataFetcher id={id} />
      </Suspense>
    </div>
  );
}
