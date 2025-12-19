'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface Role {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
}

const userSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, underscore, dot and hyphen allowed'),
  email: z.string().email('Please enter a valid email address'),
  designation: z.string().min(2, 'Designation is required').optional().or(z.literal('')),
  role_id: z.string().min(1, 'Please select a role'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function NewUserPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role_id: '',
    },
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

        // Set default to Employee role if exists
        const employeeRole = allRoles.find((r: Role) => r.name.toLowerCase() === 'employee');
        if (employeeRole) {
          setValue('role_id', employeeRole.id);
        } else if (allRoles.length > 0) {
          setValue('role_id', allRoles[0].id);
        }
      } catch (error) {
        console.error('Error fetching roles:', error);
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchRoles();
  }, [setValue]);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, router]);

  const onSubmit = async (data: UserFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      // Find the selected role to get the role name for legacy support
      const selectedRole = roles.find(r => r.id === data.role_id);

      // Call server-side API route to create user
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          username: data.username,
          full_name: data.full_name,
          designation: data.designation,
          role: selectedRole?.name.toLowerCase() || 'employee', // Legacy field
          role_id: data.role_id, // New role system
          phone_number: data.phone_number || '',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      router.push('/dashboard/organization');
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 lg:hidden">Add New User</h1>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                type="text"
                {...register('username')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
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
                placeholder="e.g., Interior Designer, Project Manager, Carpenter"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.phone_number && (
                <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>
              )}
            </div>

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
              <label htmlFor="role_id" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role_id"
                {...register('role_id')}
                disabled={loadingRoles}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                {loadingRoles ? (
                  <option value="">Loading roles...</option>
                ) : roles.length === 0 ? (
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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => router.push('/dashboard/organization')}
                className="btn-secondary mr-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || loadingRoles}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}