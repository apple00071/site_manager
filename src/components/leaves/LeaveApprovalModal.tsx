'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { FiCheck, FiX, FiCalendar, FiUser, FiTag, FiFileText, FiClock } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';

interface LeaveApprovalModalProps {
    leave: any;
    onSuccess: () => void;
    onClose: () => void;
}

export default function LeaveApprovalModal({ leave, onSuccess, onClose }: LeaveApprovalModalProps) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [approvedLeaveType, setApprovedLeaveType] = useState('Paid Leave');

    if (!leave) return null;

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

    const handleAction = async (status: 'approved' | 'rejected') => {
        if (!user) return;

        if (status === 'rejected' && !remarks.trim()) {
            showToast('error', 'Please provide remarks for rejection');
            return;
        }

        setLoading(true);
        try {
            // For general leaves that are approved, the admin sets the finalized leave type
            const finalLeaveType = (status === 'approved' && !isPermission) ? approvedLeaveType : leave.leave_type;

            const response = await fetch(`/api/leaves?id=${leave.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    admin_comment: remarks,
                    leave_type: finalLeaveType,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update status');
            }

            showToast('success', `Request ${status} successfully`);
            onSuccess();
        } catch (error: any) {
            console.error('Error updating leave status:', error);
            showToast('error', error.message || 'Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl overflow-hidden">
                <div className="text-center pb-6 border-b border-dashed border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1 uppercase tracking-wider">Type</p>
                    <div className="text-2xl font-extrabold text-gray-900 tracking-tight">
                        {isPermission ? 'Short Permission' : leave.leave_type}
                    </div>
                </div>

                <div className="py-6 grid grid-cols-2 gap-y-6 gap-x-4">
                    {isPermission ? (
                        <>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    <FiCalendar className="w-3 h-3" /> Date
                                </div>
                                <p className="font-medium text-gray-900">{formatDateIST(leave.start_date)}</p>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="flex items-center justify-end gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Time <FiClock className="w-3 h-3" />
                                </div>
                                <p className="font-medium text-blue-600">
                                    {leave.start_time ? formatTime(leave.start_time) : ''} - {leave.end_time ? formatTime(leave.end_time) : ''}
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    <FiCalendar className="w-3 h-3" /> Start Date
                                </div>
                                <p className="font-medium text-gray-900">{formatDateIST(leave.start_date)}</p>
                            </div>

                            <div className="text-right space-y-1">
                                <div className="flex items-center justify-end gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    End Date <FiCalendar className="w-3 h-3" />
                                </div>
                                <p className="font-medium text-gray-900">{formatDateIST(leave.end_date)}</p>
                            </div>
                        </>
                    )}

                    <div className="col-span-2 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                            <FiFileText className="w-3 h-3" /> Reason
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed font-medium">
                            {leave.reason}
                        </p>
                    </div>

                    <div className="col-span-2 flex items-center gap-3 pt-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <FiUser className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Applied By</p>
                            <p className="text-sm font-bold text-gray-900">{leave.user?.full_name}</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-4 pt-4 border-t border-gray-100">
                    {/* Leave Type Classification (for Admins to decide if Paid or unpaid) */}
                    {!isPermission && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                Leave Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={approvedLeaveType}
                                onChange={(e) => setApprovedLeaveType(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border-0 ring-1 ring-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                            >
                                <option value="Paid Leave">Paid Leave</option>
                                <option value="Casual Leave">Casual Leave</option>
                                <option value="Sick Leave">Sick Leave</option>
                                <option value="Loss of Pay (LOP)">Loss of Pay (LOP)</option>
                            </select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                            Admin Remarks <span className="font-normal text-gray-400 normal-case ml-1">{remarks ? '' : '(Optional)'}</span>
                        </label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-50 border-0 ring-1 ring-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 text-sm resize-none"
                            placeholder="Add notes about approval or rejection reason..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                            onClick={() => handleAction('rejected')}
                            disabled={loading}
                            className="flex-1 px-4 py-3 border border-red-200 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                        >
                            <FiX className="w-4 h-4" />
                            <span>Reject</span>
                        </button>
                        <button
                            onClick={() => handleAction('approved')}
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                        >
                            <FiCheck className="w-4 h-4" />
                            <span>Approve {isPermission ? 'Permission' : 'Leave'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
