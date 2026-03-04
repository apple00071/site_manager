'use client';

import { ReactNode, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
    const scrollRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Small delay to trigger animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true);
                });
            });
            // Style Guard: Lock both html and body
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.overscrollBehaviorY = 'none';
            document.body.style.overflow = 'hidden';
            document.body.style.overscrollBehaviorY = 'none';
        } else {
            setIsAnimating(false);
            // Wait for animation to complete before hiding
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 300);
            document.documentElement.style.overflow = '';
            document.documentElement.style.overscrollBehaviorY = '';
            document.body.style.overflow = '';
            document.body.style.overscrollBehaviorY = '';
            return () => clearTimeout(timer);
        }

        return () => {
            document.documentElement.style.overflow = '';
            document.documentElement.style.overscrollBehaviorY = '';
            document.body.style.overflow = '';
            document.body.style.overscrollBehaviorY = '';
        };
    }, [isOpen]);

    // Event Guard: Prevent pull-to-refresh at the JS level
    useEffect(() => {
        if (!isOpen) return;

        let touchStartY = 0;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartY = e.touches[0].clientY;
        };

        const handleTouchMove = (e: TouchEvent) => {
            const touchY = e.touches[0].clientY;
            const touchDiff = touchY - touchStartY;
            const scrollEl = scrollRef.current;

            if (scrollEl) {
                // If pulling DOWN at the TOP, cancel to prevent pull-to-refresh
                if (scrollEl.scrollTop <= 0 && touchDiff > 0) {
                    if (e.cancelable) e.preventDefault();
                }
            } else {
                // Overlay/Header: cancel all moves
                if (e.cancelable) e.preventDefault();
            }
            e.stopPropagation();
        };

        const currentScrollEl = scrollRef.current;
        if (currentScrollEl) {
            currentScrollEl.addEventListener('touchstart', handleTouchStart, { passive: true });
            currentScrollEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        }

        return () => {
            if (currentScrollEl) {
                currentScrollEl.removeEventListener('touchstart', handleTouchStart);
                currentScrollEl.removeEventListener('touchmove', handleTouchMove);
            }
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

    const content = (
        <div
            ref={overlayRef}
            className={`fixed inset-0 z-50 transition-colors duration-300 ${isAnimating ? 'bg-black/20' : 'bg-transparent'
                }`}
            onClick={handleBackdropClick}
            aria-modal="true"
            role="dialog"
            data-bottom-sheet="true"
            style={{ touchAction: 'none' }} // Disable actions on background
        >
            <div
                ref={sheetRef}
                className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out flex flex-col ${isAnimating ? 'translate-y-0' : 'translate-y-full'
                    }`}
                style={{ maxHeight, touchAction: 'none' }} // Header/Handle area is non-draggable for scroll chain
                onClick={(e) => e.stopPropagation()}
            >
                {/* Handle bar */}
                <div
                    className="flex justify-center pt-3 pb-2 shrink-0"
                    onTouchMove={(e) => e.cancelable && e.preventDefault()}
                >
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                {title && (
                    <div
                        className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 shrink-0"
                        onTouchMove={(e) => e.cancelable && e.preventDefault()}
                    >
                        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
                            aria-label="Close"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-4 py-4"
                    style={{
                        overscrollBehavior: 'none',
                        touchAction: 'pan-y'
                    }}
                >
                    {children}
                </div>

                {/* Footer (sticky) */}
                {footer && (
                    <div
                        className="sticky bottom-0 px-4 py-4 bg-white border-t border-gray-100 safe-area-bottom shrink-0"
                        onTouchMove={(e) => e.cancelable && e.preventDefault()}
                    >
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(content, document.body);
}

export default BottomSheet;
