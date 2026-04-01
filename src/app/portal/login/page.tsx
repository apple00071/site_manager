'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiLock, FiUser, FiArrowRight } from 'react-icons/fi';

const LoginSchema = z.object({
  username: z.string().min(3, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof LoginSchema>;

export default function PortalLoginPage() {
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setServerError(payload?.error || 'Invalid credentials.');
        return;
      }

      // Fetch user data to find their project
      const userRes = await fetch('/api/auth/session');
      const userData = await userRes.json();
      const user = userData.user;

      if (user?.user_metadata?.role === 'client') {
          // Fetch client project
          const projectRes = await fetch('/api/portal/my-project');
          
          if (!projectRes.ok) {
              const errorData = await projectRes.json();
              setServerError(errorData.error || 'Access denied.');
              return;
          }
          
          const projectData = await projectRes.json();
          if (projectData.project?.id) {
              window.location.replace(`/portal/project/${projectData.project.id}`);
          } else {
              setServerError('No project assigned to your account. Please contact support.');
          }
      } else if (user) {
          // If a staff member tries to log in here, redirect to admin dashboard
          window.location.replace('/dashboard');
      } else {
          setServerError('Authentication failed. Please try again.');
      }
    } catch (err) {
      setServerError('System Error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          <div className="px-10 pt-12 pb-8 text-center border-b border-gray-50">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-lg border border-gray-50 flex items-center justify-center mx-auto mb-6 overflow-hidden">
                <img 
                    src="/New-logo.png" 
                    alt="Logo" 
                    className="h-16 w-auto object-contain"
                    loading="eager"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = '0';
                        (e.target as HTMLImageElement).parentElement!.classList.add('bg-yellow-500');
                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-white font-black text-2xl">A</span>';
                    }}
                />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Client Portal</h1>
            <p className="text-sm text-gray-400 font-medium uppercase tracking-[0.2em]">Secure Access</p>
          </div>

          <div className="p-8">
            {serverError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Portal Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-5 flex items-center text-gray-300 group-focus-within:text-[#eab308] transition-colors">
                    <FiUser size={18} />
                  </div>
                  <input
                    type="text"
                    {...register('username')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-14 pr-6 text-sm focus:outline-none focus:ring-4 focus:ring-[#eab308]/5 focus:bg-white transition-all font-medium"
                    placeholder="Enter your username"
                  />
                </div>
                {errors.username && <p className="mt-2 text-[10px] font-bold text-red-500 ml-1">{errors.username.message}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Secret Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-5 flex items-center text-gray-300 group-focus-within:text-[#eab308] transition-colors">
                    <FiLock size={18} />
                  </div>
                  <input
                    type="password"
                    {...register('password')}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-14 pr-6 text-sm focus:outline-none focus:ring-4 focus:ring-[#eab308]/5 focus:bg-white transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && <p className="mt-2 text-[10px] font-bold text-red-500 ml-1">{errors.password.message}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 text-white rounded-2xl py-4 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : (
                    <>Access Portal <FiArrowRight /></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <div className="mt-10 text-center space-y-4">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">
              &copy; 2026 Apple Interiors &bull; Secure Systems
            </p>
        </div>
      </div>
    </div>
  );
}
