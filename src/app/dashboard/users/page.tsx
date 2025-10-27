'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import Link from 'next/link';

export default function UsersPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      try {
        console.log('Fetching users...');
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }
        console.log('Users fetched:', data?.length || 0);
        setUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
    
    // Refresh users every 5 seconds (optional, for testing)
    // const interval = setInterval(fetchUsers, 5000);
    // return () => clearInterval(interval);
  }, [isAdmin, router]);

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) throw error;
        
        // Remove from local state
        setUsers(users.filter(u => u.id !== userId));
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">User Management</h1>
        <Link
          href="/dashboard/users/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center justify-center hover:bg-indigo-700 transition-colors"
        >
          <FiPlus className="mr-2 h-4 w-4" /> Add User
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-lg">
        {/* Mobile view - cards */}
        <div className="lg:hidden">
          {users.map((user) => (
            <div key={user.id} className="border-b border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">{user.full_name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                  <p className="text-xs text-gray-500 mt-1">{user.designation || 'N/A'}</p>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role}
                    </span>
                    <span>{new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex space-x-1 ml-4">
                  <Link
                    href={`/dashboard/users/${user.id}/edit`}
                    className="p-2 text-indigo-600 hover:text-indigo-900"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-2 text-red-600 hover:text-red-900"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500">
              No users found
            </div>
          )}
        </div>

        {/* Desktop view - table */}
        <div className="hidden lg:block">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Designation
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.designation || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/dashboard/users/${user.id}/edit`}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      <FiEdit2 className="inline h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <FiTrash2 className="inline h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}