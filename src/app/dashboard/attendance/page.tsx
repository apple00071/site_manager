'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { FiPlus, FiUser, FiClock, FiCalendar, FiClipboard, FiTrash2, FiMapPin, FiSearch } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import LeaveRequestForm from '@/components/leaves/LeaveRequestForm';
import LeaveApprovalModal from '@/components/leaves/LeaveApprovalModal';
import { LeaveCard } from '@/components/leaves/LeaveCard';
import { Modal } from '@/components/ui/Modal';
import { SidePanel } from '@/components/ui/SidePanel';
import { formatDateIST } from '@/lib/dateUtils';
import { DataTable, StatusBadge, Column } from '@/components/ui/DataTable';

interface AttendanceRecord {
    id: string;
    date: string;
    check_in: string;
    check_out?: string;
    user_id: string;
    users?: {
        full_name: string;
        email: string;
    };
    [key: string]: any;
}

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
    [key: string]: any;
}

export default function AttendancePage() {
    const { user, isAdmin } = useAuth();
    const { hasPermission } = useUserPermissions();
    const { showToast } = useToast();
    const { setTitle, setSubtitle } = useHeaderTitle();

    // Tabs
    const [activeTab, setActiveTab] = useState<'attendance' | 'leaves'>('attendance');

    // Set header title
    useEffect(() => {
        setTitle(activeTab === 'attendance' ? 'Attendance' : 'Leaves');
        setSubtitle(null);
    }, [setTitle, setSubtitle, activeTab]);

    // Attendance State
    const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(true);

    // Leaves State
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [leavesLoading, setLeavesLoading] = useState(true);

    // Modal States
    const [showLeaveForm, setShowLeaveForm] = useState(false);
    const [leaveFormType, setLeaveFormType] = useState<string>('Casual Leave');
    const [approvingLeave, setApprovingLeave] = useState<Leave | null>(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Responsiveness
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (activeTab === 'attendance') {
            fetchAttendance();
        } else {
            fetchLeaves();
        }
    }, [activeTab]);

    const fetchAttendance = async () => {
        try {
            setAttendanceLoading(true);
            const res = await fetch('/api/attendance');
            if (res.ok) {
                const data = await res.json();
                setAttendanceLogs(data);
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
            showToast('error', 'Failed to load attendance logs');
        } finally {
            setAttendanceLoading(false);
        }
    };

    const fetchLeaves = async () => {
        try {
            setLeavesLoading(true);
            const res = await fetch('/api/leaves');
            if (res.ok) {
                const data = await res.json();
                setLeaves(data.leaves);
            }
        } catch (error) {
            console.error('Error fetching leaves:', error);
            showToast('error', 'Failed to load leave requests');
        } finally {
            setLeavesLoading(false);
        }
    };

    const filteredAttendance = attendanceLogs.filter(log => {
        const searchLower = searchQuery.toLowerCase();
        const matchesName = log.users?.full_name?.toLowerCase().includes(searchLower);
        const matchesEmail = log.users?.email?.toLowerCase().includes(searchLower);
        const matchesDate = log.date.includes(searchLower);
        return matchesName || matchesEmail || matchesDate;
    });

    const filteredLeaves = leaves.filter(leave => {
        const searchLower = searchQuery.toLowerCase();
        const matchesName = leave.user?.full_name?.toLowerCase().includes(searchLower);
        const matchesEmail = leave.user?.email?.toLowerCase().includes(searchLower);
        const matchesReason = leave.reason?.toLowerCase().includes(searchLower);
        const matchesType = leave.leave_type?.toLowerCase().includes(searchLower);
        return matchesName || matchesEmail || matchesReason || matchesType;
    });

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

    // Columns for Attendance Table
    const attendanceColumns: Column<AttendanceRecord>[] = [
        ...(isAdmin ? [{
            key: 'users.full_name',
            label: 'Employee',
            render: (_: any, row: AttendanceRecord) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <FiUser className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{row.users?.full_name}</span>
                </div>
            )
        }] : []),
        {
            key: 'date',
            label: 'Date',
            render: (_, row) => <span className="text-sm font-medium">{formatDateIST(row.date)}</span>
        },
        {
            key: 'check_in',
            label: 'Punch In',
            render: (_, row: AttendanceRecord) => (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-blue-600 font-medium">
                        {new Date(row.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isAdmin && row.check_in_latitude && row.check_in_longitude && (
                        <a
                            href={`https://www.google.com/maps?q=${row.check_in_latitude},${row.check_in_longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-blue-500 rounded-full hover:bg-blue-50 transition-colors"
                            title="View Check-in Location"
                        >
                            <FiMapPin className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>
            )
        },
        {
            key: 'check_out',
            label: 'Punch Out',
            render: (_, row: AttendanceRecord) => (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-orange-600 font-medium">
                        {row.check_out
                            ? new Date(row.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                    </span>
                    {isAdmin && row.check_out && row.check_out_latitude && row.check_out_longitude && (
                        <a
                            href={`https://www.google.com/maps?q=${row.check_out_latitude},${row.check_out_longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-gray-400 hover:text-orange-500 rounded-full hover:bg-orange-50 transition-colors"
                            title="View Check-out Location"
                        >
                            <FiMapPin className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>
            )
        },
        {
            key: 'duration',
            label: 'Duration',
            render: (_, row) => {
                if (!row.check_out) return <span className="text-xs text-gray-400 italic">In Progress</span>;
                const start = new Date(row.check_in);
                const end = new Date(row.check_out);
                const diff = (end.getTime() - start.getTime()) / (1000 * 60);
                const hours = Math.floor(diff / 60);
                const mins = Math.round(diff % 60);
                return <span className="text-sm font-bold text-gray-900">{hours}h {mins}m</span>;
            }
        }
    ];

    // Columns for Leaves Table
    const leaveColumns: Column<Leave>[] = [
        ...(isAdmin ? [{
            key: 'user.full_name',
            label: 'Employee',
            render: (_: any, row: Leave) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <FiUser className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{row.user?.full_name}</span>
                </div>
            )
        }] : []),
        {
            key: 'leave_type',
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
                            className="flex items-center justify-center p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Review"
                        >
                            <FiClipboard className="h-4 w-4" />
                        </button>
                    )}
                    {user?.id === row.user_id && row.status === 'pending' && (
                        <button
                            onClick={() => handleDeleteLeave(row.id)}
                            className="flex items-center justify-center p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

    if (!mounted) return null;

    return (
        <div className="space-y-6 pt-4">
            {/* Tab Switcher */}
            <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('attendance')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'attendance'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Attendance
                </button>
                <button
                    onClick={() => setActiveTab('leaves')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'leaves'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Leaves
                </button>
            </div>

            {/* Search and Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder={activeTab === 'attendance' ? "Search by employee or date..." : "Search by employee or reason..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all shadow-sm"
                    />
                </div>

                {!isAdmin && (
                    <div className="flex justify-end gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => openLeaveForm('Permission')}
                            className="flex-1 sm:flex-none justify-center bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-sm active:scale-95"
                        >
                            <FiClock className="h-4 w-4" />
                            Request Permission
                        </button>
                        <button
                            onClick={() => openLeaveForm('Casual Leave')}
                            className="flex-1 sm:flex-none justify-center bg-yellow-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-yellow-600 transition-all shadow-sm active:scale-95"
                        >
                            <FiPlus className="h-4 w-4" />
                            Apply for Leave
                        </button>
                    </div>
                )}
            </div>

            {/* Content View */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {activeTab === 'attendance' ? (
                    isMobile ? (
                        <div className="p-4 space-y-4">
                            {attendanceLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="animate-pulse bg-gray-50 h-24 rounded-xl" />
                                ))
                            ) : filteredAttendance.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 text-sm">No attendance logs found.</div>
                            ) : (
                                filteredAttendance.map((log) => (
                                    <div key={log.id} className="p-4 rounded-xl border border-gray-100 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                {isAdmin && (
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                                        <FiUser className="w-4 h-4" />
                                                    </div>
                                                )}
                                                <div>
                                                    {isAdmin && <h4 className="text-sm font-bold text-gray-900">{log.users?.full_name}</h4>}
                                                    <div className="text-xs font-semibold text-gray-500">{formatDateIST(log.date)}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {log.check_out ? (
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</div>
                                                ) : (
                                                    <div className="text-[10px] font-bold text-blue-600 uppercase animate-pulse">In Progress</div>
                                                )}
                                                {log.check_out && (
                                                    <div className="text-sm font-bold text-gray-900">
                                                        {(() => {
                                                            const start = new Date(log.check_in);
                                                            const end = new Date(log.check_out);
                                                            const diff = (end.getTime() - start.getTime()) / (1000 * 60);
                                                            return `${Math.floor(diff / 60)}h ${Math.round(diff % 60)}m`;
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-50">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Punch In</span>
                                                <span className="text-sm font-bold text-blue-600">
                                                    {new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Punch Out</span>
                                                <span className="text-sm font-bold text-orange-600">
                                                    {log.check_out ? new Date(log.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <DataTable
                            columns={attendanceColumns}
                            data={filteredAttendance}
                            keyField="id"
                            loading={attendanceLoading}
                            emptyMessage="No attendance logs found."
                        />
                    )
                ) : (
                    isMobile ? (
                        <div className="p-4 space-y-4">
                            {leavesLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="animate-pulse bg-gray-50 h-32 rounded-xl" />
                                ))
                            ) : filteredLeaves.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 text-sm">No leave requests found.</div>
                            ) : (
                                filteredLeaves.map((leave) => (
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
                            data={filteredLeaves}
                            keyField="id"
                            loading={leavesLoading}
                            emptyMessage="No leave requests found."
                        />
                    )
                )}
            </div>

            {/* Modals & Panels */}
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
