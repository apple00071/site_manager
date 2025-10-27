'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { FiPlus, FiClock, FiCheckCircle, FiAlertCircle, FiBriefcase } from 'react-icons/fi';

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    upcomingDeadlines: 0,
  });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch stats
        let projectsQuery = supabase.from('projects').select('*');
        
        if (!isAdmin && user) {
          // First get the project IDs where the user is a member
          const { data: memberProjects } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', user.id);
            
          const projectIds = memberProjects?.map(p => p.project_id) || [];
          
          // Then filter the projects query
          if (projectIds.length > 0) {
            projectsQuery = supabase.from('projects').select('*').in('id', projectIds);
          } else {
            // If no projects, set projects to empty array and skip the query
            setRecentProjects([]);
            setStats({
              totalProjects: 0,
              activeProjects: 0,
              completedProjects: 0,
              upcomingDeadlines: 0,
            });
            setLoading(false);
            return;
          }
        }
        
        const { data: projects } = await projectsQuery;
        
        if (projects) {
          const active = projects.filter(p => p.status !== 'completed').length;
          const completed = projects.filter(p => p.status === 'completed').length;
          const upcoming = projects.filter(p => {
            const deadline = new Date(p.deadline);
            const now = new Date();
            const diff = deadline.getTime() - now.getTime();
            const days = diff / (1000 * 3600 * 24);
            return days <= 7 && days > 0;
          }).length;
          
          setStats({
            totalProjects: projects.length,
            activeProjects: active,
            completedProjects: completed,
            upcomingDeadlines: upcoming,
          });
        }
        
        // Fetch recent projects
        let recentQuery = supabase
          .from('projects')
          .select(`
            id, 
            title, 
            status, 
            deadline,
            clients(name)
          `)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (!isAdmin && user) {
          // First get the project IDs where the user is a member
          const { data: memberProjects } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', user.id);
            
          const projectIds = memberProjects?.map(p => p.project_id) || [];
          
          // Then filter the recent projects query
          recentQuery = recentQuery.in('id', projectIds);
        }
        
        const { data: recentData } = await recentQuery;
        if (recentData) {
          setRecentProjects(recentData);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }
  }, [user, isAdmin]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Welcome, {user?.full_name || 'User'}</h1>
        {isAdmin && (
          <Link 
            href="/dashboard/projects/new" 
            className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center justify-center hover:bg-indigo-700"
          >
            <FiPlus className="mr-2" /> New Project
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-100 text-indigo-600">
              <FiBriefcase className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Projects</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalProjects}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <FiAlertCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Projects</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeProjects}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <FiCheckCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.completedProjects}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <FiClock className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Upcoming Deadlines</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.upcomingDeadlines}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Recent Projects</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentProjects.length > 0 ? (
            recentProjects.map((project) => (
              <Link 
                key={project.id} 
                href={`/dashboard/projects/${project.id}`}
                className="block hover:bg-gray-50"
              >
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{project.title}</h3>
                      <p className="text-sm text-gray-500">Client: {project.clients?.name || 'N/A'}</p>
                    </div>
                    <div className="flex items-center">
                      <span 
                        className={`px-2 py-1 text-xs rounded-full ${
                          project.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : project.status === 'in_progress' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {project.status}
                      </span>
                      {project.deadline && (
                        <span className="ml-2 text-xs text-gray-500">
                          {new Date(project.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-4 text-center text-gray-500">
              No projects found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}