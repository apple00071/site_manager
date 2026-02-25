'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { FiPlayCircle, FiCheckCircle, FiTrash2, FiDownload, FiEye, FiX } from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';
import { DataTable, Column, StatusBadge } from '@/components/ui/DataTable';
import { formatDateIST } from '@/lib/dateUtils';

interface PayrollRecord {
    id: string;
    user_id: string;
    users?: {
        full_name: string;
        email: string;
        designation: string;
    };
    month: number;
    year: number;
    total_days: number;
    worked_days: number;
    paid_leaves: number;
    unpaid_leaves: number;
    base_pay_earned: number;
    allowances_earned: number;
    reimbursements: number;
    bonus: number;
    deductions: number;
    net_pay: number;
    status: 'draft' | 'processed' | 'paid' | 'cancelled';
    created_at: string;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AdminPayrollDashboard() {
    const { user: adminUser } = useAuth();
    const { showToast } = useToast();

    const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [targetEmployeeId, setTargetEmployeeId] = useState<string>('');
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    useEffect(() => {
        fetchPayrolls();
        fetchEmployees();
    }, []);

    const fetchPayrolls = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/payroll?month=${selectedMonth}&year=${selectedYear}`);
            if (res.ok) {
                const data = await res.json();
                setPayrolls(data);
            }
        } catch (error) {
            console.error('Error fetching payrolls:', error);
            showToast('error', 'Failed to fetch payroll records.');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                // Admin Users API returns a direct array of users
                setEmployees(Array.isArray(data) ? data : (data.users || []));
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const generatePayroll = async () => {
        if (!targetEmployeeId) {
            showToast('error', 'Please select an employee first');
            return;
        }

        try {
            const res = await fetch('/api/admin/payroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: targetEmployeeId,
                    month: selectedMonth,
                    year: selectedYear,
                    adminId: adminUser?.id
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to generate payroll');
            }

            const result = await res.json();
            const message = targetEmployeeId === 'all'
                ? `Processed ${result.count || 0} payrolls successfully.`
                : 'Payroll generated successfully';

            showToast('success', message);
            fetchPayrolls();
        } catch (error: any) {
            showToast('error', error.message);
        }
    };

    const updatePayrollStatus = async (payrollId: string, status: 'processed' | 'paid') => {
        try {
            const res = await fetch(`/api/admin/payroll?id=${payrollId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (!res.ok) throw new Error('Failed to update status');

            showToast('success', `Payroll marked as ${status}`);
            fetchPayrolls();
        } catch (error: any) {
            showToast('error', error.message);
        }
    };

