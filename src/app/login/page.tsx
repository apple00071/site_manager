'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: signInData, error } = await signIn(data.email, data.password);

      if (error) {

        // Handle different error types and provide meaningful messages
        let errorMessage = 'Login failed. Please try again.';

        if (error.message) {
          errorMessage = error.message;
        } else if (error.code === 'invalid_credentials') {
          errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (error.code === 'email_not_confirmed') {
          errorMessage = 'Please confirm your email address before logging in.';
        } else if (error.code === 'too_many_requests') {
          errorMessage = 'Too many login attempts. Please try again later.';
        } else if (error.status === 400) {
          errorMessage = 'Invalid login credentials. Please check your email and password.';
        } else if (error.status === 429) {
          errorMessage = 'Too many login attempts. Please wait before trying again.';
        }

        setError(errorMessage);
        return;
      }

      // Check if we have a session after successful sign in
      if (signInData?.session) {
        // Get the redirect URL from query params or default to dashboard
        const searchParams = new URLSearchParams(window.location.search);
        const redirectTo = searchParams.get('redirectedFrom') || '/dashboard';

        // Add a small delay to ensure authentication state is properly updated
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 100);
      } else {
        // If no session, show an error
        setError('Login successful but no session was established. Please try again.');
      }
    } catch (err: any) {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 p-10 bg-white rounded-xl shadow-md">
        <div className="text-center">
          {/* Logo with fallback */}
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <img
                src="/New-logo.png"
                alt="Apple Interior Manager"
                className="h-24 block"
                onError={(e) => {
                  // Hide the broken image and show fallback
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentNode?.querySelector('.fallback-logo');
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              {/* Fallback text logo - hidden by default, shown on error */}
              <div
                className="fallback-logo text-2xl font-bold text-indigo-600 text-center"
                style={{ display: 'none' }}
              >
                Apple Interior Manager
              </div>
            </div>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Sign in to your account</h2>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Email address"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                {...register('password')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}