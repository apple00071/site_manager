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
          // For employees, get projects where they are assigned via assigned_employee_id
          projectsQuery = supabase
            .from('projects')
            .select('*')
            .eq('assigned_employee_id', user.id);
        }
        
        const { data: projects } = await projectsQuery;
        
        if (projects) {
          const active = projects.filter(p => p.status !== 'completed').length;
          const completed = projects.filter(p => p.status === 'completed').length;
          const upcoming = projects.filter(p => {
            const deadline = new Date(p.estimated_completion_date);
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
            estimated_completion_date,
            customer_name
          `)
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (!isAdmin && user) {
          // For employees, get projects where they are assigned via assigned_employee_id
          recentQuery = recentQuery.eq('assigned_employee_id', user.id);
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Welcome, {user?.full_name || 'User'}</h1>
        {isAdmin && (
          <Link
            href="/dashboard/projects/new"
            className="px-5 py-2.5 bg-yellow-500 text-gray-900 rounded-lg flex items-center justify-center hover:bg-yellow-600 transition-colors shadow-sm font-bold"
          >
            <FiPlus className="mr-2 h-5 w-5" /> New Project
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-100 text-yellow-700">
              <FiBriefcase className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
              <FiAlertCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-100 text-green-600">
              <FiCheckCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
              <FiClock className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Upcoming Deadlines</p>
              <p className="text-2xl font-bold text-gray-900">{stats.upcomingDeadlines}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Recent Projects</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentProjects.length > 0 ? (
            recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block hover:bg-gray-50 transition-colors"
              >
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">{project.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">Customer: {project.customer_name || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          project.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : project.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {project.status.replace('_', ' ')}
                      </span>
                      {project.estimated_completion_date && (
                        <span className="text-sm text-gray-500 hidden sm:inline">
                          {new Date(project.estimated_completion_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              <p className="text-base">No projects found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}