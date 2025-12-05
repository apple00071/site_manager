'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiHome, FiUsers, FiBriefcase, FiLogOut, FiSettings, FiMenu, FiX, FiCheckSquare } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { OptimizedNotificationBell } from '@/components/OptimizedNotificationBell';
import HydrationSafe from '@/components/HydrationSafe';

export default function DashboardLayout({
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
  const getPageTitle = () => {
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
  };

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

  return (
    <div className="flex min-h-screen bg-gray-50">
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
              className="flex items-center justify-center group-hover:justify-start px-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
              onClick={() => setSidebarOpen(false)}
              title="Dashboard"
            >
              <FiHome className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Dashboard</span>
            </Link>
            <Link
              href="/dashboard/projects"
              className="flex items-center justify-center group-hover:justify-start px-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
              onClick={() => setSidebarOpen(false)}
              title="Projects"
            >
              <FiBriefcase className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Projects</span>
            </Link>
            <Link
              href="/dashboard/tasks"
              className="flex items-center justify-center group-hover:justify-start px-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
              onClick={() => setSidebarOpen(false)}
              title="All Tasks"
            >
              <FiCheckSquare className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
              <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Tasks</span>
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard/users"
                className="flex items-center justify-center group-hover:justify-start px-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
                onClick={() => setSidebarOpen(false)}
                title="Users"
              >
                <FiUsers className="h-5 w-5 min-w-[20px] group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                <span className="ml-3 text-xs font-medium hidden group-hover:block whitespace-nowrap">Users</span>
              </Link>
            )}
            <Link
              href="/dashboard/settings"
              className="flex items-center justify-center group-hover:justify-start px-2 py-3 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600 active:bg-yellow-100 transition-all duration-200 group rounded-lg mx-1 touch-target"
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
      <div className="flex-1 flex flex-col bg-white">

        {/* Mobile menu button - floating */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 p-3 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-white hover:shadow-md bg-white/80 backdrop-blur-sm border border-gray-200 transition-all duration-200 touch-target"
          aria-label="Open navigation menu"
        >
          <FiMenu className="h-6 w-6" />
        </button>

        {/* Notification bell - floating (mobile only) */}
        <div className="lg:hidden fixed top-4 right-4 z-30">
          <OptimizedNotificationBell />
        </div>

        {/* Desktop header only */}
        <header className="bg-white shadow-sm border-b border-gray-200 hidden lg:block h-14">
          <div className="px-6 py-4 flex items-center justify-between h-full">
            <h2 className="text-lg font-bold text-gray-900">{getPageTitle()}</h2>
            <OptimizedNotificationBell />
          </div>
        </header>

        {/* Main content area with appropriate padding; page itself handles scrolling */}
        <main className="flex-1 bg-white">
          <div className="p-4 sm:p-6 lg:p-8 pt-24 lg:pt-6 h-full flex flex-col min-h-0">
            {children}
          </div>
        </main>
      </div>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}
