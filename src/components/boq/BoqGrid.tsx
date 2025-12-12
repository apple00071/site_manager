'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiTrash2, FiPlus, FiCheck, FiX, FiChevronDown } from 'react-icons/fi';

interface BOQItem {
    id: string;
    project_id: string;
    category: string | null;
    sub_category: string | null;
    item_name: string;
    description: string | null;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
    status: string;
    order_status?: string;
    item_type?: string;
    source?: string;
    draft_quantity?: number;
    linked_pos?: { id: string; po_number: string }[];
    sort_order: number;
    remarks: string | null;
}

interface BoqGridProps {
    items: BOQItem[];
    isAdmin: boolean;
    selectedItems: string[];
    onSelect: (ids: string[]) => void;
    onUpdate: (id: string, field: string, value: any) => Promise<void>;
    onDelete: (id: string) => void;
    onAdd: () => void;
    categories: string[];
}

const UNITS = ['Sqft', 'Rft', 'Nos', 'Kg', 'Cum', 'Sqm', 'Lump Sum', 'Set', 'Pair', 'Metric Ton'];
const ORDER_STATUSES = ['pending', 'ordered', 'received', 'cancelled'];
const ITEM_TYPES = ['material', 'labour', 'equipment', 'subcontract'];
const SOURCES = ['bought_out', 'raw_material', 'site_work'];
const STATUSES = ['draft', 'confirmed', 'completed'];

interface EditingCell {
    rowId: string;
    field: string;
    value: string;
}

