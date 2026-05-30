'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FiPlus, FiCheckCircle, FiBriefcase,
  FiUsers, FiArrowRight, FiCalendar,
  FiAlertCircle, FiAlertTriangle,
  FiVolume2, FiCamera, FiTrendingUp
} from 'react-icons/fi';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import AttendanceWidget from '@/components/attendance/AttendanceWidget';
import { useUserPermissions } from '@/hooks/useUserPermissions';

// Brand color
const BRAND = '#F3C133';
const BRAND_LIGHT = '#FEF9EC';

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

// Animated counter
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// KPI Stat Card
function StatCard({
  icon, label, value, iconBg, iconColor, href, sub
}: {
  icon: React.ReactNode; label: string; value: number;
  iconBg: string; iconColor: string; href: string; sub?: string;
}) {
  const animated = useCountUp(value);
  return (
    <Link
      href={href}
      className="group bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <FiArrowRight className="h-4 w-4 text-gray-200 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{animated}</p>
        <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </Link>
  );
}


const AVATAR_COLORS = [
  '#F3C133', '#3B82F6', '#10B981', '#8B5CF6',
  '#EC4899', '#06B6D4', '#EF4444', '#6366F1'
];

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { setTitle, setSubtitle } = useHeaderTitle();

  const [stats, setStats] = useState({
    totalProjects: 0, activeProjects: 0, completedProjects: 0, upcomingDeadlines: 0,
    totalTasks: 0, todoTasks: 0, inProgressTasks: 0, doneTasks: 0,
    totalSnags: 0, openSnags: 0, resolvedSnags: 0,
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [updatesList, setUpdatesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  useEffect(() => {
    setTitle('Dashboard');
    setSubtitle(null);
  }, [setTitle, setSubtitle]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Projects
        let projects: any[] = [];
        try {
          const res = await fetch('/api/admin/projects');
          if (res.ok) projects = await res.json();
        } catch { }

        if (projects.length > 0) {
          setProjectsList(projects);
          setStats(prev => ({
            ...prev,
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status !== 'completed').length,
            completedProjects: projects.filter(p => p.status === 'completed').length,
            upcomingDeadlines: projects.filter(p => {
              const days = (new Date(p.estimated_completion_date).getTime() - Date.now()) / 86400000;
              return days <= 7 && days > 0;
            }).length,
          }));
        }

        // Tasks
        try {
          const res = await fetch('/api/tasks/all?t=' + Date.now());
          if (res.ok) {
            const raw = await res.json();
            const tasks = Array.isArray(raw) ? raw : (raw?.tasks || raw?.data || []);
            if (Array.isArray(tasks)) {
              setTasksList(tasks);
              setStats(prev => ({
                ...prev,
                totalTasks: tasks.length,
                todoTasks: tasks.filter(t => t.status === 'todo').length,
                inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
                doneTasks: tasks.filter(t => t.status === 'done').length,
              }));
            }
          }
        } catch { }

        // Snags
        try {
          const res = await fetch('/api/snags?all=true');
          if (res.ok) {
            const raw = await res.json();
            const snags = Array.isArray(raw) ? raw : (raw?.snags || raw?.data || []);
            if (Array.isArray(snags)) {
              setStats(prev => ({
                ...prev,
                totalSnags: snags.length,
                openSnags: snags.filter((s: any) => s.status === 'open' || s.status === 'assigned').length,
                resolvedSnags: snags.filter((s: any) => s.status === 'resolved' || s.status === 'verified').length,
              }));
            }
          }
        } catch { }

        // Project Updates (Work Progress Updates)
        try {
          const res = await fetch('/api/project-updates?limit=6');
          if (res.ok) {
            const raw = await res.json();
            setUpdatesList(raw.updates || []);
          }
        } catch (err) {
          console.error('Error fetching project updates:', err);
        }

        // Team
        try {
          const res = await fetch('/api/admin/users');
          if (!res.ok) return;
          let allUsers: any[] = await res.json();
          // Exclude disabled users, customers, and admins
          allUsers = allUsers.filter((u: any) =>
            u.is_active !== false &&
            u.role !== 'customer' &&
            u.role !== 'admin'
          );

          const userProjectMap = new Map<string, { active: Set<string>; completed: Set<string> }>();
          allUsers.forEach((u: any) => userProjectMap.set(u.id, { active: new Set(), completed: new Set() }));

          const projectLookup = new Map<string, { title: string; status: string }>();
          projects.forEach((p: any) => {
            projectLookup.set(p.id, { title: p.title, status: p.status });
            if (p.assigned_employee_id && userProjectMap.has(p.assigned_employee_id)) {
              const up = userProjectMap.get(p.assigned_employee_id)!;
              p.status === 'completed' ? up.completed.add(p.title) : up.active.add(p.title);
            }
          });

          try {
            const mRes = await fetch('/api/project-members/all');
            if (mRes.ok) {
              const members = await mRes.json();
              if (Array.isArray(members)) {
                members.forEach((m: any) => {
                  const proj = projectLookup.get(m.project_id);
                  if (proj && userProjectMap.has(m.user_id)) {
                    const up = userProjectMap.get(m.user_id)!;
                    proj.status === 'completed' ? up.completed.add(proj.title) : up.active.add(proj.title);
                  }
                });
              }
            }
          } catch { }

          const teamData: TeamMember[] = allUsers.map((u: any) => {
            const up = userProjectMap.get(u.id) || { active: new Set<string>(), completed: new Set<string>() };
            const activeArr = Array.from(up.active);
            return {
              id: u.id, name: u.full_name || 'Unknown', email: u.email || '',
              role: u.role || 'employee', activeProjects: activeArr.length,
              completedProjects: Array.from(up.completed).length,
              projectNames: activeArr, isFree: activeArr.length === 0,
            };
          });

          teamData.sort((a, b) => {
            if (a.isFree && !b.isFree) return -1;
            if (!a.isFree && b.isFree) return 1;
            return a.activeProjects - b.activeProjects;
          });
          setTeamMembers(teamData);
        } catch { }

      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, isAdmin]);

  const getAvatarColor = (name: string) => {
    const i = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[i];
  };
  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-xl w-64" />
        <div className="h-4 bg-gray-100 rounded w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 h-52" />
          <div className="bg-white rounded-2xl p-6 border border-gray-100 h-52" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Greeting ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back,{' '}
            <span style={{ color: BRAND }}>{user?.full_name?.split(' ')[0] || 'User'}</span> 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
            <FiCalendar className="h-3.5 w-3.5" />
            {todayFormatted}
          </p>
        </div>
        {!isAdmin && (
          <div className="shrink-0"><AttendanceWidget /></div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<FiBriefcase className="h-5 w-5" />}
          label="Total Projects"
          value={stats.totalProjects}
          iconBg={BRAND_LIGHT}
          iconColor={BRAND}
          href="/dashboard/projects"
          sub={`${stats.activeProjects} active · ${stats.completedProjects} completed`}
        />
        <StatCard
          icon={<FiCheckCircle className="h-5 w-5" />}
          label="All Tasks"
          value={stats.totalTasks}
          iconBg="#EFF6FF"
          iconColor="#3B82F6"
          href="/dashboard/tasks"
          sub={`${stats.todoTasks} to do · ${stats.inProgressTasks} in progress`}
        />
        <StatCard
          icon={<FiAlertCircle className="h-5 w-5" />}
          label="Due This Week"
          value={stats.upcomingDeadlines}
          iconBg="#FFF1F2"
          iconColor="#F43F5E"
          href="/dashboard/projects"
          sub="Projects with deadline ≤ 7 days"
        />
        <StatCard
          icon={<FiAlertTriangle className="h-5 w-5" />}
          label="Open Snags"
          value={stats.openSnags}
          iconBg="#FFF7ED"
          iconColor="#F97316"
          href="/dashboard/snags"
          sub={`${stats.resolvedSnags} resolved · ${stats.totalSnags} total`}
        />
      </div>

      {/* ── Middle Section: Active Projects & Urgent Snags ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        
        {/* Active Projects Tracker */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-500">
                <FiBriefcase className="h-5 w-5" style={{ color: BRAND }} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Active Projects</h3>
                <p className="text-xs text-gray-400">Track current workflow and milestones</p>
              </div>
            </div>
            <Link
              href="/dashboard/projects"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              View All
            </Link>
          </div>

          <div className="divide-y divide-gray-50 space-y-3.5">
            {projectsList.filter(p => p.status !== 'completed').length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No active projects found.
              </div>
            ) : (
              projectsList
                .filter(p => p.status !== 'completed')
                .slice(0, 4)
                .map((project) => {
                  // Calculate dynamic progress based on tasks
                  const projectTasks = tasksList.filter(t => t.step?.project?.id === project.id);
                  const completedTasks = projectTasks.filter(t => t.status === 'done').length;
                  const progress = projectTasks.length > 0 
                    ? Math.round((completedTasks / projectTasks.length) * 100)
                    : (project.status === 'in_progress' ? 50 : 15);
                  
                  const totalDays = Math.max(1, Math.ceil((new Date(project.estimated_completion_date).getTime() - new Date(project.start_date).getTime()) / 86400000));
                  const daysElapsed = Math.max(0, Math.ceil((Date.now() - new Date(project.start_date).getTime()) / 86400000));
                  const isOverdue = daysElapsed > totalDays;
                  
                  return (
                    <div key={project.id} className="pt-3.5 first:pt-0 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-4">
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="text-sm font-semibold text-gray-900 hover:text-yellow-600 transition-colors truncate"
                        >
                          {project.title}
                        </Link>
                        <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded-md shrink-0">
                          {project.status === 'in_progress' ? 'Execution' : 'Design'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500 gap-4">
                        <div className="truncate">
                          Designer: <span className="font-medium text-gray-700">{project.assigned_employee?.full_name || 'Unassigned'}</span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-rose-50 text-rose-600 border border-rose-100">
                              <FiAlertCircle className="h-3 w-3" />
                              <span>{daysElapsed}/{totalDays} days</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-50 text-amber-600 border border-amber-100">
                              <FiCalendar className="h-3 w-3" style={{ color: BRAND }} />
                              <span>{daysElapsed}/{totalDays} days</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Premium Progress Bar */}
                      <div className="w-full">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-1">
                          <span>Overall Progress</span>
                          <span style={{ color: BRAND }}>{progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100/50">
                          <div 
                            className="h-full rounded-full transition-all duration-1000 ease-out" 
                            style={{ 
                              width: `${progress}%`,
                              backgroundColor: BRAND
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Recent Site Updates Feed */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-500">
                <FiTrendingUp className="h-5 w-5" style={{ color: BRAND }} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Recent Site Updates</h3>
                <p className="text-xs text-gray-400">Live progress reports from work sites</p>
              </div>
            </div>
            <Link
              href="/dashboard/projects"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              View Projects
            </Link>
          </div>

          <div className="divide-y divide-gray-50 space-y-3.5">
            {updatesList.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No progress updates posted yet.
              </div>
            ) : (
              updatesList.slice(0, 4).map((update) => {
                const dateFormatted = new Date(update.created_at || update.update_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div key={update.id} className="pt-3.5 first:pt-0 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-4">
                      <Link
                        href={`/dashboard/projects/${update.project_id}?stage=work_progress&tab=updates`}
                        className="text-sm font-semibold text-gray-900 hover:text-yellow-600 transition-colors truncate"
                      >
                        {update.project?.title || 'General Site Update'}
                      </Link>
                      <span className="text-[10px] font-bold text-gray-400 shrink-0 flex items-center gap-1">
                        <FiCalendar className="h-3 w-3" />
                        <span>{dateFormatted}</span>
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {update.description}
                    </p>

                    {/* Media Attachments Badges */}
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      {update.photos && update.photos.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-50 text-amber-600 border border-amber-100">
                          <FiCamera className="h-3 w-3" />
                          <span>{update.photos.length} Photo{update.photos.length !== 1 ? 's' : ''}</span>
                        </span>
                      )}
                      {update.audio_url && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-blue-50 text-blue-600 border border-blue-100">
                          <FiVolume2 className="h-3 w-3" />
                          <span>Voice Note</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold mt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-yellow-50 text-yellow-700 flex items-center justify-center font-black border border-yellow-100 text-[9px]">
                          {(update.user?.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="uppercase text-gray-500 text-[9px]">{update.user?.full_name || 'Team Member'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>


      {/* ── Team Overview (Admin only) ── */}
      {isAdmin && teamMembers.length > 0 && (
        <div className="hidden lg:block bg-white rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: BRAND_LIGHT }}
              >
                <FiUsers className="h-4 w-4" style={{ color: BRAND }} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Team Overview</h3>
                <p className="text-xs text-gray-400">
                  {teamMembers.length} members · {teamMembers.filter(m => !m.isFree).length} assigned to projects
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/organization"
              className="text-sm font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{ color: BRAND, backgroundColor: BRAND_LIGHT }}
            >
              Manage Team <FiArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  {['Team Member', 'Current Projects', 'Status', 'Quick Action'].map((h, i) => (
                    <th
                      key={h}
                      className={`text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3 ${
                        i === 0 ? 'text-left' : i === 2 ? 'text-center' : i === 3 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {teamMembers.slice(0, 15).map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50/40 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: getAvatarColor(member.name) }}
                        >
                          {getInitials(member.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[180px]">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {member.projectNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {member.projectNames.slice(0, 2).map((name, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 max-w-[140px] truncate inline-block">
                              {name}
                            </span>
                          ))}
                          {member.projectNames.length > 2 && (
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-500">
                              +{member.projectNames.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        member.isFree ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${member.isFree ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                        {member.isFree ? 'Available' : `${member.activeProjects} Project${member.activeProjects !== 1 ? 's' : ''}`}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        href={`/dashboard/tasks?assign=${member.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border"
                        style={{ color: '#92741A', backgroundColor: BRAND_LIGHT, borderColor: '#FDF0C0' }}
                      >
                        <FiPlus className="h-3 w-3" />
                        Assign Task
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {teamMembers.length > 15 && (
              <div className="px-6 py-3 border-t border-gray-100 text-center">
                <Link
                  href="/dashboard/organization"
                  className="text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ color: BRAND }}
                >
                  +{teamMembers.length - 15} more members — View all
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
