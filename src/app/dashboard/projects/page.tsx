'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { FiPlus, FiEdit2, FiTrash2, FiEye } from 'react-icons/fi';

export default function ProjectsPage() {
  const { user, isAdmin } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Use the API route to fetch projects
        const response = await fetch('/api/admin/projects');
        
        if (!response.ok) {
          // Handle 401 Unauthorized by redirecting to login
          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }
          
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to fetch projects');
        }
        
        const projectsData = await response.json();
        
        // If no projects and not admin, show empty state
        if (!Array.isArray(projectsData) || (projectsData.length === 0 && !isAdmin)) {
          setProjects([]);
          return;
        }
        
        let projectsWithClient = projectsData;
        const clientIds = [...new Set(projectsData.map((p: any) => p.client_id).filter(Boolean))];
        
        if (clientIds.length > 0) {
          const { data: clientsData, error: clientsError } = await supabase
            .from('clients')
            .select('id, name')
            .in('id', clientIds);
          
          if (!clientsError && clientsData) {
            const nameById = new Map(clientsData.map((c: any) => [c.id, c.name]));
            projectsWithClient = projectsData.map((p: any) => ({
              ...p,
              client_name: nameById.get(p.client_id) || 'N/A',
            }));
          }
        }
        
        setProjects(projectsWithClient);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProjects();
    }
  }, [user, isAdmin]);

  const handleDeleteProject = async (projectId: string) => {
    if (!isAdmin) return;
    
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId);

        if (error) throw error;
        
        // Remove from local state
        setProjects(projects.filter(p => p.id !== projectId));
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse-mobile">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="h-8 bg-gray-200 rounded-lg w-32 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded-xl w-32"></div>
        </div>

        {/* Projects skeleton */}
        <div className="bg-white shadow-card overflow-hidden rounded-2xl border border-gray-100">
          <div className="lg:hidden">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border-b border-gray-100 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
                    <div className="flex gap-4">
                      <div className="h-3 bg-gray-200 rounded w-20"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="hidden lg:block">
            <div className="bg-gray-50 px-6 py-4">
              <div className="flex justify-between">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded w-20"></div>
                ))}
              </div>
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-6 py-4 border-b border-gray-100">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-40"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="flex gap-2">
                    <div className="h-4 w-4 bg-gray-200 rounded"></div>
                    <div className="h-4 w-4 bg-gray-200 rounded"></div>
                    <div className="h-4 w-4 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Manage and track all your interior design projects
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="px-4 sm:px-5 py-3 sm:py-2.5 bg-yellow-500 text-gray-900 rounded-xl flex items-center justify-center hover:bg-yellow-600 active:bg-yellow-700 transition-all duration-200 shadow-sm font-bold text-sm sm:text-base touch-target"
        >
          <FiPlus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          <span className="whitespace-nowrap">New Project</span>
        </Link>
      </div>

      <div className="bg-white shadow-card overflow-hidden rounded-2xl border border-gray-100 animate-slide-up">
        {/* Mobile view - cards */}
        <div className="lg:hidden">
          {projects.map((project, index) => (
            <div 
              key={project.id} 
              className="border-b border-gray-100 last:border-b-0 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="block p-4 sm:p-5 hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 touch-target"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate leading-tight">
                      {project.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                    <div className="mt-3 flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-4 text-xs text-gray-500">
                      <span className="flex items-center">
                        <span className="font-medium">Customer:</span>
                        <span className="ml-1 truncate">{project.customer_name || 'N/A'}</span>
                      </span>
                      {project.estimated_completion_date && (
                        <span className="flex items-center">
                          <span className="font-medium">Due:</span>
                          <span className="ml-1">{new Date(project.estimated_completion_date).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-2">
                    <span className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                      project.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : project.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </Link>
              
              {/* Action buttons for mobile */}
              {isAdmin && (
                <div className="px-4 sm:px-5 pb-4 flex justify-end gap-2">
                  <Link
                    href={`/dashboard/projects/${project.id}/edit`}
                    className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 active:bg-yellow-100 rounded-xl transition-all duration-200 touch-target"
                    title="Edit project"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 active:bg-red-100 rounded-xl transition-all duration-200 touch-target"
                    title="Delete project"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {projects.length === 0 && (
            <div className="p-8 sm:p-12 text-center text-gray-500">
              <FiPlus className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm sm:text-base font-medium">No projects found</p>
              <p className="text-xs sm:text-sm mt-1">Create your first project to get started</p>
            </div>
          )}
        </div>

        {/* Desktop view - table */}
        <div className="hidden lg:block">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Project Name
              </th>
              <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Customer
              </th>
              <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Flat No
              </th>
              <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Phone
              </th>
              <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Designing Status
              </th>
              <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Site Status
              </th>
              <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Est. Completion
              </th>
              <th scope="col" className="px-4 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4">
                  <div className="text-sm font-semibold text-gray-900">{project.title}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{project.customer_name || 'N/A'}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{project.flat_number || '-'}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{project.phone_number || '-'}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                    project.workflow_stage === 'design_completed'
                      ? 'bg-green-100 text-green-700'
                      : project.workflow_stage === 'design_in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : project.workflow_stage === 'design_pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {project.workflow_stage ? project.workflow_stage.replace(/_/g, ' ') : 'Not Started'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                    project.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : project.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {project.status ? project.status.replace(/_/g, ' ') : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                  {project.estimated_completion_date ? new Date(project.estimated_completion_date).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="text-yellow-600 hover:text-yellow-700 mr-4 inline-flex items-center"
                  >
                    <FiEye className="h-4 w-4" />
                  </Link>
                  {isAdmin && (
                    <>
                      <Link
                        href={`/dashboard/projects/${project.id}/edit`}
                        className="text-yellow-600 hover:text-yellow-700 mr-4 inline-flex items-center"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-red-600 hover:text-red-700 inline-flex items-centers"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <p className="text-base">No projects found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}