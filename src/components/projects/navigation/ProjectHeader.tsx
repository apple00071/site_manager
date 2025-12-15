'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiMoreVertical, FiClock, FiCheckCircle, FiUploadCloud, FiAlertCircle } from 'react-icons/fi';
import { OptimizedNotificationBell } from '@/components/OptimizedNotificationBell';

interface User {
    name: string;
    email?: string;
}

interface ProjectHeaderProps {
    title: string;
    jobId?: string;
    status: string;
    customerName: string;
    onBack?: () => void;
    user?: User | null;
}

export function ProjectHeader({ title, jobId, status, customerName, onBack, user }: ProjectHeaderProps) {
    const router = useRouter();

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': return 'bg-green-100 text-green-700';
            case 'in_progress': return 'bg-blue-100 text-blue-700';
            default: return 'bg-yellow-100 text-yellow-700';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': return <FiCheckCircle className="w-3.5 h-3.5" />;
            case 'in_progress': return <FiClock className="w-3.5 h-3.5" />;
            default: return <FiAlertCircle className="w-3.5 h-3.5" />;
        }
    };

    const displayStatus = status?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN';

    // Get initials for avatar
    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    return (
        <div className="bg-white border-b border-gray-200">

            {/* DESKTOP HEADER (md+) */}
            <div className="hidden md:flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center text-gray-500 text-sm font-medium">
                        <span className="cursor-pointer hover:text-gray-700" onClick={() => router.push('/dashboard')}>All Projects</span>
                        <span className="mx-2">/</span>
                        <span className="text-gray-900 font-bold text-lg">{title}</span>
                    </div>


                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">Project Status :</span>
                        <span className={`font-semibold flex items-center gap-1.5 ${status === 'completed' ? 'text-green-600' :
                            status === 'in_progress' ? 'text-teal-600' : 'text-amber-600'
                            }`}>
                            {displayStatus}
                            <FiClock className="w-4 h-4" />
                        </span>
                    </div>

                    <OptimizedNotificationBell />

                    {user && (
                        <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
                            <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-xs">
                                {getInitials(user.name)}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700 leading-tight">{user.name}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MOBILE HEADER (md-) */}
            <div className="flex md:hidden items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-gray-900 truncate leading-snug">
                                {title}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 truncate max-w-[120px] sm:max-w-[200px]">
                                {customerName}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${getStatusColor(status)}`}>
                                {getStatusIcon(status)}
                                {displayStatus}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center pl-2">
                    <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full">
                        <FiMoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
