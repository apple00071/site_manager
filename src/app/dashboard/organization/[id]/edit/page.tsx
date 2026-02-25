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

interface Role {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
}

const userSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, underscore, dot and hyphen allowed'),
  full_name: z.string().min(2, 'Full name is required'),
  designation: z.string().min(2, 'Designation is required'),
  role_id: z.string().min(1, 'Please select a role'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  base_salary: z.coerce.number().min(0).default(0),
  hra: z.coerce.number().min(0).default(0),
  special_allowance: z.coerce.number().min(0).default(0),
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
  const [showPassword, setShowPassword] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema) as any,
  });

  // Fetch roles from API
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch('/api/rbac/roles');
        if (!response.ok) {
          throw new Error('Failed to fetch roles');
        }
        const data = await response.json();
        const allRoles = data.roles || [];
        setRoles(allRoles);
      } catch (error) {
        console.error('Error fetching roles:', error);
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchRoles();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }

    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/admin/users?id=${userId}`);
        if (!res.ok) throw new Error('Failed to fetch user');
        const data = await res.json();

        setUser(data);

        // Find the role_id - prefer role_id field, fallback to matching by name
        let roleId = data.role_id || '';
        if (!roleId && data.role && roles.length > 0) {
          const matchingRole = roles.find(r => r.name.toLowerCase() === data.role.toLowerCase());
          if (matchingRole) {
            roleId = matchingRole.id;
          }
        }

        // Fetch salary data
        const { data: salaryData } = await supabase
          .from('employee_salary_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        reset({
          email: data.email,
          username: data.username || '',
          full_name: data.full_name,
          designation: data.designation || '',
          role_id: roleId,
          phone_number: data.phone_number || '',
          base_salary: salaryData?.base_salary || 0,
          hra: salaryData?.hra || 0,
          special_allowance: salaryData?.special_allowance || 0,
        });
      } catch (error) {
        console.error('Error fetching user:', error);
        router.push('/dashboard/organization');
      } finally {
        setLoading(false);
      }
    };

    if (userId && !loadingRoles) {
      fetchUser();
    }
  }, [userId, isAdmin, router, reset, roles, loadingRoles]);

  // Update role_id when roles are loaded and user data is available
  useEffect(() => {
    if (user && roles.length > 0 && !loading) {
      let roleId = user.role_id || '';
      if (!roleId && user.role) {
        const matchingRole = roles.find(r => r.name.toLowerCase() === user.role.toLowerCase());
        if (matchingRole) {
          roleId = matchingRole.id;
          setValue('role_id', roleId);
        }
      }
    }
  }, [user, roles, loading, setValue]);

  const onSubmit = async (data: UserFormValues) => {
    setSaving(true);
    try {
      // Find the selected role to get the role name for legacy support
      const selectedRole = roles.find(r => r.id === data.role_id);

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: userId,
          email: data.email,
          username: data.username,
          full_name: data.full_name,
          designation: data.designation,
          role: selectedRole?.name.toLowerCase() || 'employee', // Legacy field
          role_id: data.role_id, // New role system
          phone_number: data.phone_number || '',
          password: data.password || '',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user');
      }

      // Step 2: Update Salary Profile
      await fetch('/api/payroll/salary-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          base_salary: data.base_salary,
          hra: data.hra,
          special_allowance: data.special_allowance,
        }),
      });

      router.push('/dashboard/organization');
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert(error.message || 'Failed to update user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingRoles) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">User not found</p>
        <Link href="/dashboard/organization" className="text-yellow-600 hover:text-yellow-700">
          Back to Organization
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Mobile header with back button */}
      <div className="lg:hidden flex items-center space-x-2 mb-4">
        <BackButton href="/dashboard/organization" />
        <h1 className="text-lg font-semibold text-gray-900">Edit User</h1>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  {...register('username')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                />
                {errors.designation && (
                  <p className="mt-1 text-sm text-red-600">{errors.designation.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  id="phone_number"
                  type="tel"
                  {...register('phone_number')}
                  placeholder="e.g., +91 9876543210"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                />
                {errors.phone_number && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="role_id" className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  id="role_id"
                  {...register('role_id')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                >
                  {roles.length === 0 ? (
                    <option value="">No roles available</option>
                  ) : (
                    roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))
                  )}
                </select>
                {errors.role_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.role_id.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  New Password (leave blank to keep current password)
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    placeholder="Enter new password (optional)"
                    className="block w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-500"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Salary Details (Monthly)</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div>
                  <label htmlFor="base_salary" className="block text-sm font-medium text-gray-700">
                    Base Salary (₹)
                  </label>
                  <input
                    id="base_salary"
                    type="number"
                    {...register('base_salary')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                  />
                  {errors.base_salary && (
                    <p className="mt-1 text-sm text-red-600">{errors.base_salary.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="hra" className="block text-sm font-medium text-gray-700">
                    HRA (₹)
                  </label>
                  <input
                    id="hra"
                    type="number"
                    {...register('hra')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                  />
                  {errors.hra && (
                    <p className="mt-1 text-sm text-red-600">{errors.hra.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="special_allowance" className="block text-sm font-medium text-gray-700">
                    Special Allowance (₹)
                  </label>
                  <input
                    id="special_allowance"
                    type="number"
                    {...register('special_allowance')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                  />
                  {errors.special_allowance && (
                    <p className="mt-1 text-sm text-red-600">{errors.special_allowance.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Link
                href="/dashboard/organization"
                className="btn-secondary"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
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
