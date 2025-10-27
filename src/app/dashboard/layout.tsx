'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { FiHome, FiUsers, FiBriefcase, FiLogOut, FiSettings } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, signOut, isAdmin } = useAuth();
  const router = useRouter();

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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Apple Interior</h1>
        </div>
        <nav className="mt-6">
          <div className="px-4 py-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Main
            </p>
            <div className="mt-3 space-y-1">
              <Link href="/dashboard" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                <FiHome className="mr-3" />
                Dashboard
              </Link>
              <Link href="/dashboard/projects" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                <FiBriefcase className="mr-3" />
                Projects
              </Link>
              {isAdmin && (
                <Link href="/dashboard/users" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                  <FiUsers className="mr-3" />
                  Users
                </Link>
              )}
              {isAdmin && (
                <Link href="/dashboard/settings" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                  <FiSettings className="mr-3" />
                  Settings
                </Link>
              )}
            </div>
          </div>
        </nav>
        <div className="absolute bottom-0 w-64 p-4 border-t">
          <div className="flex items-center">
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">{user.full_name || user.email}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role || 'User'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-4 flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            <FiLogOut className="mr-3" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white shadow">
          <div className="px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}