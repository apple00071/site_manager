'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            // Style Guard: Lock both html and body
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.overscrollBehaviorY = 'none';
            document.body.style.overflow = 'hidden';
            document.body.style.overscrollBehaviorY = 'none';
            window.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.documentElement.style.overflow = '';
            document.documentElement.style.overscrollBehaviorY = '';
            document.body.style.overflow = '';
            document.body.style.overscrollBehaviorY = '';
            window.removeEventListener('keydown', handleEscape);
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
                // If pulling DOWN at the TOP, cancel the event to prevent pull-to-refresh
                if (scrollEl.scrollTop <= 0 && touchDiff > 0) {
                    if (e.cancelable) e.preventDefault();
                }
            } else {
                // If no scrollable area (overlay/header), cancel all moves to be safe
                if (e.cancelable) e.preventDefault();
            }

            e.stopPropagation();
        };

        const currentScrollEl = scrollRef.current;
        if (currentScrollEl) {
            currentScrollEl.addEventListener('touchstart', handleTouchStart, { passive: true });
            currentScrollEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        }

        // Also prevent on the header to be safe
        const preventDefault = (e: TouchEvent) => {
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

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            data-modal="true"
            style={{ touchAction: 'none' }} // Disable touch actions on the backdrop
        >
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 transform transition-all animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 flex flex-col max-h-[calc(100vh-3rem)]`}
                style={{ touchAction: 'auto' }} // Re-enable for the content
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0"
                    onTouchMove={(e) => e.cancelable && e.preventDefault()} // Block header moves
                >
                    <h3 className="text-lg font-semibold text-gray-900 leading-6">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
                    style={{ overscrollBehavior: 'none' }} // Strict containment
                >
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
