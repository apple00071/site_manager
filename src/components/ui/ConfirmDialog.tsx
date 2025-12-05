'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

interface ConfirmDialogProps {
    // Trigger element
    trigger: ReactNode;
    // Confirmation message
    message: string;
    // Optional title
    title?: string;
    // Button labels
    confirmLabel?: string;
    cancelLabel?: string;
    // Destructive action styling
    destructive?: boolean;
    // Callback
    onConfirm: () => Promise<void> | void;
    // Disabled state
    disabled?: boolean;
}

export function ConfirmDialog({
    trigger,
    message,
    title = 'Confirm',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
    disabled = false,
}: ConfirmDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            await onConfirm();
            setIsOpen(false);
        } catch (err) {
            console.error('Confirm action failed:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="relative inline-block">
            {/* Trigger */}
            <div
                ref={triggerRef}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) setIsOpen(true);
                }}
                className={disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            >
                {trigger}
            </div>

            {/* Popover */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute z-50 mt-2 right-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-4 animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                        {destructive && (
                            <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                <FiAlertTriangle className="w-4 h-4 text-red-600" />
                            </div>
                        )}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{message}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => setIsOpen(false)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isProcessing}
                            className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${destructive
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-yellow-500 hover:bg-yellow-600'
                                }`}
                        >
                            {isProcessing ? (
                                <span className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Processing...
                                </span>
                            ) : (
                                confirmLabel
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Hook for programmatic confirm dialogs
interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
}

// Simple confirm replacement that returns a promise
export function useConfirm() {
    const [dialog, setDialog] = useState<{
        options: ConfirmOptions;
        resolve: (value: boolean) => void;
    } | null>(null);

    const confirm = (options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setDialog({ options, resolve });
        });
    };

    const handleConfirm = () => {
        dialog?.resolve(true);
        setDialog(null);
    };

    const handleCancel = () => {
        dialog?.resolve(false);
        setDialog(null);
    };

    const DialogComponent = dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6 animate-fade-in">
                <div className="flex items-start gap-3 mb-4">
                    {dialog.options.destructive && (
                        <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <FiAlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            {dialog.options.title || 'Confirm'}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{dialog.options.message}</p>
                    </div>
                </div>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        {dialog.options.cancelLabel || 'Cancel'}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${dialog.options.destructive
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-yellow-500 hover:bg-yellow-600'
                            }`}
                    >
                        {dialog.options.confirmLabel || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return { confirm, DialogComponent };
}

export default ConfirmDialog;
