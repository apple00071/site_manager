'use client';

import { useEffect, useRef } from 'react';
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

    // Handle ESC key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when panel is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

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

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={onClose}
                aria-hidden="true"
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
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
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
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>

                {/* Footer (optional) */}
                {footer && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
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
}

export default SidePanel;
