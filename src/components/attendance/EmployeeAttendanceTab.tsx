'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FiClock, FiAlertCircle } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { DataTable, StatusBadge, Column } from '@/components/ui/DataTable';
import { formatDateIST } from '@/lib/dateUtils';
import { Modal } from '@/components/ui/Modal';

interface AttendanceRecord {
    id: string;
    user_id: string;
    date: string;
    check_in: string;
    check_out: string | null;
    status: 'approved' | 'rejected' | 'pending';
    admin_comments: string | null;
    user_comments: string | null;
}

export default function EmployeeAttendanceTab() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Appeal State
    const [appealingRecord, setAppealingRecord] = useState<AttendanceRecord | null>(null);
    const [userComments, setUserComments] = useState('');
    const [submittingAppeal, setSubmittingAppeal] = useState(false);

    useEffect(() => {
        if (user) {
            fetchAttendance();
        }
    }, [user]);

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/attendance?user_id=${user?.id}`);
            if (res.ok) {
                const data = await res.json();
                setAttendance(data);
            } else {
                showToast('error', 'Failed to fetch attendance');
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
            showToast('error', 'An error occurred while fetching attendance');
        } finally {
            setLoading(false);
        }
    };

    const handleAppealSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!appealingRecord || !userComments.trim()) return;

        setSubmittingAppeal(true);
        try {
            const res = await fetch('/api/attendance/appeal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: appealingRecord.id,
                    user_comments: userComments
                })
            });

            if (res.ok) {
                showToast('success', 'Appeal submitted successfully');
                setAppealingRecord(null);
                setUserComments('');
                fetchAttendance(); // Refresh list
            } else {
                const data = await res.json();
                showToast('error', data.error || 'Failed to submit appeal');
            }
        } catch (error) {
            console.error('Error submitting appeal:', error);
            showToast('error', 'An error occurred while submitting the appeal');
        } finally {
            setSubmittingAppeal(false);
        }
    };

    const formatTime = (isoString: string | null) => {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const columns: Column<AttendanceRecord>[] = [
        {
            key: 'date',
            label: 'Date',
            render: (_, row: AttendanceRecord) => <span className="text-sm font-medium">{formatDateIST(row.date)}</span>
        },
        {
            key: 'check_in',
            label: 'Punch In',
            render: (_, row: AttendanceRecord) => (
                <span className="text-sm text-blue-600 font-medium">{formatTime(row.check_in)}</span>
            )
        },
        {
            key: 'check_out',
            label: 'Punch Out',
            render: (_, row: AttendanceRecord) => (
                <div className="flex flex-col gap-1">
                    <span className={`text-sm font-medium ${row.status === 'pending' ? 'text-yellow-600' : 'text-orange-600'}`}>
                        {formatTime(row.check_out)}
                    </span>
                    {row.status === 'pending' && (
                        <span className="w-min px-1.5 py-0.5 text-[9px] font-bold bg-yellow-100 text-yellow-700 rounded uppercase tracking-wider whitespace-nowrap">Pending Check</span>
                    )}
                </div>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (_, row: AttendanceRecord) => {
                if (!row.check_out) return <span className="text-xs text-gray-400 italic">In Progress</span>;
                
                return (
                    <div className="flex flex-col items-start gap-1 max-w-[150px]">
                        {row.status ? (
                            <StatusBadge
                                status={row.status.toUpperCase()}
                                variant={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'error' : 'warning'}
                            />
                        ) : (
                            <span className="text-xs text-green-600 font-medium">Logged</span>
                        )}
                        {row.status === 'rejected' && row.admin_comments && (
                            <p className="text-[10px] text-red-600 leading-tight">Admin: {row.admin_comments}</p>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'actions',
            label: '',
            render: (_, row: AttendanceRecord) => (
                <div className="flex justify-end gap-2 pr-2">
                    <button
                        onClick={() => {
                            setAppealingRecord(row);
                            setUserComments(row.user_comments || '');
                        }}
                        className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm active:scale-95 border border-yellow-200"
                    >
                        Appeal
                    </button>
                    {row.status === 'pending' && row.user_comments && (
                        <span className="text-[10px] text-yellow-600 italic mt-2">Under review</span>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="space-y-4 mt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <FiClock className="text-yellow-500" />
                    My Attendance History
                </h3>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <DataTable
                    columns={columns}
                    data={attendance}
                    keyField="id"
                    loading={loading}
                    emptyMessage="No attendance records found."
                />
            </div>

            {/* Appeal Modal */}
            {appealingRecord && (
                <Modal
                    isOpen={!!appealingRecord}
                    onClose={() => setAppealingRecord(null)}
                    title="Appeal Rejected Attendance"
                >
                    <div className="p-4 sm:p-6 space-y-4">
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 sm:p-4 text-sm text-red-800 flex gap-3 shadow-sm">
                            <FiAlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold mb-1">Reason for Rejection:</p>
                                <p className="leading-tight">
                                    {appealingRecord.admin_comments || 'No specific reason provided by admin.'}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleAppealSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="user_comments" className="block text-sm font-medium text-gray-700 mb-1">
                                    Your Remarks / Justification
                                </label>
                                <textarea
                                    id="user_comments"
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                    placeholder="Explain why this record is correct or provide necessary context..."
                                    value={userComments}
                                    onChange={(e) => setUserComments(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex gap-3 justify-end mt-6">
                                <button
                                    type="button"
                                    onClick={() => setAppealingRecord(null)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                    disabled={submittingAppeal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAppeal || !userComments.trim()}
                                    className="btn-primary"
                                >
                                    {submittingAppeal ? 'Submitting...' : 'Submit Appeal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}
        </div>
    );
}
