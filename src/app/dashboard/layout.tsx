'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { FiHome, FiUsers, FiBriefcase, FiLogOut, FiSettings, FiMenu, FiX, FiCheckSquare, FiAlertTriangle, FiCreditCard, FiRadio, FiClock, FiSearch, FiFileText, FiMessageSquare } from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';
import { supabase } from '@/lib/supabase';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { OptimizedNotificationBell } from '@/components/OptimizedNotificationBell';
import HydrationSafe from '@/components/HydrationSafe';
import { HeaderTitleProvider, useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import AttendanceWidget from '@/components/attendance/AttendanceWidget';
import PasswordChangeModal from '@/components/PasswordChangeModal';
import NotepadDrawer from '@/components/notepad/NotepadDrawer';
import ChatBotDrawer from '@/components/chatbot/ChatBotDrawer';



const getDesignerName = (proj: any): string => {
  return proj.assigned_employee?.name || proj.designer?.full_name || 'Not Assigned';
};

const getSupervisorName = (proj: any): string => {
  if (proj.site_supervisor?.full_name) return proj.site_supervisor.full_name;
  if (Array.isArray(proj.project_members)) {
    const supervisorMember = proj.project_members.find((pm: any) => {
      const designation = pm.users?.designation?.toLowerCase() || '';
      return designation.includes('site') || designation.includes('supervisor') || designation.includes('engineer');
    });
    if (supervisorMember?.users?.full_name) {
      return supervisorMember.users.full_name;
    }
  }
  return 'Not Assigned';
};


function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, signOut, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission, hasAnyPermission } = useUserPermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const modalInputRef = useRef<HTMLInputElement>(null);

  const fetchProjects = async () => {
    if (projects.length === 0) {
      setLoadingProjects(true);
      try {
        const response = await fetch('/api/admin/projects');
        if (response.ok) {
          const data = await response.json();
          setProjects(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Error loading projects for search:', err);
      } finally {
        setLoadingProjects(false);
      }
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return projects.filter((p: any) => {
      // 1. Match project title
      if (p.title?.toLowerCase().includes(query)) return true;

      // 2. Match customer name
      if (p.customer_name?.toLowerCase().includes(query)) return true;

      // 3. Match designer name
      if (p.designer?.full_name?.toLowerCase().includes(query)) return true;

      // 4. Match site supervisor / engineer name
      if (p.site_supervisor?.full_name?.toLowerCase().includes(query)) return true;

      // 5. Match assigned employee name
      if (p.assigned_employee?.name?.toLowerCase().includes(query)) return true;

      // 6. Match project members
      if (p.project_members && Array.isArray(p.project_members)) {
        const matchesMember = p.project_members.some((member: any) => 
          member?.users?.full_name?.toLowerCase().includes(query)
        );
        if (matchesMember) return true;
      }

      return false;
    }).slice(0, 8);
  }, [searchQuery, projects]);

  // Reset selected index when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Focus modal input when search opens
  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        modalInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  // Global keybind and arrow key navigation handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle search modal with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => {
          if (!prev) {
            fetchProjects();
          }
          return !prev;
        });
        return;
      }

      // Handle keyboard navigation if modal is open
      if (isSearchOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsSearchOpen(false);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => 
            filteredProjects.length > 0 ? Math.min(prev + 1, filteredProjects.length - 1) : 0
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredProjects[selectedIndex]) {
            const proj = filteredProjects[selectedIndex];
            setIsSearchOpen(false);
            setSearchQuery('');
            router.push(`/dashboard/projects/${proj.id}`);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, projects, filteredProjects, selectedIndex, router]);


  // Get dynamic page title based on current route
  const { title: customTitle, subtitle, tabs, activeTab, onTabChange, actions } = useHeaderTitle();

  // Use useMemo to ensure title updates when customTitle changes
  const pageTitle = useMemo(() => {
    // Prioritize custom title
    if (customTitle) {
      if (typeof customTitle === 'string' && !customTitle.trim()) return 'Dashboard'; // Handle empty strings
      return customTitle;
    }

    // Fallback to pathname-based titles
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname === '/dashboard/projects') return 'Projects';
    if (pathname === '/dashboard/users') return 'User Management';
    if (pathname === '/dashboard/settings') return 'Settings';
    if (pathname === '/dashboard/my-projects') return 'My Projects';
    if (pathname === '/dashboard/my-tasks') return 'My Tasks';
    if (pathname === '/dashboard/tasks') return 'All Tasks';
    if (pathname === '/dashboard/office-expenses') return 'Expenses';
    if (pathname === '/dashboard/attendance') return 'Attendance';
    if (pathname === '/dashboard/snags') return 'Snags';
    if (pathname.startsWith('/dashboard/projects/')) {
      if (pathname.endsWith('/edit')) return 'Edit Project';
      if (pathname.endsWith('/members')) return 'Project Members';
      return 'Project Details';
    }
    if (pathname.startsWith('/dashboard/users/')) {
      if (pathname.endsWith('/edit')) return 'Edit User';
      return 'User Details';
    }
    if (pathname.endsWith('/new')) {
      if (pathname.includes('/projects/')) return 'New Project';
      if (pathname.includes('/users/')) return 'New User';
    }
    return 'Dashboard';
  }, [customTitle, pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      router.replace('/login');
    }
  };

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setScrolled(scrollTop > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check if user needs to change password
  useEffect(() => {
    if (!user) return;
    const checkPasswordStatus = async () => {
      try {
        const res = await fetch('/api/auth/check-password-status');
        if (res.ok) {
          const data = await res.json();
          if (data.password_changed === false) {
            setShowPasswordModal(true);
          }
        }
      } catch (err) {
        // Ignore errors silently
      }
    };
    checkPasswordStatus();
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  // Header is now always shown, functionality handled by context
  const isCustomHeaderPage = false;

  return (
    <div className="flex min-h-screen bg-gray-50 w-full max-w-[100vw] overflow-x-hidden">
      {/* Force Password Change Modal */}
      {showPasswordModal && (
        <PasswordChangeModal onSuccess={() => setShowPasswordModal(false)} />
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-40 lg:w-14 lg:hover:w-32 bg-white text-gray-900 shadow-lg border-r border-gray-200 transform transition-all duration-300 ease-in-out group peer
        lg:translate-x-0 lg:fixed lg:top-0 lg:h-screen lg:left-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo at top */}
        <div className="p-2 lg:p-3">
          <div className="flex items-center justify-center lg:justify-start lg:pl-1">
            <Link href="/dashboard" className="flex items-center">
              <img
                src="/sidebar-logo.png"
                alt="Apple Interiors"
                className="h-8 w-8 lg:h-9 lg:w-9 object-contain"
              />
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-1 lg:py-2 lg:px-0">
          <div className="space-y-0.5">
            <Link
              href="/dashboard"
              className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
              onClick={() => setSidebarOpen(false)}
              title="Dashboard"
            >
              <FiHome className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Dashboard</span>
            </Link>
            <Link
              href="/dashboard/projects"
              className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
              onClick={() => setSidebarOpen(false)}
              title="Projects"
            >
              <FiBriefcase className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Projects</span>
            </Link>
            <Link
              href="/dashboard/tasks"
              className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
              onClick={() => setSidebarOpen(false)}
              title="All Tasks"
            >
              <FiCheckSquare className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Tasks</span>
            </Link>
            <Link
              href="/dashboard/snags"
              className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
              onClick={() => setSidebarOpen(false)}
              title="Snags"
            >
              <FiAlertTriangle className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Snags</span>
            </Link>
            <Link
              href="/dashboard/office-expenses"
              className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
              onClick={() => setSidebarOpen(false)}
              title="Expenses"
            >
              <FiCreditCard className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Expenses</span>
            </Link>
            {hasPermission('attendance.view') && (
              <Link
                href="/dashboard/attendance"
                className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
                onClick={() => setSidebarOpen(false)}
                title="Attendance"
                id="sidebar-attendance"
              >
                <FiClock className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Attendance</span>
              </Link>
            )}
            {hasPermission('payroll.view') && (
              <Link
                href="/dashboard/payroll"
                className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
                onClick={() => setSidebarOpen(false)}
                title="Payroll"
                id="sidebar-payroll"
              >
                <TbCurrencyRupee className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Payroll</span>
              </Link>
            )}
            {(isAdmin || hasPermission('broadcast.view')) && (
                <Link
                  href="/dashboard/organization?tab=broadcast"
                  className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
                  onClick={() => setSidebarOpen(false)}
                  title="Broadcast"
                >
                  <FiRadio className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                  <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Broadcast</span>
                </Link>
            )}
            {(isAdmin || hasAnyPermission(['users.view', 'users.create', 'users.edit', 'users.delete', 'role.manage', 'settings.edit'])) && (
                <Link
                  href="/dashboard/organization"
                  className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
                  onClick={() => setSidebarOpen(false)}
                  title="Org"
                  id="sidebar-org"
                >
                  <FiUsers className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                  <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Org</span>
                </Link>
            )}
            <button
              onClick={() => {
                setIsNotepadOpen(true);
                setSidebarOpen(false);
              }}
              className="w-full flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
              title="Notepad"
              type="button"
            >
              <FiFileText className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Notepad</span>
            </button>
            <button
              onClick={() => {
                setIsChatOpen(true);
                setSidebarOpen(false);
              }}
              className="w-full flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
              title="AI Assistant"
              type="button"
            >
              <FiMessageSquare className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Ask AI</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Main content - allow natural page scroll (no overflow-hidden here) */}
      <div className="flex-1 flex flex-col bg-white min-w-0 max-w-full overflow-x-hidden lg:ml-14 peer-hover:lg:ml-32 transition-all duration-300 ease-in-out">

        {/* Global Header - Responsive */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 py-1.5 flex items-center justify-between min-h-[50px]">
            {/* Left side: Hamburger + Title + Tabs */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setSidebarOpen(true)}
                id="mobile-menu-button"
                className="lg:hidden p-1.5 -ml-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Open navigation menu"
              >
                <FiMenu className="h-6 w-6" />
              </button>


              <div className="text-sm font-semibold text-gray-900 whitespace-nowrap truncate">{pageTitle}</div>

              {/* Tab pills (Desktop Only for space, or scrollable on mobile?) */}
              {tabs.length > 0 && (
                <div className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar">
                  <span className="text-gray-300 text-lg">/</span>
                  <div className="flex items-center gap-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => onTabChange?.(tab.id)}
                        className={`
                            px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200
                            ${activeTab === tab.id
                            ? 'bg-yellow-500 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }
                          `}
                      >
                        {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Quick Project Search Button (Trigger) */}
            <button
              onClick={() => {
                setIsSearchOpen(true);
                fetchProjects();
              }}
              className="hidden md:flex items-center justify-between max-w-xs w-60 mx-4 px-3 py-1.5 bg-gray-50/60 border border-gray-200 rounded-lg text-left hover:bg-gray-100/50 hover:border-gray-300 transition-all font-medium text-gray-400 hover:text-gray-500 shadow-sm"
              type="button"
            >
              <div className="flex items-center gap-2">
                <FiSearch className="text-gray-400 w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-medium">Search projects...</span>
              </div>
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold text-gray-400 bg-white rounded border border-gray-200 shadow-xs">
                Ctrl+K
              </span>
            </button>

            {/* Right side: Status + Actions + Notification */}
            <div className="flex items-center gap-2 lg:gap-3 ml-auto shrink-0">
              {/* Project Status or Subtitle */}
              {subtitle && (
                <div className="flex items-center text-sm">
                  {typeof subtitle === 'string' ? (
                    <>
                      {/* Large screens: full status with label */}
                      <div className="hidden lg:flex items-center gap-2">
                        {pathname?.startsWith('/dashboard/projects/') && (
                          <span className="text-gray-500">Status:</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${pathname?.startsWith('/dashboard/projects/')
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                          }`}>
                          {subtitle}
                        </span>
                      </div>
                      {/* Mobile/Tablet: compact abbreviated status */}
                      <span className={`lg:hidden px-1 py-0.5 rounded text-[8px] font-bold tracking-tight ${pathname?.startsWith('/dashboard/projects/')
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-50 text-yellow-700'
                        }`}>
                        {(() => {
                          const s = subtitle.toLowerCase().replace(/\s+/g, '_');
                          if (s.includes('execution') || s === 'in_progress') return 'EXEC';
                          if (s.includes('design')) return 'DSN';
                          if (s.includes('complet') || s === 'done') return 'DONE';
                          if (s.includes('hold')) return 'HOLD';
                          if (s.includes('cancel')) return 'X';
                          return subtitle.slice(0, 3).toUpperCase();
                        })()}
                      </span>
                    </>
                  ) : (
                    subtitle
                  )}
                </div>
              )}



              {/* Actions */}
              <div className="hidden sm:flex items-center gap-2">
                {actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={action.onClick}
                    className={`
                            px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                            ${action.variant === 'primary'
                        ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-600'
                        : 'text-gray-600 hover:bg-gray-100'
                      }
                        `}
                  >
                    {action.icon && <span className="mr-1.5">{action.icon}</span>}
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Bell + Avatar group - tightly packed */}
              <div className="flex items-center">
                {/* Mobile/Tablet Search Icon Trigger */}
                <button
                  onClick={() => {
                    setIsSearchOpen(true);
                    fetchProjects();
                  }}
                  className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mr-1 shrink-0"
                  aria-label="Search projects"
                  type="button"
                >
                  <FiSearch className="w-5 h-5" />
                </button>

                {/* Global Notepad Drawer Trigger */}
                <button
                  onClick={() => setIsNotepadOpen(true)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mr-1 shrink-0 touch-target"
                  aria-label="Open notepad"
                  title="Open Notepad"
                  type="button"
                >
                  <FiFileText className="w-5 h-5" />
                </button>

                <OptimizedNotificationBell />

                {/* User Avatar with Dropdown */}
                {user && (
                  <div className="relative ml-0.5 lg:ml-1.5">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center justify-center w-10 h-10 lg:w-auto lg:h-auto lg:gap-2 pl-0 lg:pl-3 border-none lg:border-l lg:border-gray-200 hover:opacity-80 transition-opacity"
                    >
                      <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white">
                        {(user.full_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-700 hidden xl:block">{user.full_name || user.email?.split('@')[0] || 'User'}</span>
                    </button>

                    {/* User Dropdown */}
                    {userMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setUserMenuOpen(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-200">
                          <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.full_name || 'User'}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>

                          <Link
                            href="/dashboard/settings"
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <FiSettings className="w-4 h-4 text-gray-400" />
                            Settings
                          </Link>

                          <div className="border-t border-gray-100 my-1"></div>

                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              handleSignOut();
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <FiLogOut className="w-4 h-4" />
                            Sign out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>


        {/* Portal Target for Project Navigation - Rendered only on project details pages where it's needed */}
        {pathname?.startsWith('/dashboard/projects/') && 
         pathname !== '/dashboard/projects' && 
         pathname !== '/dashboard/projects/' && 
         pathname !== '/dashboard/projects/new' && (
          <div 
            id="project-navigation-portal" 
            className="sticky top-[50px] z-20 bg-white w-full shadow-sm min-h-[96px] sm:min-h-[105px]" 
          />
        )}


        {/* Main content area with minimal padding - wrapped in PullToRefresh for mobile */}
        <PullToRefresh>
          <main className="flex-1 bg-white overflow-x-hidden max-w-full">
            <div className={`pt-4 lg:pt-2 min-h-full flex flex-col max-w-full ${isCustomHeaderPage ? '' : 'px-2 sm:px-3 lg:px-4 pb-6'}`}>
              {children}
            </div>
          </main>
        </PullToRefresh>
      </div>
      {/* PWA Install Prompt */}
      < PWAInstallPrompt />

      {/* Premium Scratchpad Notepad Drawer */}
      <NotepadDrawer isOpen={isNotepadOpen} onClose={() => setIsNotepadOpen(false)} />

      {/* AI Chatbot Assistant Drawer */}
      <ChatBotDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Floating AI Chat Trigger Button */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-yellow-500 hover:bg-yellow-600 text-gray-950 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center border-2 border-white ring-4 ring-yellow-400/20 active:scale-95 cursor-pointer animate-in zoom-in duration-300"
        title="Ask AI Assistant"
        aria-label="Open AI Assistant"
        type="button"
      >
        <FiMessageSquare className="w-6 h-6 animate-pulse" />
      </button>

      {/* Centered Spotlight Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 animate-fade-in">
          {/* Glassmorphic Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsSearchOpen(false)}
          />

          {/* Modal Card */}
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.35)] border border-gray-100/80 overflow-hidden flex flex-col z-10 animate-scale-in">
            {/* Search Header */}
            <div className="relative p-4 border-b border-gray-100 flex items-center gap-3">
              <FiSearch className="text-yellow-500 w-5 h-5 shrink-0" />
              <input
                ref={modalInputRef}
                type="text"
                placeholder="Search projects by title or client name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-800 placeholder-gray-400 font-medium"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-gray-400 bg-gray-100 rounded border border-gray-200 shadow-2xs font-sans">
                  ESC
                </span>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100/50 transition-all"
                  aria-label="Close search"
                  type="button"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results / Empty / Loading / Suggestions */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 no-scrollbar">
              {loadingProjects ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-500 border-t-transparent"></div>
                  <span className="text-xs text-gray-500 font-medium">Loading projects catalog...</span>
                </div>
              ) : searchQuery.trim() === '' ? (
                <div className="p-6 text-center">
                  <div className="inline-flex p-3 bg-yellow-50 rounded-xl text-yellow-600 mb-3">
                    <FiSearch className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">Quick Project Search</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Type a project name, customer name, or status to instantly jump to its dashboard.
                  </p>
                  
                  {/* Suggestions */}
                  {projects.length > 0 && (
                    <div className="mt-4 text-left">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2 px-1">
                        Recent / Active Projects
                      </span>
                      <div className="grid gap-1">
                        {projects.slice(0, 3).map((p: any) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setIsSearchOpen(false);
                              setSearchQuery('');
                              router.push(`/dashboard/projects/${p.id}`);
                            }}
                            className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-yellow-50/50 hover:border-yellow-100/50 border border-transparent transition-all flex items-center justify-between gap-3"
                            type="button"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-900 truncate">{p.title}</p>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[9px] font-medium items-center">
                                <span className="text-gray-500">
                                  Client: <strong className="font-semibold text-gray-700">{p.customer_name || 'N/A'}</strong>
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="text-gray-500">
                                  Designer: <strong className="font-semibold text-gray-700">{getDesignerName(p)}</strong>
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="text-gray-500">
                                  Site Engg: <strong className="font-semibold text-gray-700">{getSupervisorName(p)}</strong>
                                </span>
                              </div>
                            </div>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-bold border border-yellow-100 uppercase shrink-0">
                              {p.status?.replace(/_/g, ' ') || 'active'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <span className="text-2xl mb-2">🔍</span>
                  <p className="text-xs font-semibold text-gray-700">No projects found</p>
                  <p className="text-[10px] text-gray-400 mt-1">We couldn't find any projects matching "{searchQuery}"</p>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Search Results ({filteredProjects.length})
                  </div>
                  {filteredProjects.map((proj: any, index: number) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={proj.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                          router.push(`/dashboard/projects/${proj.id}`);
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between gap-3 border ${
                          isSelected
                            ? 'bg-yellow-50 border-yellow-200 shadow-xs'
                            : 'hover:bg-gray-50/60 text-gray-800 border-transparent'
                        }`}
                        type="button"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate text-gray-900">
                            {proj.title}
                          </p>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] font-medium items-center">
                            <span className={isSelected ? 'text-gray-700' : 'text-gray-500'}>
                              Client: <strong className={isSelected ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}>{proj.customer_name || 'N/A'}</strong>
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className={isSelected ? 'text-gray-700' : 'text-gray-500'}>
                              Designer: <strong className={isSelected ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}>{getDesignerName(proj)}</strong>
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className={isSelected ? 'text-gray-700' : 'text-gray-500'}>
                              Site Engg: <strong className={isSelected ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}>{getSupervisorName(proj)}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                            isSelected 
                              ? 'bg-yellow-100/70 text-yellow-800 border border-yellow-200' 
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            {proj.status.replace(/_/g, ' ')}
                          </span>
                          {isSelected && (
                            <span className="text-yellow-600 text-xs font-bold shrink-0 animate-pulse">
                              →
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-medium">
              <span className="flex items-center gap-1">
                <span className="bg-white px-1 py-0.5 rounded border border-gray-200">↑↓</span> navigate
              </span>
              <span className="flex items-center gap-1">
                <span className="bg-white px-1.5 py-0.5 rounded border border-gray-200">Enter</span> select
              </span>
              <span className="flex items-center gap-1">
                <span className="bg-white px-1 py-0.5 rounded border border-gray-200">Esc</span> close
              </span>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeaderTitleProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </HeaderTitleProvider>
  );
}
