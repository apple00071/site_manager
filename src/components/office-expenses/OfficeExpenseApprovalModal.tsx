'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';

interface OfficeExpenseApprovalModalProps {
    expense: any;
    onSuccess: () => void;
    onClose: () => void;
}

export default function OfficeExpenseApprovalModal({ expense, onSuccess, onClose }: OfficeExpenseApprovalModalProps) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [remarks, setRemarks] = useState('');

    const handleAction = async (status: 'approved' | 'rejected') => {
        if (!user) return;

        if (status === 'rejected' && !remarks.trim()) {
            showToast('error', 'Please provide remarks for rejection');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('office_expenses')
                .update({
                    status,
                    approved_by: user.id,
                    approved_at: new Date().toISOString(),
                    admin_remarks: remarks,
                })
                .eq('id', expense.id);

            if (error) throw error;

            showToast('success', `Expense ${status} successfully`);
            onSuccess();
        } catch (error: any) {
            console.error('Error updating expense status:', error);
            showToast('error', error.message || 'Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Description</p>
                        <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Amount</p>
                        <p className="text-lg font-bold text-gray-900">₹{Number(expense.amount).toLocaleString()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Category</p>
                        <p className="text-sm text-gray-700">{expense.category}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Date</p>
                        <p className="text-sm text-gray-700">{formatDateIST(expense.expense_date)}</p>
                    </div>
                </div>

                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Requested By</p>
                    <p className="text-sm text-gray-700">{expense.user?.full_name}</p>
                </div>
            </div>

            {expense.bill_url && (
                <div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Attached Receipt</p>
                    <img
                        src={expense.bill_url}
                        alt="Receipt"
                        className="w-full h-auto max-h-64 object-contain rounded-lg border border-gray-200"
                    />
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Remarks {expense.status === 'rejected' ? '*' : '(Optional)'}
                </label>
                <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                    placeholder="Add specific comments or reason for rejection..."
                />
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => handleAction('rejected')}
                    disabled={loading}
                    className="flex-1 px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <FiX className="w-4 h-4" />
                    Reject
                </button>
                <button
                    onClick={() => handleAction('approved')}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                    <FiCheck className="w-4 h-4" />
                    Approve
                </button>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg text-xs border border-amber-100 italic">
                <FiAlertCircle className="shrink-0" />
                Once approved, the status is final and the expense will be locked.
            </div>
        </div>
    );
}
