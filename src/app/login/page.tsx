'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';

const LoginSchema = z.object({
  identifier: z.string().min(3, 'Enter username or email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setServerError(null);
    try {
      const isEmail = values.identifier.includes('@');
      const payload: any = isEmail ? { email: values.identifier, password: values.password } : { username: values.identifier, password: values.password };
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setServerError(payload?.error || 'Invalid credentials.');
        return;
      }

      // Hard redirect to ensure cookies are included in request
      window.location.replace('/dashboard');
    } catch (err) {
      setServerError('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-gray-50 flex items-center justify-center p-4 sm:p-6 safe-area-inset-top safe-area-inset-bottom">
      <div className="w-full max-w-sm sm:max-w-md bg-white shadow-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-100 animate-scale-in">
        <div className="text-center mb-6 sm:mb-8">
          <img
            src="/New-logo.png"
            alt="Apple Interior Manager"
            className="h-16 sm:h-20 mx-auto mb-3 sm:mb-4"
            onError={(e) => {
              // Fallback if logo fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">Apple Interior Manager</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-2">Sign in to access your dashboard</p>
        </div>

        {serverError && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
          <div>
            <label htmlFor="identifier" className="block text-sm font-semibold text-gray-700 mb-2">Username or Email</label>
            <input
              id="identifier"
              type="text"
              {...register('identifier')}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 sm:py-4 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
              placeholder="yourusername or you@example.com"
              aria-invalid={!!errors.identifier || undefined}
              aria-describedby={errors.identifier ? 'identifier-error' : undefined}
              autoComplete="username"
            />
            {errors.identifier && (
              <p id="identifier-error" className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                {errors.identifier.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 sm:py-4 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
              placeholder="••••••••"
              aria-invalid={!!errors.password || undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
              autoComplete="current-password"
            />
            {errors.password && (
              <p id="password-error" className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-yellow-500 px-4 py-3 sm:py-4 text-gray-900 text-sm sm:text-base font-bold hover:bg-yellow-600 active:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm touch-target"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-900 mr-2"></div>
                Signing in…
              </div>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}