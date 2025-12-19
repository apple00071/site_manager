'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { FiHome, FiUsers, FiBriefcase, FiLogOut, FiSettings, FiMenu, FiX, FiCheckSquare } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { OptimizedNotificationBell } from '@/components/OptimizedNotificationBell';
import HydrationSafe from '@/components/HydrationSafe';
import { HeaderTitleProvider, useHeaderTitle } from '@/contexts/HeaderTitleContext';

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
  const router = useRouter();
  const pathname = usePathname();

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
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900 bg-opacity-50 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-14 hover:w-32 sm:w-16 hover:sm:w-36 lg:w-14 hover:lg:w-32 bg-white text-gray-900 shadow-lg border-r border-gray-200 transform transition-all duration-300 ease-in-out group peer
        lg:translate-x-0 lg:fixed lg:top-0 lg:h-screen lg:left-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo at top */}
        <div className="p-2 lg:p-3">
          <div className="flex items-center justify-center">
            <img
              src="/icon.png"
              alt="Apple Interiors"
              className="h-6 w-6 lg:h-7 lg:w-7"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3">
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center justify-start pl-[14px] sm:pl-[18px] lg:pl-[14px] pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
              onClick={() => setSidebarOpen(false)}
              title="Dashboard"
            >
              <FiHome className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Dashboard</span>
            </Link>
            <Link
              href="/dashboard/projects"
              className="flex items-center justify-start pl-[14px] sm:pl-[18px] lg:pl-[14px] pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
              onClick={() => setSidebarOpen(false)}
              title="Projects"
            >
              <FiBriefcase className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Projects</span>
            </Link>
            <Link
              href="/dashboard/tasks"
              className="flex items-center justify-start pl-[14px] sm:pl-[18px] lg:pl-[14px] pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
              onClick={() => setSidebarOpen(false)}
              title="All Tasks"
            >
              <FiCheckSquare className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Tasks</span>
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard/organization"
                className="flex items-center justify-start pl-[14px] sm:pl-[18px] lg:pl-[14px] pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
                onClick={() => setSidebarOpen(false)}
                title="Org"
              >
                <FiUsers className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Org</span>
              </Link>
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
            <div className="flex items-center gap-2 sm:gap-3 ml-2 sm:ml-4 shrink-0">
              {/* Project Status or Subtitle */}
              {subtitle && (
                <div className="flex items-center gap-2 text-sm">
                  {typeof subtitle === 'string' ? (
                    <>
                      <span className="hidden sm:inline text-gray-500">Project Status:</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium text-xs">
                        {subtitle}
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

              <OptimizedNotificationBell />

              {/* User Avatar with Dropdown */}
              {user && (
                <div className="relative ml-2">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-3 border-l border-gray-200 hover:opacity-80 transition-opacity"
                  >
                    <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white">
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


        </header>

        {/* Portal Target for Project Navigation */}
        <div id="project-navigation-portal" className="sticky top-[50px] z-20 bg-white w-full shadow-sm" />


        {/* Main content area with minimal padding */}
        <main className="flex-1 bg-white overflow-x-hidden max-w-full">
          <div className={`pt-4 lg:pt-2 h-full flex flex-col min-h-0 max-w-full ${isCustomHeaderPage ? '' : 'px-2 sm:px-3 lg:px-4 pb-6'}`}>
            {children}
          </div>
        </main>
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
