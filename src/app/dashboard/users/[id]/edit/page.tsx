'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import Link from 'next/link';
import BackButton from '@/components/BackButton';

const userSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  full_name: z.string().min(2, 'Full name is required'),
  designation: z.string().min(2, 'Designation is required'),
  role: z.enum(['admin', 'employee']),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function EditUserPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }

    const fetchUser = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;
        
        setUser(data);
        reset({
          email: data.email,
          full_name: data.full_name,
          designation: data.designation || '',
          role: data.role,
        });
      } catch (error) {
        console.error('Error fetching user:', error);
        router.push('/dashboard/users');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId, isAdmin, router, reset]);

  const onSubmit = async (data: UserFormValues) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          email: data.email,
          full_name: data.full_name,
          designation: data.designation,
          role: data.role,
        })
        .eq('id', userId);

      if (error) throw error;
      
      router.push('/dashboard/users');
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">User not found</p>
        <Link href="/dashboard/users" className="text-indigo-600 hover:text-indigo-900">
          Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Mobile header with back button */}
      <div className="lg:hidden flex items-center space-x-2 mb-4">
        <BackButton href="/dashboard/users" />
        <h1 className="text-lg font-semibold text-gray-900">Edit User</h1>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
          <Link
            href="/dashboard/users"
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Link>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  id="full_name"
                  type="text"
                  {...register('full_name')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="designation" className="block text-sm font-medium text-gray-700">
                  Designation
                </label>
                <input
                  id="designation"
                  type="text"
                  {...register('designation')}
                  placeholder="e.g., Interior Designer, Project Manager"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.designation && (
                  <p className="mt-1 text-sm text-red-600">{errors.designation.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  id="role"
                  {...register('role')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.role && (
                  <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Link
                href="/dashboard/users"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
              >
                <FiSave className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
