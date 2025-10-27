'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// This ensures the page is always rendered on the server
// and never statically generated
export const dynamic = 'force-dynamic';

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  customer_name: string;
  phone_number: string;
  alt_phone_number: string | null;
  address: string;
  start_date: string;
  client: {
    id: string;
    name: string;
    email: string;
  } | null;
  assigned_employee: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    // Redirect to login if not authenticated
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchProject = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select(`
            *
          `)
          .eq('id', id)
          .single();

        if (projectError) throw projectError;
        
        // If user is not admin and not assigned to this project, check if they have access
        if (!isAdmin) {
          const { data: isMember, error: memberError } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('project_id', id)
            .eq('user_id', user.id)
            .single();

          if (memberError && memberError.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw memberError;
          }

          if (!isMember) {
            throw new Error('You do not have permission to view this project');
          }
        }

        setProject(projectData as Project);
      } catch (err: any) {
        console.error('Error fetching project:', err);
        setError(err.message || 'Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [id, user, isAdmin, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Project Not Found</h1>
        <p className="text-gray-600">The requested project could not be found.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
          <p className="text-sm text-gray-500 mt-1">Project ID: {project.id}</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
          {project.status.replace('_', ' ').charAt(0).toUpperCase() + project.status.replace('_', ' ').slice(1)}
        </span>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Project Information</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about the project.</p>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                {project.description || 'No description provided.'}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Client</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                {project.client?.name || 'N/A'}
                {project.client?.email && (
                  <span className="block text-gray-500 text-sm">{project.client.email}</span>
                )}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Customer Name</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                {project.customer_name}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                {project.phone_number}
                {project.alt_phone_number && (
                  <span className="block text-gray-500 text-sm">Alt: {project.alt_phone_number}</span>
                )}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Address</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 whitespace-pre-line">
                {project.address}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Start Date</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                {new Date(project.start_date).toLocaleDateString()}
              </dd>
            </div>
            {project.deadline && (
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Deadline</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                  {new Date(project.deadline).toLocaleDateString()}
                </dd>
              </div>
            )}
            {project.assigned_employee && (
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Assigned Employee</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                  {project.assigned_employee.name}
                  <span className="block text-gray-500 text-sm">{project.assigned_employee.email}</span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}