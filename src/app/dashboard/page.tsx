'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { FiPlus, FiClock, FiCheckCircle, FiAlertCircle, FiBriefcase, FiCheck, FiPlay, FiPause, FiUsers, FiUser } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/Toast';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import AttendanceWidget from '@/components/attendance/AttendanceWidget';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  activeProjects: number;
  completedProjects: number;
  projectNames: string[];
  isFree: boolean;
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { hasPermission } = useUserPermissions();
  const { showToast } = useToast();
  const { setTitle, setSubtitle } = useHeaderTitle();
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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Set header title
  useEffect(() => {
    setTitle('Dashboard');
    setSubtitle(null);
  }, [setTitle, setSubtitle]);

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

        // Fetch all employees/team members and their project assignments
        try {
          // Fetch all users via API (uses admin client to bypass RLS)
          const usersResponse = await fetch('/api/admin/users');
          let allUsers: any[] = [];

          if (usersResponse.ok) {
            allUsers = await usersResponse.json();
            // Filter out customers and admins (admins assign work, not receive it)
            allUsers = allUsers.filter((u: any) => u.role !== 'customer' && u.role !== 'admin');
          } else {
            console.error('Error fetching users:', usersResponse.status);
          }

          if (allUsers && allUsers.length > 0) {
            // Create a map to track each user's projects
            const userProjectMap = new Map<string, { active: Set<string>, completed: Set<string> }>();

            // Initialize map for all users with Sets to avoid duplicates
            allUsers.forEach((u: any) => {
              userProjectMap.set(u.id, { active: new Set(), completed: new Set() });
            });

            // Create a project lookup for easy access by ID
            const projectLookup = new Map<string, { title: string, status: string }>();
            if (Array.isArray(projects)) {
              projects.forEach((project: any) => {
                projectLookup.set(project.id, { title: project.title, status: project.status });

                // Map main designer (assigned_employee_id)
                const employeeId = project.assigned_employee_id;
                if (employeeId && userProjectMap.has(employeeId)) {
                  const userProjects = userProjectMap.get(employeeId)!;
                  if (project.status === 'completed') {
                    userProjects.completed.add(project.title);
                  } else {
                    userProjects.active.add(project.title);
                  }
                }
              });
            }

            // Fetch project_members to get all team assignments (via API to bypass RLS)
            try {
              const membersResponse = await fetch('/api/project-members/all');
              if (membersResponse.ok) {
                const projectMembers = await membersResponse.json();

                if (projectMembers && Array.isArray(projectMembers)) {
                  projectMembers.forEach((member: any) => {
                    const project = projectLookup.get(member.project_id);
                    if (project && userProjectMap.has(member.user_id)) {
                      const userProjects = userProjectMap.get(member.user_id)!;
                      if (project.status === 'completed') {
                        userProjects.completed.add(project.title);
                      } else {
                        userProjects.active.add(project.title);
                      }
                    }
                  });
                }
              }
            } catch (membersErr) {
              console.error('Error fetching project members:', membersErr);
            }

            // Build team members array
            const teamMembersData: TeamMember[] = allUsers.map((u: any) => {
              const userProjects = userProjectMap.get(u.id) || { active: new Set<string>(), completed: new Set<string>() };
              const activeArray = Array.from(userProjects.active);
              const completedArray = Array.from(userProjects.completed);
              return {
                id: u.id,
                name: u.full_name || 'Unknown',
                email: u.email || '',
                role: u.role || 'employee',
                activeProjects: activeArray.length,
                completedProjects: completedArray.length,
                projectNames: activeArray,
                isFree: activeArray.length === 0,
              };
            });

            // Sort: free members first, then by active projects (ascending)
            teamMembersData.sort((a, b) => {
              if (a.isFree && !b.isFree) return -1;
              if (!a.isFree && b.isFree) return 1;
              return a.activeProjects - b.activeProjects;
            });

            setTeamMembers(teamMembersData);
          }
        } catch (error) {
          console.error('Error fetching team members:', error);
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

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
              <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
              <div className="h-40 bg-gray-100 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate percentages for charts
  const projectCompletionPercent = stats.totalProjects > 0
    ? Math.round((stats.completedProjects / stats.totalProjects) * 100)
    : 0;
  const taskCompletionPercent = stats.totalTasks > 0
    ? Math.round((stats.doneTasks / stats.totalTasks) * 100)
    : 0;

  // Generate avatar color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Get initials from name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
            Welcome, {user?.full_name || 'User'}
          </h1>
        </div>
      </div>

      {/* Stats - Compact Single Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
        {/* Project Stats */}
        <Link href="/dashboard/projects?status=all" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-700">
              <FiBriefcase className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">Projects</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalProjects}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/projects?status=in_progress" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <FiAlertCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">Active</p>
              <p className="text-lg font-bold text-gray-900">{stats.activeProjects}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/projects?status=completed" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <FiCheckCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">Done</p>
              <p className="text-lg font-bold text-gray-900">{stats.completedProjects}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/projects" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600">
              <FiClock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">Due Soon</p>
              <p className="text-lg font-bold text-gray-900">{stats.upcomingDeadlines}</p>
            </div>
          </div>
        </Link>

        {/* Task Stats */}
        <Link href="/dashboard/tasks" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
              <FiCheckCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">Tasks</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalTasks}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/tasks" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-100 text-gray-700">
              <FiClock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">To Do</p>
              <p className="text-lg font-bold text-gray-900">{stats.todoTasks}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/tasks" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <FiPlay className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">In Progress</p>
              <p className="text-lg font-bold text-gray-900">{stats.inProgressTasks}</p>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/tasks" className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <FiCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">Completed</p>
              <p className="text-lg font-bold text-gray-900">{stats.doneTasks}</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Visual Progress Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Project Status Chart */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h3>
          <div className="flex items-center justify-center">
            <div className="relative w-40 h-40">
              {/* SVG Donut Chart */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                />
                {/* Completed segment (Green) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="12"
                  strokeDasharray={`${(stats.completedProjects / Math.max(stats.totalProjects, 1)) * 251.2} 251.2`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                {/* Active segment (Blue) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="12"
                  strokeDasharray={`${(stats.activeProjects / Math.max(stats.totalProjects, 1)) * 251.2} 251.2`}
                  strokeDashoffset={`${-((stats.completedProjects / Math.max(stats.totalProjects, 1)) * 251.2)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{stats.totalProjects}</span>
                <span className="text-xs text-gray-500">Total</span>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Completed ({stats.completedProjects})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">Active ({stats.activeProjects})</span>
            </div>
          </div>
        </div>

        {/* Task Status Chart */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Status</h3>
          <div className="flex items-center justify-center">
            <div className="relative w-40 h-40">
              {/* SVG Donut Chart */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                />
                {/* Done segment (Green) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="12"
                  strokeDasharray={`${(stats.doneTasks / Math.max(stats.totalTasks, 1)) * 251.2} 251.2`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                {/* In Progress segment (Blue) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="12"
                  strokeDasharray={`${(stats.inProgressTasks / Math.max(stats.totalTasks, 1)) * 251.2} 251.2`}
                  strokeDashoffset={`${-((stats.doneTasks / Math.max(stats.totalTasks, 1)) * 251.2)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                {/* To Do segment (Gray) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="12"
                  strokeDasharray={`${(stats.todoTasks / Math.max(stats.totalTasks, 1)) * 251.2} 251.2`}
                  strokeDashoffset={`${-(((stats.doneTasks + stats.inProgressTasks) / Math.max(stats.totalTasks, 1)) * 251.2)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{stats.totalTasks}</span>
                <span className="text-xs text-gray-500">Total</span>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Done ({stats.doneTasks})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">In Progress ({stats.inProgressTasks})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <span className="text-sm text-gray-600">To Do ({stats.todoTasks})</span>
            </div>
          </div>
        </div>

        {/* Completion Progress */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Completion Progress</h3>

          {/* Project Completion */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Projects</span>
              <span className="text-sm font-bold text-yellow-600">{projectCompletionPercent}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${projectCompletionPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.completedProjects} of {stats.totalProjects} completed
            </p>
          </div>

          {/* Task Completion */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Tasks</span>
              <span className="text-sm font-bold text-green-600">{taskCompletionPercent}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${taskCompletionPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.doneTasks} of {stats.totalTasks} completed
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{stats.upcomingDeadlines}</p>
              <p className="text-xs text-gray-600">Due This Week</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.inProgressTasks}</p>
              <p className="text-xs text-gray-600">In Progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Overview - Admin Only, Desktop Only */}
      {isAdmin && (<div className="hidden lg:block">
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                <FiUsers className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Team Overview</h3>
                <p className="text-xs text-gray-500">{teamMembers.length} members • {teamMembers.filter(m => !m.isFree).length} assigned</p>
              </div>
            </div>
            <Link
              href="/dashboard/settings"
              className="text-sm text-yellow-600 hover:text-yellow-700 font-medium"
            >
              Manage Team
            </Link>
          </div>

          {teamMembers.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Team Member</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Current Projects</th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {teamMembers.slice(0, 20).map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getAvatarColor(member.name)} flex items-center justify-center text-white font-medium text-xs`}>
                            {getInitials(member.name)}
                          </div>
                          <span className="font-medium text-gray-900">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {member.projectNames.length > 0
                            ? member.projectNames.slice(0, 2).join(', ') + (member.projectNames.length > 2 ? ` +${member.projectNames.length - 2}` : '')
                            : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${member.isFree
                          ? 'bg-green-50 text-green-700'
                          : 'bg-blue-50 text-blue-700'
                          }`}>
                          {member.isFree ? 'Available' : `${member.activeProjects} Project${member.activeProjects !== 1 ? 's' : ''}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/tasks?assign=${member.id}`}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
                        >
                          <FiPlus className="h-3 w-3 mr-1" />
                          Task
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teamMembers.length > 20 && (
                <div className="px-4 py-2 bg-gray-50 text-center border-t border-gray-200">
                  <span className="text-sm text-gray-500">+{teamMembers.length - 20} more team members</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 border border-gray-200 rounded-xl">
              <FiUser className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">No team members found</p>
              <p className="text-sm text-gray-400 mt-1">Add employees to see team availability</p>
            </div>
          )}
        </div>
      </div>)}
    </div>
  );
}
