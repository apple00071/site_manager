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
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Get dynamic page title based on current route
  const { title: customTitle, subtitle, tabs, activeTab, onTabChange, actions } = useHeaderTitle();

  // Use useMemo to ensure title updates when customTitle changes
  const pageTitle = useMemo(() => {
    // Prioritize custom title set by pages (like project name)
    if (customTitle && customTitle.trim()) {
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
  }, [customTitle, pathname]); // Re-compute when customTitle or pathname changes


  const handleSignOut = async () => {
    try {
      await signOut();
      // Use router.replace to avoid 404 issues
      router.replace('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      // Force redirect even if signOut fails
      router.replace('/login');
    }
  };

  // Move useEffect before conditional return to maintain hook order
  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setScrolled(scrollTop > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Removed automatic redirect check - middleware already handles authentication
  // The middleware ensures only authenticated users can reach this page

  // Show loading state while AuthContext initializes
  // Middleware already authenticated the user, so we just wait for AuthContext to sync
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  // Check if we are on the Project Details page to hide the global header
  // Only project detail pages get custom headers, the projects list uses standard layout header
  const isCustomHeaderPage = /^\/dashboard\/projects\/[^/]+$/.test(pathname) && pathname !== '/dashboard/projects/new';

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
        fixed inset-y-0 left-0 z-50 w-14 hover:w-32 sm:w-16 hover:sm:w-36 lg:w-14 hover:lg:w-32 bg-white text-gray-900 shadow-lg border-r border-gray-200 transform transition-all duration-300 ease-in-out group
        lg:translate-x-0 lg:static lg:inset-0
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
                href="/dashboard/users"
                className="flex items-center justify-start pl-[14px] sm:pl-[18px] lg:pl-[14px] pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
                onClick={() => setSidebarOpen(false)}
                title="Users"
              >
                <FiUsers className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Users</span>
              </Link>
            )}
            <Link
              href="/dashboard/settings"
              className="flex items-center justify-start pl-[14px] sm:pl-[18px] lg:pl-[14px] pr-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
              onClick={() => setSidebarOpen(false)}
              title="Settings"
            >
              <FiSettings className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Settings</span>
            </Link>
          </div>
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-gray-200 p-2">
          <div className="flex flex-col items-center space-y-1">
            <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-gray-900 text-xs font-bold">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center px-1 py-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors group"
              title="Sign out"
            >
              <FiLogOut className="h-4 w-4 min-w-[16px] group-hover:text-red-600" />
              <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Sign out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content - allow natural page scroll (no overflow-hidden here) */}
      <div className="flex-1 flex flex-col bg-white min-w-0 max-w-full overflow-x-hidden">

        {/* Mobile menu button - floating */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 p-3 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-md bg-white/80 backdrop-blur-sm border border-gray-200 transition-all duration-200 touch-target"
          aria-label="Open navigation menu"
        >
          <FiMenu className="h-6 w-6" />
        </button>

        {/* Notification bell - floating (mobile only) */}
        {!isCustomHeaderPage && (
          <div className="lg:hidden fixed top-4 right-4 z-30">
            <OptimizedNotificationBell />
          </div>
        )}

        {/* Desktop header only - HIDDEN on Project Details Page */}
        {!isCustomHeaderPage && (
          <header className="bg-white shadow-sm border-b border-gray-200 hidden lg:block">
            <div className="px-4 py-1 flex items-center justify-between">
              {/* Left side: Title with tabs */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-gray-900 whitespace-nowrap">{pageTitle}</h2>

                {/* Tab pills (if any) */}
                {tabs.length > 0 && (
                  <>
                    <span className="text-gray-300 text-lg">/</span>
                    <div className="flex items-center gap-1 overflow-x-auto">
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
                  </>
                )}
              </div>

              {/* Right side: Status + Actions + Notification */}
              <div className="flex items-center gap-3 ml-4">
                {/* Project Status */}
                {subtitle && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Project Status:</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium text-xs">
                      {subtitle}
                    </span>
                  </div>
                )}
                {actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={action.onClick}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${action.variant === 'primary'
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }
                    `}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
                <OptimizedNotificationBell />

                {/* User avatar with name - matching Projects header style */}
                {user && (
                  <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                    <div className="h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-[10px] shadow-sm">
                      {(user.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{user.full_name || user.email?.split('@')[0] || 'User'}</span>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Main content area with minimal padding */}
        <main className="flex-1 bg-white overflow-x-hidden max-w-full">
          <div className={`pt-16 lg:pt-2 h-full flex flex-col min-h-0 max-w-full ${isCustomHeaderPage ? '' : 'px-2 sm:px-3 lg:px-4 pb-6'}`}>
            {children}
          </div>
        </main>
      </div>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
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
