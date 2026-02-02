'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FiPlus, FiCalendar, FiTrash2, FiClipboard, FiInfo, FiClock } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import LeaveRequestForm from '@/components/leaves/LeaveRequestForm';
import LeaveApprovalModal from '@/components/leaves/LeaveApprovalModal';
import { LeaveCard } from '@/components/leaves/LeaveCard';
import { Modal } from '@/components/ui/Modal';
import { SidePanel } from '@/components/ui/SidePanel';
import { formatDateIST } from '@/lib/dateUtils';
import { DataTable, StatusBadge, Column } from '@/components/ui/DataTable';

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

export default function LeaveSection() {
    const { user, isAdmin } = useAuth();
    const { showToast } = useToast();

    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [loading, setLoading] = useState(true);
    const [showLeaveForm, setShowLeaveForm] = useState(false);
    const [leaveFormType, setLeaveFormType] = useState<string>('Casual Leave');
    const [approvingLeave, setApprovingLeave] = useState<Leave | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        fetchLeaves();
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const fetchLeaves = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/leaves');
            if (res.ok) {
                const data = await res.json();
                setLeaves(data.leaves);
            }
        } catch (error) {
            console.error('Error fetching leaves:', error);
            showToast('error', 'Failed to load leave requests');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteLeave = async (id: string) => {
        if (!confirm('Are you sure you want to delete this leave request?')) return;
        try {
            const res = await fetch(`/api/leaves?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('success', 'Leave request deleted successfully');
                fetchLeaves();
            } else {
                throw new Error('Failed to delete');
            }
        } catch (error) {
            showToast('error', 'Failed to delete leave request');
        }
    };

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

    const leaveColumns: Column<Leave>[] = [
        {
            key: 'type',
            label: 'Type',
            render: (_, row) => (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${row.leave_type === 'Permission' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {row.leave_type}
                </span>
            )
        },
        {
            key: 'dates',
            label: 'Schedule',
            render: (_, row) => (
                <div className="text-[11px] sm:text-xs font-semibold text-gray-900 leading-tight">
                    {row.leave_type === 'Permission' ? (
                        <div className="flex flex-col">
                            <span className="whitespace-nowrap">{formatDateIST(row.start_date)}</span>
                            <span className="text-blue-600 text-[9px] sm:text-[10px] whitespace-nowrap">
                                {row.start_time ? formatTime(row.start_time) : ''} - {row.end_time ? formatTime(row.end_time) : ''}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row sm:gap-1">
                            <span className="whitespace-nowrap">{formatDateIST(row.start_date)}</span>
                            {row.start_date !== row.end_date && (
                                <>
                                    <span className="hidden sm:inline">-</span>
                                    <span className="whitespace-nowrap">{formatDateIST(row.end_date)}</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (_, row) => (
                <StatusBadge
                    status={row.status.toUpperCase()}
                    variant={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'error' : 'warning'}
                />
            )
        },
        {
            key: 'actions',
            label: '',
            render: (_, row) => (
                <div className="flex justify-end gap-2">
                    {isAdmin && row.status === 'pending' && (
                        <button
                            onClick={() => setApprovingLeave(row)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Review"
                        >
                            <FiClipboard className="h-4 w-4" />
                        </button>
                    )}
                    {user?.id === row.user_id && row.status === 'pending' && (
                        <button
                            onClick={() => handleDeleteLeave(row.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancel"
                        >
                            <FiTrash2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
            )
        }
    ];

    const openLeaveForm = (type: string = 'Casual Leave') => {
        setLeaveFormType(type);
        setShowLeaveForm(true);
    };

    return (
        <div className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <FiCalendar className="text-yellow-500" />
                    Leave Management
                </h3>
                {!isAdmin && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => openLeaveForm('Permission')}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-sm active:scale-95"
                        >
                            <FiClock className="h-3.5 w-3.5" />
                            Request Permission
                        </button>
                        <button
                            onClick={() => openLeaveForm('Casual Leave')}
                            className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-yellow-600 transition-all shadow-sm active:scale-95"
                        >
                            <FiPlus className="h-3.5 w-3.5" />
                            Apply for Leave
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {isMobile ? (
                    <div className="p-4 space-y-4">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="animate-pulse bg-gray-50 h-32 rounded-xl" />
                            ))
                        ) : leaves.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 text-sm">No leave requests found.</div>
                        ) : (
                            leaves.map((leave) => (
                                <LeaveCard
                                    key={leave.id}
                                    leave={leave}
                                    isAdmin={isAdmin}
                                    currentUserId={user?.id || ''}
                                    onReview={(l) => setApprovingLeave(l)}
                                    onDelete={(id) => handleDeleteLeave(id)}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    <DataTable
                        columns={leaveColumns}
                        data={leaves}
                        keyField="id"
                        loading={loading}
                        emptyMessage="No leave requests found."
                    />
                )}
            </div>

            {/* Form Panels */}
            {showLeaveForm && (
                <SidePanel
                    isOpen={showLeaveForm}
                    onClose={() => setShowLeaveForm(false)}
                    title={leaveFormType === 'Permission' ? "Short Period Permission" : "Apply for Leave"}
                >
                    <LeaveRequestForm
                        defaultType={leaveFormType}
                        onSuccess={() => {
                            setShowLeaveForm(false);
                            fetchLeaves();
                        }}
                        onCancel={() => setShowLeaveForm(false)}
                    />
                </SidePanel>
            )}

            {approvingLeave && (
                <Modal
                    isOpen={!!approvingLeave}
                    onClose={() => setApprovingLeave(null)}
                    title="Review Leave Request"
                >
                    <LeaveApprovalModal
                        leave={approvingLeave}
                        onSuccess={() => { setApprovingLeave(null); fetchLeaves(); }}
                        onClose={() => setApprovingLeave(null)}
                    />
                </Modal>
            )}
        </div>
    );
}
