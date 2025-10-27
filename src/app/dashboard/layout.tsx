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
        fixed inset-y-0 left-0 z-50 w-16 lg:w-20 bg-white text-gray-900 shadow-md transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo at top */}
        <div className="p-3 lg:p-4 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <img 
              src="/New-logo.png" 
              alt="Apple Interiors" 
              className="h-8 w-8 lg:h-10 lg:w-10"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-4">
          <div className="space-y-2">
            <Link 
              href="/dashboard" 
              className="flex flex-col items-center px-2 py-3 text-gray-700 hover:bg-yellow-100 transition-colors group"
              onClick={() => setSidebarOpen(false)}
              title="Dashboard"
            >
              <FiHome className="h-5 w-5 text-yellow-600 mb-1" />
              <span className="text-xs text-center hidden lg:block text-gray-700">Dashboard</span>
            </Link>
            <Link 
              href="/dashboard/projects" 
              className="flex flex-col items-center px-2 py-3 text-gray-700 hover:bg-yellow-100 transition-colors group"
              onClick={() => setSidebarOpen(false)}
              title="Projects"
            >
              <FiBriefcase className="h-5 w-5 text-yellow-600 mb-1" />
              <span className="text-xs text-center hidden lg:block text-gray-700">Projects</span>
            </Link>
            {isAdmin && (
              <Link 
                href="/dashboard/users" 
                className="flex flex-col items-center px-2 py-3 text-gray-700 hover:bg-yellow-100 transition-colors group"
                onClick={() => setSidebarOpen(false)}
                title="Users"
              >
                <FiUsers className="h-5 w-5 text-yellow-600 mb-1" />
                <span className="text-xs text-center hidden lg:block text-gray-700">Users</span>
              </Link>
            )}
            {isAdmin && (
              <Link 
                href="/dashboard/settings" 
                className="flex flex-col items-center px-2 py-3 text-gray-700 hover:bg-yellow-100 transition-colors group"
                onClick={() => setSidebarOpen(false)}
                title="Settings"
              >
                <FiSettings className="h-5 w-5 text-yellow-600 mb-1" />
                <span className="text-xs text-center hidden lg:block text-gray-700">Settings</span>
              </Link>
            )}
          </div>
        </nav>
        
        {/* User section at bottom */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
              <span className="text-black text-xs font-bold">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex flex-col items-center px-2 py-2 text-gray-700 hover:bg-yellow-100 rounded-md transition-colors group"
              title="Sign out"
            >
              <FiLogOut className="h-4 w-4 text-yellow-600 mb-1" />
              <span className="text-xs text-center hidden lg:block text-gray-700">Sign out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="bg-white shadow lg:hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <FiMenu className="h-6 w-6" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>
        </header>

        {/* Desktop header */}
        <header className="bg-white shadow hidden lg:block">
          <div className="px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-gray-50">
          {children}
        </main>
      </div>
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}