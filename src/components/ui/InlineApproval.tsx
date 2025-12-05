'use client';

import { useState, ReactNode } from 'react';
import { FiCheck, FiX, FiMessageSquare, FiLoader } from 'react-icons/fi';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'needs_changes';

interface InlineApprovalProps {
    // Current status
    status: ApprovalStatus;
    // Callbacks
    onApprove: () => Promise<void> | void;
    onReject: (reason?: string) => Promise<void> | void;
    onRequestChanges?: (comment: string) => Promise<void> | void;
    // Options
    requireRejectReason?: boolean;
    showRequestChanges?: boolean;
    // Display
    approveLabel?: string;
    rejectLabel?: string;
    requestChangesLabel?: string;
    // Disabled state
    disabled?: boolean;
    // Size
    size?: 'sm' | 'md';
}

export function InlineApproval({
    status,
    onApprove,
    onReject,
    onRequestChanges,
    requireRejectReason = false,
    showRequestChanges = false,
    approveLabel = 'Approve',
    rejectLabel = 'Reject',
    requestChangesLabel = 'Request Changes',
    disabled = false,
    size = 'md',
}: InlineApprovalProps) {
    const [isProcessing, setIsProcessing] = useState<'approve' | 'reject' | 'changes' | null>(null);
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [showChangesInput, setShowChangesInput] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [changesComment, setChangesComment] = useState('');
    const [error, setError] = useState<string | null>(null);

    const sizeClasses = {
        sm: 'px-2 py-1 text-xs gap-1',
        md: 'px-3 py-1.5 text-sm gap-1.5',
    };

    const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

    const handleApprove = async () => {
        setIsProcessing('approve');
        setError(null);
        try {
            await onApprove();
        } catch (err: any) {
            setError(err.message || 'Failed to approve');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleRejectClick = () => {
        if (requireRejectReason) {
            setShowRejectInput(true);
            setShowChangesInput(false);
        } else {
            submitReject();
        }
    };

    const submitReject = async () => {
        if (requireRejectReason && !rejectReason.trim()) {
            setError('Please provide a reason');
            return;
        }

        setIsProcessing('reject');
        setError(null);
        try {
            await onReject(rejectReason.trim() || undefined);
            setShowRejectInput(false);
            setRejectReason('');
        } catch (err: any) {
            setError(err.message || 'Failed to reject');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleRequestChanges = () => {
        setShowChangesInput(true);
        setShowRejectInput(false);
    };

    const submitChanges = async () => {
        if (!changesComment.trim()) {
            setError('Please provide details');
            return;
        }

        setIsProcessing('changes');
        setError(null);
        try {
            await onRequestChanges?.(changesComment.trim());
            setShowChangesInput(false);
            setChangesComment('');
        } catch (err: any) {
            setError(err.message || 'Failed to request changes');
        } finally {
            setIsProcessing(null);
        }
    };

    const cancelInput = () => {
        setShowRejectInput(false);
        setShowChangesInput(false);
        setRejectReason('');
        setChangesComment('');
        setError(null);
    };

    // If already approved/rejected, show status badge
    if (status !== 'pending') {
        const statusStyles = {
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
            needs_changes: 'bg-orange-100 text-orange-800',
        };

        const statusLabels = {
            approved: 'Approved',
            rejected: 'Rejected',
            needs_changes: 'Changes Requested',
        };

        return (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusStyles[status]}`}>
                {statusLabels[status]}
            </span>
        );
    }

    // Rejection reason input
    if (showRejectInput) {
        return (
            <div className="space-y-2">
                <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 ${error ? 'border-red-300' : 'border-gray-300'
                        }`}
                    rows={2}
                    autoFocus
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2">
                    <button
                        onClick={submitReject}
                        disabled={isProcessing === 'reject'}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        {isProcessing === 'reject' ? (
                            <FiLoader className="w-4 h-4 animate-spin" />
                        ) : (
                            <FiX className="w-4 h-4" />
                        )}
                        Reject
                    </button>
                    <button
                        onClick={cancelInput}
                        disabled={isProcessing === 'reject'}
                        className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // Changes request input
    if (showChangesInput) {
        return (
            <div className="space-y-2">
                <textarea
                    value={changesComment}
                    onChange={(e) => setChangesComment(e.target.value)}
                    placeholder="What changes are needed..."
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${error ? 'border-red-300' : 'border-gray-300'
                        }`}
                    rows={2}
                    autoFocus
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2">
                    <button
                        onClick={submitChanges}
                        disabled={isProcessing === 'changes'}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                    >
                        {isProcessing === 'changes' ? (
                            <FiLoader className="w-4 h-4 animate-spin" />
                        ) : (
                            <FiMessageSquare className="w-4 h-4" />
                        )}
                        Submit
                    </button>
                    <button
                        onClick={cancelInput}
                        disabled={isProcessing === 'changes'}
                        className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // Action buttons
    return (
        <div className="flex flex-wrap gap-2">
            {/* Approve button */}
            <button
                onClick={handleApprove}
                disabled={disabled || isProcessing !== null}
                className={`flex items-center ${sizeClasses[size]} font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors`}
            >
                {isProcessing === 'approve' ? (
                    <FiLoader className={`${iconSize} animate-spin`} />
                ) : (
                    <FiCheck className={iconSize} />
                )}
                <span>{approveLabel}</span>
            </button>

            {/* Reject button */}
            <button
                onClick={handleRejectClick}
                disabled={disabled || isProcessing !== null}
                className={`flex items-center ${sizeClasses[size]} font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors`}
            >
                <FiX className={iconSize} />
                <span>{rejectLabel}</span>
            </button>

            {/* Request Changes button */}
            {showRequestChanges && onRequestChanges && (
                <button
                    onClick={handleRequestChanges}
                    disabled={disabled || isProcessing !== null}
                    className={`flex items-center ${sizeClasses[size]} font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors`}
                >
                    <FiMessageSquare className={iconSize} />
                    <span>{requestChangesLabel}</span>
                </button>
            )}

            {error && <p className="w-full text-xs text-red-600 mt-1">{error}</p>}
        </div>
    );
}

export default InlineApproval;
