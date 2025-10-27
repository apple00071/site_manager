'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiHome, FiUsers, FiBriefcase, FiLogOut, FiSettings, FiMenu, FiX } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, signOut, isAdmin } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Removed automatic redirect check - middleware already handles authentication
  // The middleware ensures only authenticated users can reach this page

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // Show loading state while AuthContext initializes
  // Middleware already authenticated the user, so we just wait for AuthContext to sync
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-black text-gray-100 shadow-md transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl lg:text-2xl font-bold text-yellow-400">Apple Interiors</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-yellow-500/20"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        <nav className="mt-6">
          <div className="px-4 py-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Main
            </p>
            <div className="mt-3 space-y-1">
              <Link 
                href="/dashboard" 
                className="flex items-center px-4 py-3 text-gray-200 hover:bg-yellow-500/10 rounded-md transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <FiHome className="mr-3 h-5 w-5 text-yellow-400" />
                Dashboard
              </Link>
              <Link 
                href="/dashboard/projects" 
                className="flex items-center px-4 py-3 text-gray-200 hover:bg-yellow-500/10 rounded-md transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <FiBriefcase className="mr-3 h-5 w-5 text-yellow-400" />
                Projects
              </Link>
              {isAdmin && (
                <Link 
                  href="/dashboard/users" 
                  className="flex items-center px-4 py-3 text-gray-200 hover:bg-yellow-500/10 rounded-md transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  <FiUsers className="mr-3 h-5 w-5 text-yellow-400" />
                  Users
                </Link>
              )}
              {isAdmin && (
                <Link 
                  href="/dashboard/settings" 
                  className="flex items-center px-4 py-3 text-gray-200 hover:bg-yellow-500/10 rounded-md transition-colors"
                  onClick={() => setSidebarOpen(false)}
                >
                  <FiSettings className="mr-3 h-5 w-5 text-yellow-400" />
                  Settings
                </Link>
              )}
            </div>
          </div>
        </nav>
        
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-800">
          <div className="flex items-center mb-4">
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-200 truncate">{user.full_name || user.email}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role || 'User'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center w-full px-4 py-3 text-gray-200 hover:bg-yellow-500/10 rounded-md transition-colors"
          >
            <FiLogOut className="mr-3 h-5 w-5 text-yellow-400" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="bg-black shadow lg:hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-yellow-500/20"
            >
              <FiMenu className="h-6 w-6" />
            </button>
            <h2 className="text-lg font-semibold text-gray-100">Dashboard</h2>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>
        </header>

        {/* Desktop header */}
        <header className="bg-black shadow hidden lg:block">
          <div className="px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-100">Dashboard</h2>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-gray-50 rounded-tl-2xl">
          {children}
        </main>
      </div>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}