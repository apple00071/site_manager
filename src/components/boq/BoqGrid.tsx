'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FiTrash2, FiPlus, FiCheck, FiX, FiChevronDown, FiChevronRight, FiSearch } from 'react-icons/fi';
import { CustomSelect } from '@/components/ui/CustomSelect';

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
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['All']));
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [showFilters, setShowFilters] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

    const columns = [
        { key: 'item_name', label: 'Element Name & Description', type: 'text', width: 'w-64', searchable: true },
        { key: 'order_status', label: 'Order Status', type: 'select', options: ORDER_STATUSES, width: 'w-28', searchable: true },
        { key: 'item_type', label: 'Item Type', type: 'select', options: ITEM_TYPES, width: 'w-28', searchable: true },
        { key: 'source', label: 'Source', type: 'select', options: SOURCES, width: 'w-28', searchable: true },
        { key: 'status', label: 'Status', type: 'select', options: STATUSES, width: 'w-24', searchable: true },
        { key: 'quantity', label: 'Qty', type: 'number', width: 'w-20', searchable: false },
        { key: 'unit', label: 'UOM', type: 'select', options: UNITS, width: 'w-24', searchable: true },
        { key: 'draft_quantity', label: 'Draft Qty', type: 'number', width: 'w-24', searchable: false },
        { key: 'rate', label: 'Rate', type: 'number', width: 'w-24', searchable: false },
        { key: 'amount', label: 'Final Amount', type: 'readonly', width: 'w-28', searchable: false },
    ];

    // Group items by category
    const groupedItems = useMemo(() => {
        const groups: Record<string, BOQItem[]> = {};
        items.forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return groups;
    }, [items]);

    // Calculate section totals
    const sectionTotals = useMemo(() => {
        const totals: Record<string, { count: number; amount: number }> = {};
        Object.entries(groupedItems).forEach(([cat, catItems]) => {
            totals[cat] = {
                count: catItems.length,
                amount: catItems.reduce((sum, item) => sum + (item.amount || 0), 0)
            };
        });
        return totals;
    }, [groupedItems]);


    // Filter items based on column filters
    const filteredGroupedItems = useMemo(() => {
        const hasFilters = Object.values(columnFilters).some(v => v.trim());
        if (!hasFilters) return groupedItems;

        const filtered: Record<string, BOQItem[]> = {};
        Object.entries(groupedItems).forEach(([cat, catItems]) => {
            const matchingItems = catItems.filter(item => {
                return Object.entries(columnFilters).every(([key, filter]) => {
                    if (!filter.trim()) return true;
                    const value = String((item as any)[key] || '');
                    return value.toLowerCase().includes(filter.toLowerCase());
                });
            });
            if (matchingItems.length > 0) {
                filtered[cat] = matchingItems;
            }
        });
        return filtered;
    }, [groupedItems, columnFilters]);

    // Initialize all categories as expanded
    useEffect(() => {
        const allCats = new Set(Object.keys(groupedItems));
        setExpandedCategories(allCats);
    }, []);

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

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const startEdit = (rowId: string, field: string, currentValue: any) => {
        if (!isAdmin || field === 'amount' || field === 'item_code') return;
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

        const allItems = Object.values(filteredGroupedItems).flat();
        const item = allItems[focusedCell.row];
        const col = columns[focusedCell.col];
        if (col.type !== 'readonly' && rows[0][0] && item) {
            onUpdate(item.id, col.key, rows[0][0]);
        }
    }, [focusedCell, isAdmin, filteredGroupedItems, columns, onUpdate]);

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
        const allItems = Object.values(filteredGroupedItems).flat();
        if (selectedItems.length === allItems.length) {
            onSelect([]);
        } else {
            onSelect(allItems.map(i => i.id));
        }
    };

    const toggleSelectItem = (id: string) => {
        if (selectedItems.includes(id)) {
            onSelect(selectedItems.filter(i => i !== id));
        } else {
            onSelect([...selectedItems, id]);
        }
    };

    const toggleSelectCategory = (category: string) => {
        const catItems = filteredGroupedItems[category] || [];
        const catItemIds = catItems.map(i => i.id);
        const allSelected = catItemIds.every(id => selectedItems.includes(id));

        if (allSelected) {
            onSelect(selectedItems.filter(id => !catItemIds.includes(id)));
        } else {
            onSelect([...new Set([...selectedItems, ...catItemIds])]);
        }
    };

    const renderCell = (item: BOQItem, col: typeof columns[0], rowIdx: number, colIdx: number) => {
        const isEditing = editingCell?.rowId === item.id && editingCell?.field === col.key;
        const isFocused = focusedCell?.row === rowIdx && focusedCell?.col === colIdx;



        // Item name with description
        if (col.key === 'item_name') {
            if (isEditing) {
                return (
                    <input
                        ref={inputRef as any}
                        type="text"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={saveEdit}
                        className="w-full px-2 py-1 text-sm border-0 bg-gray-50 rounded outline-none"
                    />
                );
            }
            return (
                <div>
                    <span className="font-medium text-gray-900">{item.item_name}</span>
                    {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                    )}
                </div>
            );
        }

        const value = (item as any)[col.key];

        if (isEditing) {
            if (col.type === 'select') {
                return (
                    <CustomSelect
                        value={editingCell.value}
                        options={col.options || []}
                        onChange={(val) => {
                            setEditingCell({ ...editingCell, value: val });
                            // Auto-save on selection
                            onUpdate(editingCell.rowId, editingCell.field, val);
                            setEditingCell(null);
                        }}
                        onBlur={() => setEditingCell(null)}
                    />
                );
            }
            return (
                <input
                    ref={inputRef as any}
                    type={col.type === 'number' ? 'number' : 'text'}
                    value={editingCell.value}
                    onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                    onBlur={saveEdit}
                    className="w-full px-2 py-1 text-sm border-0 bg-gray-50 rounded outline-none"
                    step={col.type === 'number' ? '0.01' : undefined}
                />
            );
        }

        if (col.key === 'amount') {
            return <span className="font-semibold text-gray-900">{formatAmount(value || 0)}</span>;
        }

        if (['status', 'order_status'].includes(col.key)) {
            return (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(value || 'draft')}`}>
                    {(value || 'draft').replace(/_/g, ' ')}
                </span>
            );
        }

        if (col.type === 'number') {
            return <span className="text-gray-700">{value ?? 0}</span>;
        }

        return <span className="truncate text-gray-700">{value?.toString().replace(/_/g, ' ') || '-'}</span>;
    };

    const clearFilters = () => {
        setColumnFilters({});
    };

    const hasActiveFilters = Object.values(columnFilters).some(v => v.trim());

    return (
        <div className="overflow-visible" onKeyDown={handleKeyDown} tabIndex={0}>
            {/* Filter Toggle & Clear */}
            <div className="flex items-center justify-between px-3 py-2 bg-white">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${showFilters || hasActiveFilters
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    <FiSearch className="w-4 h-4" />
                    <span>Column Filters</span>
                    {hasActiveFilters && (
                        <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                            {Object.values(columnFilters).filter(v => v.trim()).length}
                        </span>
                    )}
                </button>
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                        <FiX className="w-3 h-3" />
                        Clear filters
                    </button>
                )}
            </div>

            <table ref={tableRef} className="min-w-full text-sm">
                <thead className="bg-white sticky top-0 z-10">
                    <tr>
                        {isAdmin && (
                            <th className="px-2 py-3 w-10">
                                <input
                                    type="checkbox"
                                    checked={selectedItems.length === items.length && items.length > 0}
                                    onChange={toggleSelectAll}
                                    className="rounded border-gray-300 text-amber-500 focus:ring-0"
                                />
                            </th>
                        )}
                        <th className="px-2 py-3 w-10"></th>
                        {columns.map(col => (
                            <th
                                key={col.key}
                                className={`px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${col.width}`}
                            >
                                {col.label}
                            </th>
                        ))}
                        {isAdmin && <th className="px-2 py-3 w-10"></th>}
                    </tr>
                    {/* Column filter row */}
                    {showFilters && (
                        <tr className="bg-white">
                            {isAdmin && <th className="px-2 py-2"></th>}
                            <th className="px-2 py-2"></th>
                            {columns.map(col => (
                                <th key={col.key} className="px-2 py-2">
                                    {col.searchable ? (
                                        <input
                                            type="text"
                                            placeholder={`Search ${col.label.toLowerCase()}...`}
                                            value={columnFilters[col.key] || ''}
                                            onChange={(e) => setColumnFilters({ ...columnFilters, [col.key]: e.target.value })}
                                            className="w-full px-2 py-1.5 text-xs border-0 bg-white rounded outline-none placeholder-gray-400"
                                        />
                                    ) : (
                                        <span className="text-gray-400 text-xs">-</span>
                                    )}
                                </th>
                            ))}
                            {isAdmin && <th className="px-2 py-2"></th>}
                        </tr>
                    )}
                </thead>
                <tbody className="bg-white">
                    {Object.entries(filteredGroupedItems).map(([category, catItems]) => {
                        const isExpanded = expandedCategories.has(category);
                        const catTotal = sectionTotals[category] || { count: 0, amount: 0 };
                        const catItemIds = catItems.map(i => i.id);
                        const allCatSelected = catItemIds.length > 0 && catItemIds.every(id => selectedItems.includes(id));
                        const someCatSelected = catItemIds.some(id => selectedItems.includes(id));

                        return (
                            <React.Fragment key={category}>
                                {/* Category Header Row */}
                                <tr className="bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition-colors">
                                    {isAdmin && (
                                        <td className="px-2 py-3">
                                            <input
                                                type="checkbox"
                                                checked={allCatSelected}
                                                ref={el => {
                                                    if (el) el.indeterminate = someCatSelected && !allCatSelected;
                                                }}
                                                onChange={() => toggleSelectCategory(category)}
                                                className="rounded border-gray-300 text-amber-500 focus:ring-0"
                                            />
                                        </td>
                                    )}
                                    <td className="px-2 py-3">
                                        <button
                                            onClick={() => toggleCategory(category)}
                                            className="p-1 hover:bg-amber-200 rounded transition-colors"
                                        >
                                            {isExpanded ? (
                                                <FiChevronDown className="w-4 h-4 text-amber-700" />
                                            ) : (
                                                <FiChevronRight className="w-4 h-4 text-amber-700" />
                                            )}
                                        </button>
                                    </td>
                                    <td colSpan={columns.length} className="px-3 py-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-gray-900">{category}</span>
                                                <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-medium rounded-full">
                                                    {catTotal.count} items
                                                </span>
                                            </div>
                                            <span className="text-sm font-semibold text-amber-800">
                                                Section Total: {formatAmount(catTotal.amount)}
                                            </span>
                                        </div>
                                    </td>
                                    {isAdmin && <td className="px-2 py-3"></td>}
                                </tr>

                                {/* Category Items */}
                                {isExpanded && catItems.map((item, itemIdx) => {
                                    // Calculate global row index for focus tracking
                                    let globalRowIdx = 0;
                                    for (const [cat, items] of Object.entries(filteredGroupedItems)) {
                                        if (cat === category) {
                                            globalRowIdx += itemIdx;
                                            break;
                                        }
                                        globalRowIdx += items.length;
                                    }

                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-gray-50 transition-colors"
                                        >
                                            {isAdmin && (
                                                <td className="px-2 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.includes(item.id)}
                                                        onChange={() => toggleSelectItem(item.id)}
                                                        className="rounded border-gray-300 text-amber-500 focus:ring-0"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-2 py-2.5"></td>
                                            {columns.map((col, colIdx) => (
                                                <td
                                                    key={col.key}
                                                    className={`px-3 py-2.5 cursor-pointer ${col.type === 'number' || col.key === 'amount' ? 'text-right' : ''}`}
                                                    onClick={() => {
                                                        setFocusedCell({ row: globalRowIdx, col: colIdx });
                                                        if (col.type !== 'readonly') {
                                                            startEdit(item.id, col.key, (item as any)[col.key]);
                                                        }
                                                    }}
                                                >
                                                    {renderCell(item, col, globalRowIdx, colIdx)}
                                                </td>
                                            ))}
                                            {isAdmin && (
                                                <td className="px-2 py-2.5">
                                                    <button
                                                        onClick={() => onDelete(item.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    >
                                                        <FiTrash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>

            {/* Add Row Button */}
            {isAdmin && (
                <div className="border-t p-3 bg-gray-50">
                    <button
                        onClick={onAdd}
                        className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 font-medium px-3 py-2 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                        <FiPlus className="w-4 h-4" />
                        Add Row
                    </button>
                </div>
            )}

            {/* Empty State */}
            {Object.keys(filteredGroupedItems).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    {hasActiveFilters ? (
                        <div>
                            <p className="mb-2">No items match your filters</p>
                            <button
                                onClick={clearFilters}
                                className="text-amber-600 hover:text-amber-700 font-medium"
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        <p>No items in this view</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default BoqGrid;
