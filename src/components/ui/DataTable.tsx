'use client';

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface Column<T = any> {
    /** The key to access the value from the row data */
    key: string;
    /** Display label for the column header */
    label: string;
    /** Optional fixed width (Tailwind class like 'w-32' or 'w-48') */
    width?: string;
    /** Text alignment */
    align?: 'left' | 'center' | 'right';
    /** Custom render function for cell content */
    render?: (value: any, row: T, index: number) => React.ReactNode;
    /** Whether this column is sortable */
    sortable?: boolean;
    /** Whether to hide on mobile */
    hideOnMobile?: boolean;
}

export interface DataTableProps<T = any> {
    /** Array of data to display */
    data: T[];
    /** Column definitions */
    columns: Column<T>[];
    /** Unique key field in each row */
    keyField: keyof T;
    /** Show loading skeleton */
    loading?: boolean;
    /** Message to show when data is empty */
    emptyMessage?: string;
    /** Enable row selection */
    selectable?: boolean;
    /** Currently selected row keys */
    selectedKeys?: string[];
    /** Callback when selection changes */
    onSelect?: (keys: string[]) => void;
    /** Callback when a row is clicked */
    onRowClick?: (row: T) => void;
    /** Make header sticky on scroll */
    stickyHeader?: boolean;
    /** Additional class for the table container */
    className?: string;
    /** Compact mode - less padding */
    compact?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

/** Loading skeleton row */
function SkeletonRow({ columns }: { columns: Column[] }) {
    return (
        <tr className="animate-pulse">
            {columns.map((col, i) => (
                <td key={i} className="px-3 py-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                </td>
            ))}
        </tr>
    );
}

/** Empty state */
function EmptyState({ message, colSpan }: { message: string; colSpan: number }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-3 py-12 text-center">
                <div className="text-gray-400 text-sm">{message}</div>
            </td>
        </tr>
    );
}

// ============================================================================
// DataTable Component
// ============================================================================

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    keyField,
    loading = false,
    emptyMessage = 'No data available',
    selectable = false,
    selectedKeys = [],
    onSelect,
    onRowClick,
    stickyHeader = false,
    className = '',
    compact = false,
}: DataTableProps<T>) {
    // Padding classes based on compact mode
    const cellPadding = compact ? 'px-2 py-2' : 'px-3 py-3';
    const headerPadding = compact ? 'px-2 py-2' : 'px-3 py-3';

    // Get value from row using dot notation (e.g., 'user.name')
    const getValue = (row: T, key: string): any => {
        return key.split('.').reduce((obj, k) => obj?.[k], row as any);
    };

    // Handle select all
    const handleSelectAll = () => {
        if (!onSelect) return;
        const allKeys = data.map(row => String(row[keyField]));
        if (selectedKeys.length === data.length) {
            onSelect([]);
        } else {
            onSelect(allKeys);
        }
    };

    // Handle single row select
    const handleSelectRow = (key: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onSelect) return;
        if (selectedKeys.includes(key)) {
            onSelect(selectedKeys.filter(k => k !== key));
        } else {
            onSelect([...selectedKeys, key]);
        }
    };

    // Alignment classes
    const getAlignClass = (align?: 'left' | 'center' | 'right') => {
        switch (align) {
            case 'center': return 'text-center';
            case 'right': return 'text-right';
            default: return 'text-left';
        }
    };

    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className="w-full border-collapse">
                {/* Header */}
                <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
                    <tr className="bg-gray-50 border-b border-gray-200">
                        {/* Selection checkbox column */}
                        {selectable && (
                            <th className={`${headerPadding} w-10`}>
                                <input
                                    type="checkbox"
                                    checked={data.length > 0 && selectedKeys.length === data.length}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                                />
                            </th>
                        )}

                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`
                  ${headerPadding}
                  ${col.width || ''}
                  ${getAlignClass(col.align)}
                  ${col.hideOnMobile ? 'hidden md:table-cell' : ''}
                  text-xs font-medium text-gray-500 uppercase tracking-wider
                  whitespace-nowrap
                `}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>

                {/* Body */}
                <tbody className="bg-white divide-y divide-gray-100">
                    {loading ? (
                        // Loading skeletons
                        Array.from({ length: 5 }).map((_, i) => (
                            <SkeletonRow key={i} columns={columns} />
                        ))
                    ) : data.length === 0 ? (
                        // Empty state
                        <EmptyState
                            message={emptyMessage}
                            colSpan={columns.length + (selectable ? 1 : 0)}
                        />
                    ) : (
                        // Data rows
                        data.map((row, rowIndex) => {
                            const rowKey = String(row[keyField]);
                            const isSelected = selectedKeys.includes(rowKey);

                            return (
                                <tr
                                    key={rowKey}
                                    onClick={() => onRowClick?.(row)}
                                    className={`
                    transition-colors
                    ${onRowClick ? 'cursor-pointer' : ''}
                    ${isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'}
                  `}
                                >
                                    {/* Selection checkbox */}
                                    {selectable && (
                                        <td className={`${cellPadding} w-10`}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onClick={(e) => handleSelectRow(rowKey, e)}
                                                onChange={() => { }}
                                                className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                                            />
                                        </td>
                                    )}

                                    {/* Data cells */}
                                    {columns.map((col) => {
                                        const value = getValue(row, col.key);
                                        const content = col.render
                                            ? col.render(value, row, rowIndex)
                                            : (value ?? '-');

                                        return (
                                            <td
                                                key={col.key}
                                                className={`
                          ${cellPadding}
                          ${col.width || ''}
                          ${getAlignClass(col.align)}
                          ${col.hideOnMobile ? 'hidden md:table-cell' : ''}
                          text-sm text-gray-700
                        `}
                                            >
                                                {content}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ============================================================================
// Cell Renderer Helpers (can be used in column.render)
// ============================================================================

/** Renders a status badge with consistent styling */
export function StatusBadge({
    status,
    variant = 'default'
}: {
    status: string;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
}) {
    const colors = {
        default: 'bg-gray-100 text-gray-700',
        success: 'bg-green-100 text-green-700',
        warning: 'bg-yellow-100 text-yellow-700',
        error: 'bg-red-100 text-red-700',
        info: 'bg-blue-100 text-blue-700',
    };

    return (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[variant]}`}>
            {status}
        </span>
    );
}

/** Renders a formatted currency amount */
export function CurrencyCell({ value, currency = '₹' }: { value: number; currency?: string }) {
    return (
        <span className="font-medium text-gray-900">
            {currency}{value.toLocaleString('en-IN')}
        </span>
    );
}

/** Renders a truncated text with tooltip */
export function TruncatedText({ text, maxWidth = 'max-w-xs' }: { text: string; maxWidth?: string }) {
    return (
        <span className={`truncate block ${maxWidth}`} title={text}>
            {text}
        </span>
    );
}

/** Get status variant based on common status strings */
export function getStatusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
    const statusLower = status?.toLowerCase() || '';

    if (['completed', 'approved', 'confirmed', 'received', 'done', 'active'].includes(statusLower)) {
        return 'success';
    }
    if (['pending', 'draft', 'changes', 'needs_changes'].includes(statusLower)) {
        return 'warning';
    }
    if (['rejected', 'cancelled', 'failed', 'blocked'].includes(statusLower)) {
        return 'error';
    }
    if (['in_progress', 'ordered', 'processing'].includes(statusLower)) {
        return 'info';
    }
    return 'default';
}
