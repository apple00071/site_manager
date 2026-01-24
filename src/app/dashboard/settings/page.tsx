'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  current_password: z.string().optional(),
  new_password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  confirm_password: z.string().optional(),
}).refine(data => {
  if (data.new_password && !data.current_password) {
    return false;
  }
  return true;
}, {
  message: "Current password is required to set a new password",
  path: ["current_password"],
}).refine(data => {
  if (data.new_password && data.new_password !== data.confirm_password) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user, updateUserEmail } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      email: '',
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchUserProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          // If user record doesn't exist yet, try to create it via API
          if (error.code === 'PGRST116' || error.code === '42501') {
            console.log('User record not found in users table, creating via API...');
            try {
              const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: user.email || '',
                  full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                  role: user.user_metadata?.role || 'employee',
                  password: 'temp123456' // Temporary password, should be reset
                })
              });

              if (response.ok) {
                // Fetch the created user
                const { data: newUser, error: fetchError } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', user.id)
                  .single();

                if (!fetchError && newUser) {
                  setUserProfile(newUser);
                  reset({
                    full_name: newUser.full_name || '',
                    email: user.email || '',
                  });
                  return;
                }
              }
            } catch (apiError) {
              console.error('Error creating user via API:', apiError);
            }
          }
          // If still can't create, use auth user data
          setUserProfile({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            role: user.user_metadata?.role || 'employee'
          } as any);
          reset({
            full_name: user.user_metadata?.full_name || '',
            email: user.email || '',
          });
          return;
        }

        setUserProfile(data);
        reset({
          full_name: data.full_name || '',
          email: user.email || '',
        });
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [user, router, reset]);

  const onSubmit = async (data: ProfileFormValues) => {
    setLoading(true);
    setMessage(null);

    try {
      // Update profile information
      const { error: profileError } = await supabase
        .from('users')
        .update({
          full_name: data.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (data.email !== user?.email) {
        await updateUserEmail(data.email);
      }

      // Update password if provided
      if (data.current_password && data.new_password) {
        const response = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_password: data.new_password }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to update password');
        }
      }

      setMessage({
        type: 'success',
        text: 'Profile updated successfully',
      });

      // Redirect back to dashboard after successful update
      router.push('/dashboard');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'An error occurred while updating your profile',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || !userProfile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <header className="lg:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold leading-tight text-gray-900">Settings</h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          <div className="px-4 py-8 sm:px-0">
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Profile Information</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">Update your account settings</p>
              </div>

              {message && (
                <div className={`px-4 py-3 ${message.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                    {message.text}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <div className="mt-1">
                      <input
                        id="full_name"
                        type="text"
                        {...register('full_name')}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      {errors.full_name && (
                        <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <div className="mt-1">
                      <input
                        id="email"
                        type="email"
                        {...register('email')}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-5">
                    <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
                    <p className="mt-1 text-sm text-gray-500">Leave blank if you don't want to change your password</p>
                  </div>

                  <div>
                    <label htmlFor="current_password" className="block text-sm font-medium text-gray-700">
                      Current Password
                    </label>
                    <div className="mt-1 relative">
                      <input
                        id="current_password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        {...register('current_password')}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(prev => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-500"
                      >
                        {showCurrentPassword ? 'Hide' : 'Show'}
                      </button>
                      {errors.current_password && (
                        <p className="mt-1 text-sm text-red-600">{errors.current_password.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="new_password" className="block text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <div className="mt-1 relative">
                      <input
                        id="new_password"
                        type={showNewPassword ? 'text' : 'password'}
                        {...register('new_password')}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(prev => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-500"
                      >
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                      {errors.new_password && (
                        <p className="mt-1 text-sm text-red-600">{errors.new_password.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                      Confirm New Password
                    </label>
                    <div className="mt-1 relative">
                      <input
                        id="confirm_password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        {...register('confirm_password')}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-500"
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                      {errors.confirm_password && (
                        <p className="mt-1 text-sm text-red-600">{errors.confirm_password.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
