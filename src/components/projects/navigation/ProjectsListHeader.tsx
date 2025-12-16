import React from 'react';
import { useRouter } from 'next/navigation';
import { FiBell } from 'react-icons/fi';
import { OptimizedNotificationBell } from '@/components/OptimizedNotificationBell';

interface User {
    name: string;
    email?: string;
}

interface ProjectsListHeaderProps {
    user?: User | null;
}

export function ProjectsListHeader({ user }: ProjectsListHeaderProps) {
    const router = useRouter();

    // Get initials for avatar
    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    return (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
            {/* DESKTOP HEADER (md+) */}
            <div className="hidden md:flex items-center justify-between px-4 py-1.5">
                <div className="flex items-center gap-4">
                    <h1 className="text-gray-900 font-semibold text-sm">Projects</h1>
                </div>

                <div className="flex items-center gap-4">
                    <OptimizedNotificationBell />

                    {user && (
                        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                            <div className="h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-[10px] shadow-sm">
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
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-bold text-gray-900">Projects</h1>
                </div>

                <div className="flex items-center gap-3">
                    <OptimizedNotificationBell />
                    {user && (
                        <div className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                            {getInitials(user.name)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
