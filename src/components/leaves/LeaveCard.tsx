'use client';

import React from 'react';
import { FiUser, FiCalendar, FiClock, FiClipboard, FiTrash2 } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';
import { StatusBadge } from '@/components/ui/DataTable';

interface Leave {
    id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    start_time?: string;
    end_time?: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    admin_comment?: string;
    created_at: string;
    user_id: string;
    user?: {
        full_name: string;
        email: string;
    };
}

interface LeaveCardProps {
    leave: Leave;
    isAdmin: boolean;
    currentUserId: string;
    onReview?: (leave: Leave) => void;
    onDelete?: (id: string) => void;
}

export const LeaveCard: React.FC<LeaveCardProps> = ({
    leave,
    isAdmin,
    currentUserId,
    onReview,
    onDelete
}) => {
    const isPermission = leave.leave_type === 'Permission';

    const formatTime = (time: string) => {
        try {
            const [hours, minutes] = time.split(':');
            const date = new Date();
            date.setHours(parseInt(hours), parseInt(minutes));
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {
            return time;
        }
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                            <FiUser className="w-4 h-4" />
                        </div>
                    )}
                    <div>
                        {isAdmin && <h4 className="text-sm font-bold text-gray-900">{leave.user?.full_name}</h4>}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isPermission ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                            {leave.leave_type}
                        </span>
                    </div>
                </div>
                <StatusBadge
                    status={leave.status.toUpperCase()}
                    variant={leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'error' : 'warning'}
                />
            </div>

            <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <FiCalendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>
                        {formatDateIST(leave.start_date)}
                        {!isPermission && leave.start_date !== leave.end_date && ` - ${formatDateIST(leave.end_date)}`}
                    </span>
                </div>
                {isPermission && (
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                        <FiClock className="w-3.5 h-3.5" />
                        <span>
                            {leave.start_time ? formatTime(leave.start_time) : ''} - {leave.end_time ? formatTime(leave.end_time) : ''}
                        </span>
                    </div>
                )}
            </div>

            <div className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Reason</span>
                <p className="italic">"{leave.reason}"</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
                {isAdmin && leave.status === 'pending' && (
                    <button
                        onClick={() => onReview?.(leave)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                        <FiClipboard className="h-3.5 w-3.5" />
                        Review
                    </button>
                )}
                {currentUserId === leave.user_id && leave.status === 'pending' && (
                    <button
                        onClick={() => onDelete?.(leave.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                        <FiTrash2 className="h-3.5 w-3.5" />
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};
