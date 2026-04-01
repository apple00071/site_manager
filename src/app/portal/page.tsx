'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';

/**
 * Smart Redirector for the Client Portal.
 * This page finds the client's assigned project and sends them to the correct dashboard.
 */
export default function PortalRedirector() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            router.replace('/portal/login');
            return;
        }

        const findAndRedirect = async () => {
            try {
                const res = await fetch('/api/portal/my-project');
                
                if (!res.ok) {
                    const data = await res.json();
                    setError(data.error || 'Access denied.');
                    return;
                }
                
                const data = await res.json();
                if (data.project?.id) {
                    router.replace(`/portal/project/${data.project.id}`);
                } else {
                    setError('No project assigned to your account. Please contact support.');
                }
            } catch (err) {
                setError('A system error occurred. Please try again.');
            }
        };

        findAndRedirect();
    }, [user, authLoading, router]);

    if (authLoading || (!error && user)) {
        return (
            <div className="min-h-screen bg-[#fafaf8] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-8 animate-bounce overflow-hidden border border-gray-50">
                    <img 
                        src="/New-logo.png" 
                        alt="Apple Interiors" 
                        className="w-10 h-10 object-contain"
                        loading="eager"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.classList.add('bg-yellow-500');
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-white font-black text-xl">A</span>';
                        }}
                    />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Accessing Portal</h1>
                <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto">We're finding your project dashboard, just a moment...</p>
                <div className="flex items-center gap-3 px-6 py-3 bg-white/50 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-sm text-gray-400">
                    <FiLoader className="animate-spin text-[#eab308]" size={18} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verifying Access</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#fafaf8] flex flex-col items-center justify-center p-10 text-center">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-8">
                    <FiAlertCircle size={40} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Portal Access Unavailable</h1>
                <p className="text-gray-600 mb-10 max-w-sm mx-auto leading-relaxed">{error}</p>
                <button 
                    onClick={() => router.push('/portal/login')}
                    className="px-8 py-4 bg-gray-900 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-black transition-all shadow-xl"
                >
                    Back to Login
                </button>
            </div>
        );
    }

    return null;
}
