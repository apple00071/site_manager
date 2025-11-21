'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { FiCheckCircle, FiClock, FiAlertCircle } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';

export default function MyTasksPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyTasks = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Get projects where the user is a member and has mark_done permission
        const { data: memberData, error: memberError } = await supabase
          .from('project_members')
          .select('project_id, permissions')
          .eq('user_id', user.id)
          .filter('permissions->mark_done', 'eq', true);

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
          .not('status', 'eq', 'completed')
          .order('deadline', { ascending: true });

        if (projectsError) throw projectsError;
        
        setProjects(projectsData || []);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setError('Failed to load your tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchMyTasks();
  }, [user]);

  const handleUpdateStatus = async (projectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId);

      if (error) throw error;

      // Update local state
      setProjects(projects.map(project => 
        project.id === projectId 
          ? { ...project, status: newStatus } 
          : project
      ));
    } catch (error) {
      console.error('Error updating project status:', error);
      setError('Failed to update task status');
    }
  };

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
        <h1 className="text-2xl font-bold text-gray-900 lg:hidden">My Tasks</h1>
      </div>

      {projects.length > 0 ? (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <ul className="divide-y divide-gray-200">
            {projects.map((project) => (
              <li key={project.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <Link 
                      href={`/dashboard/projects/${project.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-900 truncate"
                    >
                      {project.title}
                    </Link>
                    <p className="text-sm text-gray-500">
                      Customer: {project.customer_name || 'N/A'}
                    </p>
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      {project.deadline ? (
                        <>
                          <FiClock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                          <p>
                            Due: {formatDateIST(project.deadline)}

                            {new Date(project.deadline) < new Date() && (
                              <span className="ml-2 text-red-600 font-medium flex items-center">
                                <FiAlertCircle className="mr-1" /> Overdue
                              </span>
                            )}
                          </p>
                        </>
                      ) : (
                        <p>No deadline</p>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex">
                    <div className="flex space-x-2">
                      {project.status !== 'in_progress' && (
                        <button
                          onClick={() => handleUpdateStatus(project.id, 'in_progress')}
                          className="px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                        >
                          Mark In Progress
                        </button>
                      )}
                      {project.status !== 'completed' && (
                        <button
                          onClick={() => handleUpdateStatus(project.id, 'completed')}
                          className="px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200 flex items-center"
                        >
                          <FiCheckCircle className="mr-1" /> Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="px-4 py-12 sm:px-6 text-center">
            <p className="text-sm text-gray-500">You don't have any pending tasks.</p>
            <p className="mt-1 text-sm text-gray-500">Tasks will appear here when you're assigned to projects with task management permissions.</p>
          </div>
        </div>
      )}
    </div>
  );
}