'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { FiHome, FiUsers, FiBriefcase, FiLogOut, FiSettings, FiMenu, FiX, FiCheckSquare, FiAlertTriangle, FiCreditCard, FiRadio, FiClock } from 'react-icons/fi';
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
import AdminTour from '@/components/AdminTour';

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
  const { hasPermission } = useUserPermissions();

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
      {/* Admin Feature Tour */}
      <AdminTour setSidebarOpen={setSidebarOpen} />
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-32 lg:w-14 lg:hover:w-32 bg-white text-gray-900 shadow-lg border-r border-gray-200 transform transition-all duration-300 ease-in-out group peer
        lg:translate-x-0 lg:fixed lg:top-0 lg:h-screen lg:left-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo at top */}
        <div className="p-2 lg:p-3">
          <div className="flex items-center justify-start pl-3 lg:pl-1">
            <img
              src="/icon_1.png"
              alt="Apple Interiors"
              className="h-6 w-6 lg:h-7 lg:w-7"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 lg:py-3 lg:px-0">
          <div className="space-y-1">
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
            {isAdmin && (
              <>
                <Link
                  href="/dashboard/organization?tab=broadcast"
                  className="flex items-center justify-start px-3 lg:pl-[14px] lg:pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg touch-target"
                  onClick={() => setSidebarOpen(false)}
                  title="Broadcast"
                >
                  <FiRadio className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                  <span className="ml-3 text-sm font-medium lg:text-xs block lg:hidden lg:group-hover:block whitespace-nowrap">Broadcast</span>
                </Link>
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
              </>
            )}
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
                className="lg:hidden p-1.5 -ml-1.5 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
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


        {/* Portal Target for Project Navigation */}
        <div id="project-navigation-portal" className="sticky top-[50px] z-20 bg-white w-full shadow-sm" />


        {/* Main content area with minimal padding - wrapped in PullToRefresh for mobile */}
        <PullToRefresh>
          <main className="flex-1 bg-white overflow-x-hidden max-w-full">
            <div className={`pt-4 lg:pt-2 h-full flex flex-col min-h-0 max-w-full ${isCustomHeaderPage ? '' : 'px-2 sm:px-3 lg:px-4 pb-6'}`}>
              {children}
            </div>
          </main>
        </PullToRefresh>
      </div>
      {/* PWA Install Prompt */}
      < PWAInstallPrompt />
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
