'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { FiCheck, FiX, FiCalendar, FiClock, FiFileText } from 'react-icons/fi';
import { formatDateIST, formatTimeIST } from '@/lib/dateUtils';
import { CustomDropdown } from '@/components/ui/CustomControls';

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
        <div className="space-y-4">
            <div className="bg-white rounded-xl overflow-hidden">
                {isPermission && (
                    <div className="text-center pb-4 border-b border-dashed border-gray-200">
                        <p className="text-xs font-medium text-gray-400 mb-0.5 uppercase tracking-wider">Type</p>
                        <div className="text-xl font-extrabold text-gray-900 tracking-tight">
                            Short Permission
                        </div>
                    </div>
                )}

                <div className="pt-2 pb-4 grid grid-cols-2 gap-y-4 gap-x-4">
                    {isPermission ? (
                        <>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    <FiCalendar className="w-2.5 h-2.5" /> Date
                                </div>
                                <p className="text-sm font-semibold text-gray-900">{formatDateIST(leave.start_date)}</p>
                            </div>
                            <div className="text-right space-y-0.5">
                                <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    Time <FiClock className="w-2.5 h-2.5" />
                                </div>
                                <p className="text-sm font-semibold text-blue-600 leading-none">
                                    {leave.start_time ? formatTimeIST(leave.start_time) : ''} - {leave.end_time ? formatTimeIST(leave.end_time) : ''}
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    <FiCalendar className="w-2.5 h-2.5" /> Start Date
                                </div>
                                <p className="text-sm font-semibold text-gray-900">{formatDateIST(leave.start_date)}</p>
                            </div>

                            <div className="text-right space-y-0.5">
                                <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    End Date <FiCalendar className="w-2.5 h-2.5" />
                                </div>
                                <p className="text-sm font-semibold text-gray-900">{formatDateIST(leave.end_date)}</p>
                            </div>
                        </>
                    )}

                    <div className="col-span-2 space-y-1 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            <FiFileText className="w-2.5 h-2.5" /> Reason
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed font-medium">
                            {leave.reason}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-gray-100">
                {!isPermission && (
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                            Leave Type <span className="text-red-500">*</span>
                        </label>
                        <CustomDropdown
                            value={approvedLeaveType}
                            onChange={setApprovedLeaveType}
                            options={[
                                { id: 'Paid Leave', title: 'Paid Leave' },
                                { id: 'Loss of Pay (LOP)', title: 'Loss of Pay (LOP)' }
                            ]}
                        />
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                        Admin Remarks <span className="font-normal text-gray-400 normal-case ml-1">{remarks ? '' : '(Optional)'}</span>
                    </label>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-50 border-0 ring-1 ring-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 text-xs resize-none"
                        placeholder="Add notes about approval or rejection..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                        onClick={() => handleAction('rejected')}
                        disabled={loading}
                        className="flex-1 h-11 border border-red-200 text-red-600 rounded-xl font-bold text-xs hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                    >
                        <FiX className="w-3.5 h-3.5" />
                        <span>Reject</span>
                    </button>
                    <button
                        onClick={() => handleAction('approved')}
                        disabled={loading}
                        className="flex-1 h-11 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                    >
                        <FiCheck className="w-3.5 h-3.5" />
                        <span>Approve {isPermission ? 'Permission' : 'Leave'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
