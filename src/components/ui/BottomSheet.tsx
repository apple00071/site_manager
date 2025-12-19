'use client';

import { ReactNode, useEffect, useState, useRef } from 'react';
import { FiX } from 'react-icons/fi';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    footer?: ReactNode;
    maxHeight?: string;
}

export function BottomSheet({
    isOpen,
    onClose,
    title,
    children,
    footer,
    maxHeight = '85vh'
}: BottomSheetProps) {
    const [isAnimating, setIsAnimating] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const sheetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Small delay to trigger animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        } else {
            setIsAnimating(false);
            // Wait for animation to complete before hiding
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 300);
            document.body.style.overflow = '';
            return () => clearTimeout(timer);
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isVisible) return null;

    return (
        <div
            className={`fixed inset-0 z-50 transition-colors duration-300 ${isAnimating ? 'bg-black/40' : 'bg-transparent'
                }`}
            onClick={handleBackdropClick}
            aria-modal="true"
            role="dialog"
        >
            <div
                ref={sheetRef}
                className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out flex flex-col ${isAnimating ? 'translate-y-0' : 'translate-y-full'
                    }`}
                style={{ maxHeight }}
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                        <button
                            onClick={onClose}
                            className="btn-ghost rounded-full -mr-2"
                            aria-label="Close"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {children}
                </div>

                {/* Footer (sticky) */}
                {footer && (
                    <div className="sticky bottom-0 px-4 py-4 bg-white border-t border-gray-100 safe-area-bottom">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export default BottomSheet;