    const deletePayroll = async (payrollId: string) => {
        if (!confirm('Are you sure you want to delete this payroll record?')) return;

        try {
            const res = await fetch(`/api/admin/payroll?id=${payrollId}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Failed to delete payroll');

            showToast('success', 'Payroll deleted');
            fetchPayrolls();
        } catch (error: any) {
            showToast('error', error.message);
        }
    };

    const columns: Column<PayrollRecord>[] = [
        {
            key: 'employee',
            label: 'Employee',
            render: (_, row) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{row.users?.full_name || 'Unknown'}</span>
                    <span className="text-xs text-gray-500">{row.users?.designation || 'Staff'}</span>
                </div>
            )
        },
        {
            key: 'attendance',
            label: 'Attendance (Paid/Working)',
            render: (_, row) => (
                <div className="flex flex-col">
                    <span className="text-sm">{row.worked_days + row.paid_leaves} / {row.total_days} Days</span>
                    {row.unpaid_leaves > 0 && <span className="text-xs font-semibold text-red-500">Unpaid: {row.unpaid_leaves}</span>}
                </div>
            )
        },
        {
            key: 'net_pay',
            label: 'Net Pay',
            render: (_, row) => (
                <span className="font-bold text-gray-900">
                    ₹{row.net_pay.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (_, row) => (
                <StatusBadge
                    status={row.status.toUpperCase()}
                    variant={row.status === 'paid' ? 'success' : row.status === 'processed' ? 'info' : row.status === 'draft' ? 'warning' : 'error'}
                />
            )
        },
        {
            key: 'actions',
            label: 'Manage',
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setSelectedPayroll(row); setIsViewModalOpen(true); }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Details"
                    >
                        <FiEye className="w-4 h-4" />
                    </button>
                    {row.status === 'draft' && (
                        <button
                            onClick={() => updatePayrollStatus(row.id, 'processed')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Mark as Processed"
                        >
                            <FiPlayCircle className="w-4 h-4" />
                        </button>
                    )}
                    {row.status === 'processed' && (
                        <button
                            onClick={() => updatePayrollStatus(row.id, 'paid')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Mark as Paid"
                        >
                            <FiCheckCircle className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => deletePayroll(row.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Record"
                    >
                        <FiTrash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="w-full space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Generate Payroll</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end gap-4 w-full">
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                        <select
                            value={targetEmployeeId}
                            onChange={(e) => setTargetEmployeeId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm"
                        >
                            <option value="">Select Employee...</option>
                            <option value="all" className="font-bold text-yellow-700">All Employees</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm"
                        >
                            {MONTHS.map((m, idx) => (
                                <option key={idx} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                        <input
                            type="number"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm"
                        />
                    </div>
                    <div className="w-full">
                        <button
                            onClick={generatePayroll}
                            className="w-full bg-yellow-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-yellow-700 transition"
                        >
                            {targetEmployeeId === 'all' ? 'Generate for All' : 'Generate'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-gray-900">
                        Payroll Records ({MONTHS[selectedMonth - 1]} {selectedYear})
                    </h2>
                    <button
                        onClick={fetchPayrolls}
                        className="text-sm text-blue-600 hover:text-blue-800 font-semibold self-start sm:self-auto"
                    >
                        Refresh List
                    </button>
                </div>
                <div className="hidden md:block overflow-x-auto">
                    <DataTable
                        columns={columns}
                        data={payrolls}
                        keyField="id"
                        loading={loading}
                        emptyMessage="No payroll records generated for this month."
                    />
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-100">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading payrolls...</div>
                    ) : payrolls.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No payroll records generated for this month.</div>
                    ) : (
                        payrolls.map((row) => (
                            <div key={row.id} className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900">{row.users?.full_name || 'Unknown'}</span>
                                        <span className="text-xs text-gray-500">{row.users?.designation || 'Staff'}</span>
                                    </div>
                                    <StatusBadge
                                        status={row.status.toUpperCase()}
                                        variant={row.status === 'paid' ? 'success' : row.status === 'processed' ? 'info' : row.status === 'draft' ? 'warning' : 'error'}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-500">Attendance:</div>
                                    <div className="font-medium text-right">
                                        {row.worked_days + row.paid_leaves} / {row.total_days} Days
                                    </div>
                                    <div className="text-gray-500">Net Pay:</div>
                                    <div className="font-bold text-right text-gray-900">
                                        ₹{row.net_pay.toLocaleString('en-IN')}
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        onClick={() => { setSelectedPayroll(row); setIsViewModalOpen(true); }}
                                        className="p-1.5 text-gray-600 bg-gray-50 rounded-lg"
                                        title="View Details"
                                    >
                                        <FiEye />
                                    </button>
                                    {row.status === 'draft' && (
                                        <button
                                            onClick={() => updatePayrollStatus(row.id, 'processed')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg"
                                        >
                                            <FiPlayCircle /> Process
                                        </button>
                                    )}
                                    {row.status === 'processed' && (
                                        <button
                                            onClick={() => updatePayrollStatus(row.id, 'paid')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-600 bg-green-50 rounded-lg"
                                        >
                                            <FiCheckCircle /> Mark Paid
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deletePayroll(row.id)}
                                        className="p-1.5 text-red-600 bg-red-50 rounded-lg"
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Payroll Details Modal */}
            {isViewModalOpen && selectedPayroll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Payroll Details</h3>
                                <p className="text-xs text-gray-500">{selectedPayroll.users?.full_name} • {MONTHS[selectedPayroll.month - 1]} {selectedPayroll.year}</p>
                            </div>
                            <button onClick={() => setIsViewModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <FiX className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Attendance Section */}
                            <section>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Attendance Summary</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <span className="block text-xs text-gray-500">Total Days</span>
                                        <span className="text-lg font-bold text-gray-900">{selectedPayroll.total_days}</span>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                        <span className="block text-xs text-blue-600">Paid Days</span>
                                        <span className="text-lg font-bold text-blue-700">{selectedPayroll.worked_days + selectedPayroll.paid_leaves}</span>
                                    </div>
                                    <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                                        <span className="block text-xs text-green-600">Present</span>
                                        <span className="text-lg font-bold text-green-700">{selectedPayroll.worked_days}</span>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                        <span className="block text-xs text-red-600">Unpaid Leaves</span>
                                        <span className="text-lg font-bold text-red-700">{selectedPayroll.unpaid_leaves}</span>
                                    </div>
                                </div>
                            </section>

                            {/* Earnings Section */}
                            <section>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Earnings</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Base Pay Earned</span>
                                        <span className="font-semibold text-gray-900">₹{selectedPayroll.base_pay_earned.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Total Allowances</span>
                                        <span className="font-semibold text-gray-900">₹{selectedPayroll.allowances_earned.toLocaleString('en-IN')}</span>
                                    </div>
                                    {selectedPayroll.bonus > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600">Bonus</span>
                                            <span className="font-semibold text-green-600">+₹{selectedPayroll.bonus.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    {selectedPayroll.reimbursements > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600">Reimbursements</span>
                                            <span className="font-semibold text-green-600">+₹{selectedPayroll.reimbursements.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t border-dashed border-gray-200 flex justify-between items-center text-sm font-bold">
                                        <span className="text-gray-900">Gross Earnings</span>
                                        <span className="text-gray-900">₹{(selectedPayroll.base_pay_earned + selectedPayroll.allowances_earned + (selectedPayroll.bonus || 0) + (selectedPayroll.reimbursements || 0)).toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            </section>

                            {/* Deductions Section */}
                            <section>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Deductions</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Total Deductions (Inc. LOP)</span>
                                        <span className="font-semibold text-red-600">₹{selectedPayroll.deductions.toLocaleString('en-IN')}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400">Includes professional tax, PF, and salary deductions for {selectedPayroll.unpaid_leaves} unpaid days.</p>
                                </div>
                            </section>

                            {/* Net Pay */}
                            <section className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-yellow-800 uppercase tracking-tighter">Take Home Salary</span>
                                        <span className="text-2xl font-black text-gray-900 leading-tight">₹{selectedPayroll.net_pay.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="h-10 w-10 bg-yellow-400/20 rounded-full flex items-center justify-center">
                                        <FaRupeeSign className="w-6 h-6 text-yellow-700" />
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setIsViewModalOpen(false)}
                                className="px-5 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
