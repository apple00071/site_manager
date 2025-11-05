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
      <div className="space-y-6 animate-pulse-mobile">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="h-8 bg-gray-200 rounded-lg w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded-xl w-32"></div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-gray-100">
              <div className="flex items-center">
                <div className="p-3 sm:p-4 rounded-xl bg-gray-200 w-12 h-12"></div>
                <div className="ml-3 sm:ml-4 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-12"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent projects skeleton */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
            <div className="h-6 bg-gray-200 rounded w-40"></div>
          </div>
          <div className="divide-y divide-gray-100">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full w-20"></div>
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
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
            Welcome, {user?.full_name || 'User'}
          </h1>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/projects/new"
            className="px-4 sm:px-5 py-3 sm:py-2.5 bg-yellow-500 text-gray-900 rounded-xl flex items-center justify-center hover:bg-yellow-600 active:bg-yellow-700 transition-all duration-200 shadow-sm font-bold text-sm sm:text-base touch-target"
          >
            <FiPlus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="whitespace-nowrap">New Project</span>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-gray-100 hover:shadow-card-hover card-hover transition-all duration-200 animate-fade-in">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 rounded-xl bg-yellow-100 text-yellow-700 shadow-sm">
              <FiBriefcase className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="ml-3 sm:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Projects</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.totalProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-gray-100 hover:shadow-card-hover card-hover transition-all duration-200 animate-fade-in">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 rounded-xl bg-blue-100 text-blue-600 shadow-sm">
              <FiAlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="ml-3 sm:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Active Projects</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.activeProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-gray-100 hover:shadow-card-hover card-hover transition-all duration-200 animate-fade-in">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 rounded-xl bg-green-100 text-green-600 shadow-sm">
              <FiCheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="ml-3 sm:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.completedProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-gray-100 hover:shadow-card-hover card-hover transition-all duration-200 animate-fade-in">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 rounded-xl bg-amber-100 text-amber-600 shadow-sm">
              <FiClock className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="ml-3 sm:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Upcoming Deadlines</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.upcomingDeadlines}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden animate-slide-up">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Recent Projects</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {recentProjects.length > 0 ? (
            recentProjects.map((project, index) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 touch-target"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="px-4 sm:px-6 py-4 sm:py-5">
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate leading-tight">
                        {project.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                        Customer: {project.customer_name || 'N/A'}
                      </p>
                      {project.estimated_completion_date && (
                        <p className="text-xs text-gray-500 mt-1 sm:hidden">
                          Due: {new Date(project.estimated_completion_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 ml-2">
                      <span
                        className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
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
                        <span className="text-xs sm:text-sm text-gray-500 hidden sm:inline whitespace-nowrap">
                          {new Date(project.estimated_completion_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-4 sm:px-6 py-8 sm:py-12 text-center text-gray-500">
              <FiBriefcase className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm sm:text-base font-medium">No projects found</p>
              <p className="text-xs sm:text-sm mt-1">Create your first project to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}