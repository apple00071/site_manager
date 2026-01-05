'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { FiCheck, FiX, FiAlertCircle, FiUpload, FiCalendar, FiUser, FiTag, FiFileText } from 'react-icons/fi';
import { ImageModal } from '@/components/ui/ImageModal';
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
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    // Prevent crash if expense is null (rendering race condition)
    if (!expense) return null;

    const allAttachments = (expense.bill_urls || [expense.bill_url]).filter(Boolean);

    const handleAction = async (status: 'approved' | 'rejected') => {
        if (!user) return;

        if (status === 'rejected' && !remarks.trim()) {
            showToast('error', 'Please provide remarks for rejection');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/office-expenses?id=${expense.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    admin_remarks: remarks,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update status');
            }

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
            <ImageModal
                isOpen={previewIndex !== null}
                onClose={() => setPreviewIndex(null)}
                images={allAttachments}
                currentIndex={previewIndex || 0}
                onNavigate={setPreviewIndex}
            />

            {/* Main Details Card */}
            <div className="bg-white rounded-xl overflow-hidden">
                {/* Amount Header */}
                <div className="text-center pb-6 border-b border-dashed border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1 uppercase tracking-wider">Total Amount</p>
                    <div className="text-4xl font-extrabold text-gray-900 tracking-tight">
                        ₹{Number(expense.amount).toLocaleString()}
                    </div>
                </div>

                {/* Info Grid */}
                <div className="py-6 grid grid-cols-2 gap-y-6 gap-x-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            <FiTag className="w-3 h-3" /> Category
                        </div>
                        <p className="font-medium text-gray-900">{expense.category}</p>
                    </div>

                    <div className="text-right space-y-1">
                        <div className="flex items-center justify-end gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Date <FiCalendar className="w-3 h-3" />
                        </div>
                        <p className="font-medium text-gray-900">{formatDateIST(expense.expense_date)}</p>
                    </div>

                    <div className="col-span-2 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                            <FiFileText className="w-3 h-3" /> Description
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed font-medium">
                            {expense.description}
                        </p>
                    </div>

                    <div className="col-span-2 flex items-center gap-3 pt-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <FiUser className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Requested By</p>
                            <p className="text-sm font-bold text-gray-900">{expense.user?.full_name}</p>
                        </div>
                        <div className="text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                Pending Review
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Attachments Section */}
            {allAttachments.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <FiUpload className="w-3 h-3" /> Attachments
                    </p>
                    <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                        {allAttachments.map((url: string, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => setPreviewIndex(idx)}
                                className="shrink-0 group relative block w-32 aspect-[4/3] rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-gray-300 text-left"
                            >
                                {url.toLowerCase().endsWith('.pdf') ? (
                                    <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-2">
                                        <div className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                            <FiFileText className="w-4 h-4" />
                                        </div>
                                        <span className="text-[10px] font-medium text-gray-500 truncate w-full text-center">PDF Document</span>
                                    </div>
                                ) : (
                                    <div className="h-full w-full bg-gray-100 relative">
                                        <img
                                            src={url}
                                            alt="Receipt"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Area */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
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
                        className="btn-danger-outline py-3 flex items-center justify-center gap-2 group"
                    >
                        <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors group-hover:border-transparent">
                            <FiX className="w-3 h-3" />
                        </div>
                        <span>Reject</span>
                    </button>
                    <button
                        onClick={() => handleAction('approved')}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white rounded-lg py-3 font-semibold text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:transform active:scale-[0.98]"
                    >
                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                            <FiCheck className="w-3 h-3" />
                        </div>
                        <span>Approve Expense</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