export function BoqGrid({
    items,
    isAdmin,
    selectedItems,
    onSelect,
    onUpdate,
    onDelete,
    onAdd,
    categories
}: BoqGridProps) {
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
    const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

    const columns = [
        { key: 'item_name', label: 'Element Name & Description', type: 'text', width: 'w-64' },
        { key: 'category', label: 'Category', type: 'select', options: categories, width: 'w-32' },
        { key: 'order_status', label: 'Order Status', type: 'select', options: ORDER_STATUSES, width: 'w-28' },
        { key: 'item_type', label: 'Item Type', type: 'select', options: ITEM_TYPES, width: 'w-28' },
        { key: 'source', label: 'Source', type: 'select', options: SOURCES, width: 'w-28' },
        { key: 'status', label: 'Status', type: 'select', options: STATUSES, width: 'w-24' },
        { key: 'quantity', label: 'Qty', type: 'number', width: 'w-20' },
        { key: 'unit', label: 'UOM', type: 'select', options: UNITS, width: 'w-24' },
        { key: 'draft_quantity', label: 'Draft Qty', type: 'number', width: 'w-24' },
        { key: 'rate', label: 'Rate', type: 'number', width: 'w-24' },
        { key: 'amount', label: 'Final Amount', type: 'readonly', width: 'w-28' },
    ];

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            draft: 'bg-slate-100 text-slate-600',
            confirmed: 'bg-emerald-50 text-emerald-700',
            completed: 'bg-blue-50 text-blue-700',
            pending: 'bg-yellow-50 text-yellow-700',
            ordered: 'bg-purple-50 text-purple-700',
            received: 'bg-green-50 text-green-700',
            cancelled: 'bg-red-50 text-red-700',
        };
        return colors[status] || 'bg-gray-100 text-gray-600';
    };

    const startEdit = (rowId: string, field: string, currentValue: any) => {
        if (!isAdmin || field === 'amount') return;
        setEditingCell({ rowId, field, value: String(currentValue ?? '') });
    };

    const saveEdit = async () => {
        if (!editingCell) return;
        const { rowId, field, value } = editingCell;

        let parsedValue: any = value;
        if (['quantity', 'rate', 'draft_quantity'].includes(field)) {
            parsedValue = parseFloat(value) || 0;
        }

        await onUpdate(rowId, field, parsedValue);
        setEditingCell(null);
    };

    const cancelEdit = () => {
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (editingCell) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                saveEdit();
                // Move to next cell
                const currentRowIdx = items.findIndex(i => i.id === editingCell.rowId);
                const currentColIdx = columns.findIndex(c => c.key === editingCell.field);
                let nextColIdx = currentColIdx + (e.shiftKey ? -1 : 1);

                if (nextColIdx >= columns.length) {
                    nextColIdx = 0;
                    if (currentRowIdx < items.length - 1) {
                        const nextRow = items[currentRowIdx + 1];
                        const col = columns[nextColIdx];
                        if (col.type !== 'readonly') {
                            startEdit(nextRow.id, col.key, (nextRow as any)[col.key]);
                        }
                    }
                } else if (nextColIdx < 0) {
                    nextColIdx = columns.length - 1;
                } else {
                    const col = columns[nextColIdx];
                    if (col.type !== 'readonly') {
                        const currentRow = items[currentRowIdx];
                        startEdit(currentRow.id, col.key, (currentRow as any)[col.key]);
                    }
                }
            }
        } else {
            // Arrow key navigation when not editing
            if (focusedCell && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                let { row, col } = focusedCell;
                if (e.key === 'ArrowUp') row = Math.max(0, row - 1);
                if (e.key === 'ArrowDown') row = Math.min(items.length - 1, row + 1);
                if (e.key === 'ArrowLeft') col = Math.max(0, col - 1);
                if (e.key === 'ArrowRight') col = Math.min(columns.length - 1, col + 1);
                setFocusedCell({ row, col });
            } else if (e.key === 'Enter' && focusedCell) {
                const item = items[focusedCell.row];
                const col = columns[focusedCell.col];
                if (col.type !== 'readonly') {
                    startEdit(item.id, col.key, (item as any)[col.key]);
                }
            }
        }
    };

    // Handle paste from clipboard
    const handlePaste = useCallback((e: ClipboardEvent) => {
        if (!isAdmin || !focusedCell) return;

        const pastedText = e.clipboardData?.getData('text');
        if (!pastedText) return;

        const rows = pastedText.split('\n').map(row => row.split('\t'));
        if (rows.length === 0) return;

        // For now, just paste into the focused cell
        const item = items[focusedCell.row];
        const col = columns[focusedCell.col];
        if (col.type !== 'readonly' && rows[0][0]) {
            onUpdate(item.id, col.key, rows[0][0]);
        }
    }, [focusedCell, isAdmin, items, columns, onUpdate]);

    useEffect(() => {
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [handlePaste]);

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current instanceof HTMLInputElement) {
                inputRef.current.select();
            }
        }
    }, [editingCell]);

    const toggleSelectAll = () => {
        if (selectedItems.length === items.length) {
            onSelect([]);
        } else {
            onSelect(items.map(i => i.id));
        }
    };

    const toggleSelectItem = (id: string) => {
        if (selectedItems.includes(id)) {
            onSelect(selectedItems.filter(i => i !== id));
        } else {
            onSelect([...selectedItems, id]);
        }
    };

    const renderCell = (item: BOQItem, col: typeof columns[0], rowIdx: number, colIdx: number) => {
        const value = (item as any)[col.key];
        const isEditing = editingCell?.rowId === item.id && editingCell?.field === col.key;
        const isFocused = focusedCell?.row === rowIdx && focusedCell?.col === colIdx;

        if (isEditing) {
            if (col.type === 'select') {
                return (
                    <select
                        ref={inputRef as any}
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={saveEdit}
                        className="w-full px-2 py-1 text-sm border rounded bg-white"
                    >
                        <option value="">-</option>
                        {col.options?.map(opt => (
                            <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                );
            }
            return (
                <input
                    ref={inputRef as any}
                    type={col.type === 'number' ? 'number' : 'text'}
                    value={editingCell.value}
                    onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                    onBlur={saveEdit}
                    className="w-full px-2 py-1 text-sm border rounded"
                    step={col.type === 'number' ? '0.01' : undefined}
                />
            );
        }

        if (col.key === 'amount') {
            return <span className="font-semibold">{formatAmount(value || 0)}</span>;
        }

        if (['status', 'order_status'].includes(col.key)) {
            return (
                <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(value || 'draft')}`}>
                    {(value || 'draft').replace(/_/g, ' ')}
                </span>
            );
        }

        if (col.type === 'number') {
            return <span>{value ?? 0}</span>;
        }

        return <span className="truncate">{value?.toString().replace(/_/g, ' ') || '-'}</span>;
    };

    return (
        <div className="overflow-x-auto" onKeyDown={handleKeyDown} tabIndex={0}>
            <table ref={tableRef} className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                        {isAdmin && (
                            <th className="px-2 py-2 w-10">
                                <input
                                    type="checkbox"
                                    checked={selectedItems.length === items.length && items.length > 0}
                                    onChange={toggleSelectAll}
                                    className="rounded border-gray-300 text-amber-500"
                                />
                            </th>
                        )}
                        {columns.map(col => (
                            <th
                                key={col.key}
                                className={`px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase ${col.width}`}
                            >
                                {col.label}
                            </th>
                        ))}
                        {isAdmin && <th className="px-2 py-2 w-10"></th>}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {items.map((item, rowIdx) => (
                        <tr
                            key={item.id}
                            className={`hover:bg-gray-50 ${selectedItems.includes(item.id) ? 'bg-amber-50' : ''
                                }`}
                        >
                            {isAdmin && (
                                <td className="px-2 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.includes(item.id)}
                                        onChange={() => toggleSelectItem(item.id)}
                                        className="rounded border-gray-300 text-amber-500"
                                    />
                                </td>
                            )}
                            {columns.map((col, colIdx) => (
                                <td
                                    key={col.key}
                                    className={`px-2 py-2 cursor-pointer ${focusedCell?.row === rowIdx && focusedCell?.col === colIdx
                                            ? 'ring-2 ring-amber-400 ring-inset'
                                            : ''
                                        } ${col.type === 'number' || col.key === 'amount' ? 'text-right' : ''}`}
                                    onClick={() => {
                                        setFocusedCell({ row: rowIdx, col: colIdx });
                                        if (col.type !== 'readonly') {
                                            startEdit(item.id, col.key, (item as any)[col.key]);
                                        }
                                    }}
                                >
                                    {renderCell(item, col, rowIdx, colIdx)}
                                </td>
                            ))}
                            {isAdmin && (
                                <td className="px-2 py-2">
                                    <button
                                        onClick={() => onDelete(item.id)}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    >
                                        <FiTrash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Add Row Button */}
            {isAdmin && (
                <div className="border-t p-2">
                    <button
                        onClick={onAdd}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-amber-600 px-2 py-1"
                    >
                        <FiPlus className="w-4 h-4" />
                        Add Row
                    </button>
                </div>
            )}
        </div>
    );
}

export default BoqGrid;
