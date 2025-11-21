'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { FiFileText, FiClock } from 'react-icons/fi';

export default function MyProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyProjects = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Get projects where the user is a member
        const { data: memberData, error: memberError } = await supabase
          .from('project_members')
          .select('project_id, permissions')
          .eq('user_id', user.id);

        if (memberError) throw memberError;
        
        if (!memberData || memberData.length === 0) {
          setProjects([]);
          return;
        }

        const projectIds = memberData.map(m => m.project_id);
        
        // Fetch full project details
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .in('id', projectIds)
          .order('deadline', { ascending: true });

        if (projectsError) throw projectsError;
        
        // Combine project data with permissions
        const projectsWithPermissions = projectsData?.map(project => {
          const memberInfo = memberData.find(m => m.project_id === project.id);
          return {
            ...project,
            permissions: memberInfo?.permissions || {}
          };
        }) || [];
        
        setProjects(projectsWithPermissions);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to load your projects');
      } finally {
        setLoading(false);
      }
    };

    fetchMyProjects();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 lg:hidden">My Projects</h1>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link 
              key={project.id} 
              href={`/dashboard/projects/${project.id}`}
              className="block"
            >
              <div className="bg-white shadow overflow-hidden rounded-lg hover:shadow-md transition-shadow duration-200">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 truncate">{project.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      project.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : project.status === 'in_progress' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 truncate">
                    Customer: {project.customer_name || 'N/A'}
                  </p>
                  <div className="mt-4 flex items-center text-sm text-gray-500">
                    <FiClock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                    <p>
                      {project.deadline 
                        ? `Due: ${new Date(project.deadline).toLocaleDateString()}`
                        : 'No deadline'}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.permissions?.view && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        View
                      </span>
                    )}
                    {project.permissions?.edit && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Edit
                      </span>
                    )}
                    {project.permissions?.upload && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Upload
                      </span>
                    )}
                    {project.permissions?.mark_done && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Mark Done
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="flex items-center">
                    <FiFileText className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">View project details</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="px-4 py-12 sm:px-6 text-center">
            <p className="text-sm text-gray-500">You don't have any assigned projects yet.</p>
            <p className="mt-1 text-sm text-gray-500">Projects assigned to you by administrators will appear here.</p>
          </div>
        </div>
      )}
    </div>
  );
}