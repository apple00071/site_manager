'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FiDownload, FiCalendar, FiFileText } from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';
import { useToast } from '@/components/ui/Toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateIST } from '@/lib/dateUtils';
import { DataTable, Column, StatusBadge } from '@/components/ui/DataTable';

interface PayrollRecord {
    id: string;
    user_id: string;
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
    payment_date: string | null;
    created_at: string;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollSection() {
    const { user, isAdmin } = useAuth();
    const { showToast } = useToast();

    const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchPayrolls();
        }
    }, [user]);

    const fetchPayrolls = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/payroll?userId=${user?.id}`);
            if (res.ok) {
                const data = await res.json();
                setPayrolls(data);
            }
        } catch (error) {
            console.error('Error fetching payrolls:', error);
            showToast('error', 'Failed to load payroll history');
        } finally {
            setLoading(false);
        }
    };

    const downloadPayslip = (payroll: PayrollRecord) => {
        if (!user) return;

        try {
            const doc = new jsPDF();
            const monthName = MONTHS[payroll.month - 1];

            // Header Content
            doc.setFontSize(22);
            doc.setTextColor(33, 33, 33);
            doc.text('PAYSLIP', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Salary slip for the month of ${monthName}, ${payroll.year}`, 14, 28);

            doc.setDrawColor(200, 200, 200);
            doc.line(14, 32, 196, 32);

            // Employee Details
            doc.setFontSize(11);
            doc.setTextColor(33, 33, 33);
            doc.setFont('helvetica', 'bold');
            doc.text('Employee Information', 14, 42);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Name: ${user.full_name}`, 14, 50);
            doc.text(`Email: ${user.email}`, 14, 56);
            doc.text(`Designation: ${(user as any).designation || 'Staff'}`, 14, 62);
            // doc.text(`Department: ${user.department || 'N/A'}`, 100, 50);

            // Attendance Details
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Attendance Details', 100, 42);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Total Days in Month: ${payroll.total_days}`, 100, 50);
            doc.text(`Worked/Paid Days: ${payroll.worked_days + payroll.paid_leaves}`, 100, 56);
            doc.text(`Unpaid Leaves: ${payroll.unpaid_leaves}`, 100, 62);

            // Earnings & Deductions Tables
            const earnings = [
                ['Base Pay', `\u20B9 ${payroll.base_pay_earned.toFixed(2)}`],
                ['Allowances', `\u20B9 ${payroll.allowances_earned.toFixed(2)}`]
            ];
            if (payroll.bonus > 0) earnings.push(['Bonus', `\u20B9 ${payroll.bonus.toFixed(2)}`]);
            if (payroll.reimbursements > 0) earnings.push(['Reimbursements', `\u20B9 ${payroll.reimbursements.toFixed(2)}`]);

            const deductionsList = [
                ['Total Deductions', `\u20B9 ${payroll.deductions.toFixed(2)}`]
            ];

            // Calculate Totals explicitly for table footer
            const totalEarning = payroll.base_pay_earned + payroll.allowances_earned + (payroll.bonus || 0) + (payroll.reimbursements || 0);
            const totalDeduction = payroll.deductions;

            autoTable(doc, {
                startY: 70,
                head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
                body: Array.from({ length: Math.max(earnings.length, deductionsList.length) }).map((_, i) => [
                    earnings[i] ? earnings[i][0] : '',
                    earnings[i] ? earnings[i][1] : '',
                    deductionsList[i] ? deductionsList[i][0] : '',
                    deductionsList[i] ? deductionsList[i][1] : '',
                ]),
                foot: [[
                    'Total Earnings', `\u20B9 ${totalEarning.toFixed(2)}`,
                    'Total Deductions', `\u20B9 ${totalDeduction.toFixed(2)}`
                ]],
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
            });

            const finalY = (doc as any).lastAutoTable.finalY || 150;

            // Final Net Pay
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(33, 33, 33);
            doc.text('Net Payable:', 14, finalY + 15);
            doc.setTextColor(40, 167, 69); // Green text
            doc.text(`\u20B9 ${payroll.net_pay.toFixed(2)}`, 50, finalY + 15);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(150, 150, 150);
            doc.text('This is a computer generated document and requires no signature.', 14, finalY + 30);

            doc.save(`Payslip_${monthName}_${payroll.year}.pdf`);
            showToast('success', 'Payslip downloaded successfully');
        } catch (error) {
            console.error('Error generating PDF:', error);
            showToast('error', 'Failed to generate Payslip PDF');
        }
    };

    const columns: Column<PayrollRecord>[] = [
        {
            key: 'period',
            label: 'Pay Period',
            render: (_, row) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{MONTHS[row.month - 1]} {row.year}</span>
                    <span className="text-[10px] text-gray-500">Generated on {formatDateIST(row.created_at)}</span>
                </div>
            )
        },
        {
            key: 'attendance',
            label: 'Attendance',
            render: (_, row) => (
                <div className="flex flex-col text-xs text-gray-600">
                    <span>Paid Days: <span className="font-medium text-gray-900">{row.worked_days + row.paid_leaves}</span>/{row.total_days}</span>
                    {row.unpaid_leaves > 0 && <span className="text-red-500">Unpaid: {row.unpaid_leaves} days</span>}
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
            label: '',
            render: (_, row) => (
                <button
                    onClick={() => downloadPayslip(row)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors ml-auto"
                >
                    <FiDownload className="w-3.5 h-3.5" />
                    Payslip
                </button>
            )
        }
    ];

    if (isAdmin) {
        return (
            <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Payroll Dashboard</h2>
                <p className="text-sm text-gray-600 mb-4">
                    As an Admin, you can generate and manage organization payroll from the dedicated "Organization" / "Users" tab. Let's redirect you there.
                </p>
                {/* Normally we wouldn't show employee individual payroll UI to an admin in their generic settings tab, but for testing we can show it or redirect. */}
            </div>
        );
    }

    return (
        <div className="space-y-4 py-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <FaRupeeSign className="text-green-600" />
                        My Payroll History
                    </h3>
                    <p className="text-sm text-gray-500">View and download your monthly salary slips.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                    <DataTable
                        columns={columns}
                        data={payrolls}
                        keyField="id"
                        loading={loading}
                        emptyMessage="No payroll records found."
                    />
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-100">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading history...</div>
                    ) : payrolls.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No payroll records found.</div>
                    ) : (
                        payrolls.map((row) => (
                            <div key={row.id} className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900">{MONTHS[row.month - 1]} {row.year}</span>
                                        <span className="text-[10px] text-gray-500">Generated on {formatDateIST(row.created_at)}</span>
                                    </div>
                                    <StatusBadge
                                        status={row.status.toUpperCase()}
                                        variant={row.status === 'paid' ? 'success' : row.status === 'processed' ? 'info' : row.status === 'draft' ? 'warning' : 'error'}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-500">Paid Days:</div>
                                    <div className="font-medium text-right">
                                        {row.worked_days + row.paid_leaves} / {row.total_days}
                                    </div>
                                    <div className="text-gray-500">Net Pay:</div>
                                    <div className="font-bold text-right text-gray-900">
                                        ₹{row.net_pay.toLocaleString('en-IN')}
                                    </div>
                                </div>
                                <button
                                    onClick={() => downloadPayslip(row)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                >
                                    <FiDownload className="w-4 h-4" />
                                    Download Payslip
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
