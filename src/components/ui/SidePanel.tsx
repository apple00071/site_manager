'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

interface SidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    width?: 'sm' | 'md' | 'lg';
    footer?: React.ReactNode;
}

/**
 * SidePanel - Desktop slide-from-right panel
 * Used for Add Inventory / Add Design forms on desktop
 * Mobile uses BottomSheet instead
 */
export function SidePanel({
    isOpen,
    onClose,
    title,
    children,
    width = 'md',
    footer
}: SidePanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Handle ESC key and advanced isolation
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Style Guard: Lock both html and body
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.overscrollBehaviorY = 'none';
            document.body.style.overflow = 'hidden';
            document.body.style.overscrollBehaviorY = 'none';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.documentElement.style.overflow = '';
            document.documentElement.style.overscrollBehaviorY = '';
            document.body.style.overflow = '';
            document.body.style.overscrollBehaviorY = '';
        };
    }, [isOpen, onClose]);

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
        const currentPanelEl = panelRef.current;

        if (currentScrollEl) {
            currentScrollEl.addEventListener('touchstart', handleTouchStart, { passive: true });
            currentScrollEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        }

        // Apply strict blockade to header and footer
        const blockTouch = (e: TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
        };

        return () => {
            if (currentScrollEl) {
                currentScrollEl.removeEventListener('touchstart', handleTouchStart);
                currentScrollEl.removeEventListener('touchmove', handleTouchMove);
            }
        };
    }, [isOpen]);

    // Focus trap
    useEffect(() => {
        if (isOpen && panelRef.current) {
            panelRef.current.focus();
        }
    }, [isOpen]);

    const widthClasses = {
        sm: 'w-80',
        md: 'w-96 lg:w-[28rem]',
        lg: 'w-[32rem] lg:w-[36rem]'
    };

    if (!isOpen) return null;

    const content = (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={onClose}
                aria-hidden="true"
                data-side-panel="true"
                style={{ touchAction: 'none' }}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                tabIndex={-1}
                className={`
                    fixed top-0 right-0 h-full bg-white shadow-2xl z-50
                    ${widthClasses[width]}
                    transform transition-transform duration-300 ease-out
                    flex flex-col
                    animate-slide-in-right
                `}
                role="dialog"
                aria-modal="true"
                aria-labelledby="side-panel-title"
                style={{ touchAction: 'none' }} // Base panel is non-touchable to prevent leakage
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0"
                    onTouchMove={(e) => e.cancelable && e.preventDefault()}
                >
                    <h2 id="side-panel-title" className="text-lg font-semibold text-gray-900">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="btn-ghost"
                        aria-label="Close panel"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-6"
                    style={{
                        overscrollBehavior: 'none',
                        touchAction: 'pan-y' // Only allow vertical scrolling within content
                    }}
                >
                    {children}
                </div>

                {/* Footer (optional) */}
                {footer && (
                    <div
                        className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0"
                        onTouchMove={(e) => e.cancelable && e.preventDefault()}
                    >
                        {footer}
                    </div>
                )}
            </div>

            {/* CSS animation */}
            <style jsx global>{`
                @keyframes slide-in-right {
                from {
                    transform: translateX(100%);
                }
                to {
                    transform: translateX(0);
                }
                }
                .animate-slide-in-right {
                animation: slide-in-right 0.3s ease-out;
                }
            `}</style>
        </>
    );

    return createPortal(content, document.body);
}

export default SidePanel;
