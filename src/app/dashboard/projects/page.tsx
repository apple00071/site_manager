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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Projects</h1>
        <Link
          href="/dashboard/projects/new"
          className="px-5 py-2.5 bg-yellow-500 text-gray-900 rounded-lg flex items-center justify-center hover:bg-yellow-600 transition-colors shadow-sm font-bold"
        >
          <FiPlus className="mr-2 h-5 w-5" /> New Project
        </Link>
      </div>

      <div className="bg-white shadow-sm overflow-hidden rounded-xl border border-gray-100">
        {/* Mobile view - cards */}
        <div className="lg:hidden">
          {projects.map((project) => (
            <div key={project.id} className="border-b border-gray-100 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{project.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{project.description}</p>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span>{project.customer_name || 'N/A'}</span>
                    <span>{project.estimated_completion_date ? new Date(project.estimated_completion_date).toLocaleDateString() : 'No date set'}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    project.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : project.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {project.status.replace('_', ' ')}
                  </span>
                  <div className="flex space-x-1">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors"
                    >
                      <FiEye className="h-4 w-4" />
                    </Link>
                    {isAdmin && (
                      <>
                        <Link
                          href={`/dashboard/projects/${project.id}/edit`}
                          className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <p className="text-base">No projects found</p>
            </div>
          )}
        </div>

        {/* Desktop view - table */}
        <div className="hidden lg:block">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Project
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Customer
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Estimated Completion
              </th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold text-gray-900">{project.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{project.description?.substring(0, 50)}{project.description?.length > 50 ? '...' : ''}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{project.customer_name || 'N/A'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                    project.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : project.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {project.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {project.estimated_completion_date ? new Date(project.estimated_completion_date).toLocaleDateString() : 'No date set'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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