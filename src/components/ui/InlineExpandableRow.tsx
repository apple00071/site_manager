'use client';

import { ReactNode, useState, useEffect } from 'react';
import { FiChevronDown, FiChevronUp, FiX } from 'react-icons/fi';
import { BottomSheet } from './BottomSheet';

interface InlineExpandableRowProps {
    // Trigger content (always visible)
    trigger: ReactNode;
    // Expanded content
    children: ReactNode;
    // Control expanded state externally
    isExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    // Whether to use bottom sheet on mobile
    useBottomSheetOnMobile?: boolean;
    // Bottom sheet title (for mobile)
    bottomSheetTitle?: string;
    // Bottom sheet footer (for mobile)
    bottomSheetFooter?: ReactNode;
    // Additional class names
    className?: string;
    expandedClassName?: string;
    // Disable expansion
    disabled?: boolean;
}

export function InlineExpandableRow({
    trigger,
    children,
    isExpanded: controlledExpanded,
    onExpandedChange,
    useBottomSheetOnMobile = true,
    bottomSheetTitle,
    bottomSheetFooter,
    className = '',
    expandedClassName = '',
    disabled = false,
}: InlineExpandableRowProps) {
    // Internal state for uncontrolled mode
    const [internalExpanded, setInternalExpanded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Determine if we're in controlled mode
    const isControlled = controlledExpanded !== undefined;
    const isExpanded = isControlled ? controlledExpanded : internalExpanded;

    // Check for mobile viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleToggle = () => {
        if (disabled) return;

        const newExpanded = !isExpanded;

        if (isControlled) {
            onExpandedChange?.(newExpanded);
        } else {
            setInternalExpanded(newExpanded);
        }
    };

    const handleClose = () => {
        if (isControlled) {
            onExpandedChange?.(false);
        } else {
            setInternalExpanded(false);
        }
    };

    // Mobile: Use bottom sheet
    if (isMobile && useBottomSheetOnMobile) {
        return (
            <div className={className}>
                {/* Trigger */}
                <div
                    onClick={handleToggle}
                    className={`cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggle();
                        }
                    }}
                >
                    {trigger}
                </div>

                {/* Bottom Sheet */}
                <BottomSheet
                    isOpen={isExpanded}
                    onClose={handleClose}
                    title={bottomSheetTitle}
                    footer={bottomSheetFooter}
                >
                    {children}
                </BottomSheet>
            </div>
        );
    }

    // Desktop: Inline expansion
    return (
        <div className={className}>
            {/* Trigger */}
            <div
                onClick={handleToggle}
                className={`cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                role="button"
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
            >
                {trigger}
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div
                    className={`mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg animate-slide-down ${expandedClassName}`}
                >
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={handleClose}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                            aria-label="Close"
                        >
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                    {children}
                </div>
            )}
        </div>
    );
}

// Convenience component for table row expansion
interface ExpandableTableRowProps {
    cells: ReactNode[];
    expandedContent: ReactNode;
    isExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    bottomSheetTitle?: string;
    bottomSheetFooter?: ReactNode;
}

export function ExpandableTableRow({
    cells,
    expandedContent,
    isExpanded: controlledExpanded,
    onExpandedChange,
    bottomSheetTitle,
    bottomSheetFooter,
}: ExpandableTableRowProps) {
    const [internalExpanded, setInternalExpanded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const isControlled = controlledExpanded !== undefined;
    const isExpanded = isControlled ? controlledExpanded : internalExpanded;

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleToggle = () => {
        if (isControlled) {
            onExpandedChange?.(!isExpanded);
        } else {
            setInternalExpanded(!isExpanded);
        }
    };

    const handleClose = () => {
        if (isControlled) {
            onExpandedChange?.(false);
        } else {
            setInternalExpanded(false);
        }
    };

    return (
        <>
            <tr
                onClick={handleToggle}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
                {cells.map((cell, index) => (
                    <td key={index} className="px-4 py-3 text-sm">
                        {cell}
                    </td>
                ))}
                <td className="px-4 py-3 text-sm">
                    {isExpanded ? (
                        <FiChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                        <FiChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                </td>
            </tr>

            {/* Desktop: Inline expanded row */}
            {isExpanded && !isMobile && (
                <tr>
                    <td colSpan={cells.length + 1} className="p-0">
                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClose();
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            </div>
                            {expandedContent}
                        </div>
                    </td>
                </tr>
            )}

            {/* Mobile: Bottom sheet */}
            {isMobile && (
                <BottomSheet
                    isOpen={isExpanded}
                    onClose={handleClose}
                    title={bottomSheetTitle}
                    footer={bottomSheetFooter}
                >
                    {expandedContent}
                </BottomSheet>
            )}
        </>
    );
}

export default InlineExpandableRow;
