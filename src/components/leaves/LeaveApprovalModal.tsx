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
    const [remarks, setRemarks] = useState(leave.admin_comment || '');
    const [approvedLeaveType, setApprovedLeaveType] = useState(leave.leave_type || 'Paid Leave');

    if (!leave) return null;

    const isPending = leave.status === 'pending';
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
                <div className="text-center pb-5 border-b border-dashed border-gray-100 uppercase tracking-widest text-xs font-bold text-gray-400">
                    {leave.leave_type}
                </div>

                <div className="pt-5 pb-4 grid grid-cols-2 gap-y-5 gap-x-6">
                    {isPermission ? (
                        <>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <FiCalendar className="w-3 h-3" /> Date
                                </div>
                                <p className="text-[13px] font-semibold text-gray-900">{formatDateIST(leave.start_date)}</p>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Time <FiClock className="w-3 h-3" />
                                </div>
                                <p className="text-[13px] font-bold text-blue-600">
                                    {leave.start_time ? formatTimeIST(leave.start_time) : ''} - {leave.end_time ? formatTimeIST(leave.end_time) : ''}
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <FiCalendar className="w-3 h-3" /> Duration
                                </div>
                                <p className="text-[13px] font-semibold text-gray-900">
                                    {formatDateIST(leave.start_date)}
                                    {leave.start_date !== leave.end_date && ` — ${formatDateIST(leave.end_date)}`}
                                </p>
                            </div>

                            <div className="text-right space-y-1">
                                <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Status <FiCheck className="w-3 h-3 text-gray-300" />
                                </div>
                                <div className="flex justify-end">
                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${leave.status === 'approved' ? 'bg-green-50 text-green-600' :
                                        leave.status === 'rejected' ? 'bg-red-50 text-red-600' :
                                            'bg-yellow-50 text-yellow-600'
                                        }`}>
                                        {leave.status}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="col-span-2 space-y-1.5 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            <FiFileText className="w-2.5 h-2.5" /> Reason
                        </div>
                        <p className="text-xs text-gray-800 leading-relaxed font-medium">
                            {leave.reason}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-gray-50">
                {!isPermission && isPending && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                            <span>Approve As Type</span>
                            <span className="text-red-500/50">*</span>
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

                {(isPending || leave.admin_comment) && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Admin Remarks {isPending && <span className="font-medium text-gray-300 lowercase ml-1">(Optional)</span>}
                        </label>
                        {isPending ? (
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-gray-50 border-0 ring-1 ring-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 text-xs resize-none"
                                placeholder="Add notes about approval or rejection..."
                            />
                        ) : (
                            <div className="p-3 bg-blue-50/30 rounded-xl border border-blue-100/50 text-xs text-gray-700 italic leading-relaxed">
                                "{leave.admin_comment}"
                            </div>
                        )}
                    </div>
                )}

                {isPending ? (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                            onClick={() => handleAction('rejected')}
                            disabled={loading}
                            className="flex-1 h-11 border border-red-100 text-red-500 rounded-xl font-bold text-xs hover:bg-red-50 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            <FiX className="w-3.5 h-3.5" />
                            <span>Reject Request</span>
                        </button>
                        <button
                            onClick={() => handleAction('approved')}
                            disabled={loading}
                            className="flex-1 h-11 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            <FiCheck className="w-3.5 h-3.5" />
                            <span>Approve {isPermission ? 'Permission' : 'Leave'}</span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onClose}
                        className="w-full h-11 bg-gray-900 text-white rounded-xl font-bold text-xs hover:bg-gray-800 transition-all active:scale-[0.98]"
                    >
                        Close Details
                    </button>
                )}
            </div>
        </div>
    );
}
