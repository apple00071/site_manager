'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { FiPlus, FiClock, FiCheckCircle, FiAlertCircle, FiBriefcase, FiCheck, FiPlay, FiPause } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/Toast';

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    upcomingDeadlines: 0,
    totalTasks: 0,
    todoTasks: 0,
    inProgressTasks: 0,
    doneTasks: 0,
  });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch stats using API route
        let projects: any[] = [];

        try {
          const response = await fetch('/api/admin/projects');
          if (response.ok) {
            projects = await response.json();
          }
        } catch (error) {
          console.error('Error fetching projects:', error);
        }

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

          setStats(prevStats => ({
            ...prevStats,
            totalProjects: projects.length,
            activeProjects: active,
            completedProjects: completed,
            upcomingDeadlines: upcoming,
          }));
        }

        // Set recent projects from the same data (first 5 projects)
        const recentData = projects.slice(0, 5);
        setRecentProjects(recentData);

        // Fetch recent tasks
        try {
          const tasksResponse = await fetch('/api/tasks/all?t=' + Date.now());
          if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json();

            // More defensive handling
            let tasksArray = [];

            if (Array.isArray(tasksData)) {
              tasksArray = tasksData;
            } else if (tasksData && typeof tasksData === 'object') {
              // Try different possible properties
              tasksArray = tasksData.tasks || tasksData.data || tasksData.results || [];
            }


            // Ensure it's an array before slicing
            if (Array.isArray(tasksArray)) {
              setRecentTasks(tasksArray.slice(0, 5)); // Get first 5 tasks

              // Calculate task stats
              const taskStats = {
                totalTasks: tasksArray.length,
                todoTasks: tasksArray.filter(t => t.status === 'todo').length,
                inProgressTasks: tasksArray.filter(t => t.status === 'in_progress').length,
                doneTasks: tasksArray.filter(t => t.status === 'done').length,
              };

              // Update stats with task data
              setStats(prevStats => ({
                ...prevStats,
                ...taskStats
              }));

            } else {
              console.error('Tasks array is not an array:', tasksArray);
              setRecentTasks([]); // Set empty array as fallback
            }
          } else {
            console.error('Tasks response not ok:', tasksResponse.status);
            setRecentTasks([]);
          }
        } catch (error) {
          console.error('Error fetching tasks:', error);
          setRecentTasks([]); // Set empty array on error
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
            Welcome, {user?.full_name || 'User'}
          </h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4 sm:gap-6">
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

      {/* Task Stats */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-gray-100 hover:shadow-card-hover card-hover transition-all duration-200 animate-fade-in">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 rounded-xl bg-purple-100 text-purple-700 shadow-sm">
              <FiCheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="ml-3 sm:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Tasks</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.totalTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-gray-100 hover:shadow-card-hover card-hover transition-all duration-200 animate-fade-in">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 rounded-xl bg-gray-100 text-gray-700 shadow-sm">
              <FiClock className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="ml-3 sm:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">To Do</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.todoTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-gray-100 hover:shadow-card-hover card-hover transition-all duration-200 animate-fade-in">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 rounded-xl bg-blue-100 text-blue-600 shadow-sm">
              <FiPlay className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="ml-3 sm:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">In Progress</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.inProgressTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-card border border-gray-100 hover:shadow-card-hover card-hover transition-all duration-200 animate-fade-in">
          <div className="flex items-center">
            <div className="p-3 sm:p-4 rounded-xl bg-green-100 text-green-600 shadow-sm">
              <FiCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="ml-3 sm:ml-4 flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Completed</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{stats.doneTasks}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Tasks on Left, Recent Projects on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks - Left Column */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden animate-slide-up">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Recent Tasks</h2>
            <Link
              href="/dashboard/tasks"
              className="text-sm text-yellow-600 hover:text-yellow-700 font-medium"
            >
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentTasks.length > 0 ? (
              recentTasks.map((task, index) => (
                <div
                  key={task.id}
                  className="px-4 sm:px-6 py-4 sm:py-5 hover:bg-gray-50 transition-all duration-200"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {task.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        {task.step && task.step.project ? (
                          <>
                            <span>{task.step.project.title}</span>
                            <span>•</span>
                            <span>{task.step.title}</span>
                          </>
                        ) : (
                          <span className="italic">Daily Task</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${task.status === 'todo' ? 'bg-gray-100 text-gray-700' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            task.status === 'blocked' ? 'bg-red-100 text-red-700' :
                              'bg-green-100 text-green-700'
                          }`}>
                          {task.status === 'todo' ? 'To Do' :
                            task.status === 'in_progress' ? 'In Progress' :
                              task.status === 'blocked' ? 'Blocked' : 'Done'}
                        </span>
                        {task.priority && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${task.priority === 'low' ? 'bg-green-100 text-green-700' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {task.status !== 'done' && (
                        <button
                          onClick={async () => {
                            // Optimistic update - immediately update UI
                            const previousTasks = [...recentTasks];
                            setRecentTasks(prev => prev.map(t =>
                              t.id === task.id ? { ...t, status: 'done' } : t
                            ));
                            setStats(prev => ({
                              ...prev,
                              doneTasks: prev.doneTasks + 1,
                              todoTasks: task.status === 'todo' ? prev.todoTasks - 1 : prev.todoTasks,
                              inProgressTasks: task.status === 'in_progress' ? prev.inProgressTasks - 1 : prev.inProgressTasks,
                            }));

                            try {
                              const response = await fetch('/api/tasks', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: task.id,
                                  status: 'done',
                                  step_id: task.step?.id || null
                                }),
                              });

                              if (!response.ok) {
                                // Revert on error
                                setRecentTasks(previousTasks);
                                setStats(prev => ({
                                  ...prev,
                                  doneTasks: prev.doneTasks - 1,
                                  todoTasks: task.status === 'todo' ? prev.todoTasks + 1 : prev.todoTasks,
                                  inProgressTasks: task.status === 'in_progress' ? prev.inProgressTasks + 1 : prev.inProgressTasks,
                                }));
                                showToast('error', 'Failed to update task status');
                              }
                            } catch (error) {
                              // Revert on error
                              setRecentTasks(previousTasks);
                              setStats(prev => ({
                                ...prev,
                                doneTasks: prev.doneTasks - 1,
                                todoTasks: task.status === 'todo' ? prev.todoTasks + 1 : prev.todoTasks,
                                inProgressTasks: task.status === 'in_progress' ? prev.inProgressTasks + 1 : prev.inProgressTasks,
                              }));
                              console.error('Error updating task:', error);
                              showToast('error', 'Failed to update task');
                            }
                          }}
                          className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                          title="Mark as Done"
                        >
                          <FiCheck className="h-4 w-4" />
                        </button>
                      )}
                      {task.status === 'todo' && (
                        <button
                          onClick={async () => {
                            // Optimistic update - immediately update UI
                            const previousTasks = [...recentTasks];
                            setRecentTasks(prev => prev.map(t =>
                              t.id === task.id ? { ...t, status: 'in_progress' } : t
                            ));
                            setStats(prev => ({
                              ...prev,
                              todoTasks: prev.todoTasks - 1,
                              inProgressTasks: prev.inProgressTasks + 1,
                            }));

                            try {
                              const response = await fetch('/api/tasks', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: task.id,
                                  status: 'in_progress',
                                  step_id: task.step?.id || null
                                }),
                              });

                              if (!response.ok) {
                                // Revert on error
                                setRecentTasks(previousTasks);
                                setStats(prev => ({
                                  ...prev,
                                  todoTasks: prev.todoTasks + 1,
                                  inProgressTasks: prev.inProgressTasks - 1,
                                }));
                                alert('Failed to update task status');
                              }
                            } catch (error) {
                              // Revert on error
                              setRecentTasks(previousTasks);
                              setStats(prev => ({
                                ...prev,
                                todoTasks: prev.todoTasks + 1,
                                inProgressTasks: prev.inProgressTasks - 1,
                              }));
                              console.error('Error updating task:', error);
                              showToast('error', 'Failed to update task');
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                          title="Start Task"
                        >
                          <FiPlay className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 sm:px-6 py-8 sm:py-12 text-center text-gray-500">
                <FiCheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm sm:text-base font-medium">No tasks found</p>
                <p className="text-xs sm:text-sm mt-1">Create your first task to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Projects - Right Column */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden animate-slide-up">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Recent Projects</h2>
            <Link
              href="/dashboard/projects"
              className="text-sm text-yellow-600 hover:text-yellow-700 font-medium"
            >
              View All
            </Link>
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
                    <div className="flex flex-col gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate leading-tight">
                          {project.title}
                        </h3>
                        <div className="mt-1 text-xs sm:text-sm text-gray-500">
                          <span className="font-medium">{project.customer_name || 'N/A'}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-600">
                          {project.flat_number && (
                            <div>
                              <span className="text-gray-500">Flat No:</span>
                              <span className="ml-1 text-gray-900 font-medium">{project.flat_number}</span>
                            </div>
                          )}
                          {project.phone_number && (
                            <div>
                              <span className="text-gray-500">Phone:</span>
                              <a href={`tel:${project.phone_number}`} className="ml-1 text-blue-600 hover:text-blue-800 font-medium">
                                {project.phone_number}
                              </a>
                            </div>
                          )}
                          {project.property_type && (
                            <div>
                              <span className="text-gray-500">Type:</span>
                              <span className="ml-1 text-gray-900 font-medium capitalize">{project.property_type.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {project.area_sqft && (
                            <div>
                              <span className="text-gray-500">Area:</span>
                              <span className="ml-1 text-gray-900 font-medium">{project.area_sqft} sq ft</span>
                            </div>
                          )}
                          {project.estimated_completion_date && (
                            <div>
                              <span className="text-gray-500">Est. Completion:</span>
                              <span className="ml-1 text-gray-900 font-medium">
                                {formatDateIST(project.estimated_completion_date)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2">
                        {project.workflow_stage && (
                          <span
                            className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${project.workflow_stage === 'design_completed'
                              ? 'bg-green-100 text-green-700'
                              : project.workflow_stage === 'design_in_progress'
                                ? 'bg-blue-100 text-blue-700'
                                : project.workflow_stage === 'design_pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                          >
                            {project.workflow_stage.replace(/_/g, ' ')}
                          </span>
                        )}
                        <span className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${project.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : project.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                          }`}>
                          {project.status.replace('_', ' ')}
                        </span>
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
    </div>
  );
}