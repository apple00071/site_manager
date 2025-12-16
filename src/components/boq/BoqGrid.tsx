'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FiTrash2, FiPlus, FiCheck, FiX, FiChevronDown, FiChevronRight, FiSearch, FiEdit2, FiMoreVertical, FiCheckCircle, FiSend } from 'react-icons/fi';
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
    onEdit?: (item: any) => void;
    onSendProposal?: (itemIds: string[]) => void;
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
    onEdit,
    onSendProposal,
    categories
}: BoqGridProps) {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['All']));
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [showFilters, setShowFilters] = useState(true); // Default to true as per "give this format" request
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

    const columns = [
        { key: 'item_name', label: 'Item Name', type: 'text', searchable: true },
        { key: 'item_type', label: 'Type', type: 'select', options: ITEM_TYPES, searchable: true },
        { key: 'source', label: 'Source', type: 'select', options: SOURCES, searchable: true },
        { key: 'status', label: 'Status', type: 'select', options: STATUSES, searchable: true },
        { key: 'quantity', label: 'Qty', type: 'number', searchable: false },
        { key: 'unit', label: 'UOM', type: 'select', options: UNITS, searchable: true },
        { key: 'rate', label: 'Rate', type: 'number', searchable: false },
        { key: 'amount', label: 'Amount', type: 'readonly', searchable: false },
    ];

    // Group items by category (Memoized as before)
    const groupedItems = useMemo(() => {
        const groups: Record<string, BOQItem[]> = {};
        items.forEach(item => {
            const cat = item.category || 'Uncategorized';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });
        return groups;
    }, [items]);

    // Calculate section totals (Memoized as before)
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

    // Filter items (Memoized as before)
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
            draft: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
            confirmed: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
            completed: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
            pending: 'bg-gray-50 text-gray-600 border border-gray-100',
            rejected: 'bg-red-50 text-red-600 border border-red-100',
            ordered: 'bg-purple-50 text-purple-600 border border-purple-100',
            received: 'bg-green-50 text-green-600 border border-green-100',
        };
        return colors[status] || 'bg-gray-50 text-gray-600 border border-gray-100';
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

    // Close action menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (actionMenuId) {
                setActionMenuId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [actionMenuId]);

    const hasSelectedRef = useRef(false);

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

    const renderCell = (item: BOQItem, col: typeof columns[0]) => {
        const value = (item as any)[col.key];

        if (col.key === 'item_name') {
            return (
                <div className="flex items-center gap-2">
                    <div>
                        <span className="font-medium text-gray-900 block">{item.item_name}</span>
                        {item.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                        )}
                    </div>
                </div>
            );
        }

        if (col.key === 'amount') {
            return <span className="font-semibold text-gray-900">{formatAmount(value || 0)}</span>;
        }

        if (['status', 'order_status'].includes(col.key)) {
            return (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-block ${getStatusColor(value || 'draft')}`}>
                    {(value || 'draft').replace(/_/g, ' ')}
                </span>
            );
        }

        if (col.type === 'number') {
            return <span className="text-gray-600 font-medium">{value ?? 0}</span>;
        }

        return <span className="text-gray-600 block truncate max-w-[150px]">{value?.toString().replace(/_/g, ' ') || '-'}</span>;
    };

    const clearFilters = () => {
        setColumnFilters({});
    };

    const hasActiveFilters = Object.values(columnFilters).some(v => v.trim());

    return (
        <div className="overflow-visible bg-white border border-gray-200 md:rounded-lg shadow-sm">
            <div className="overflow-visible">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                        <tr>
                            {isAdmin && (
                                <th scope="col" className="px-4 py-3 text-left w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.length === items.length && items.length > 0}
                                        onChange={toggleSelectAll}
                                        className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                                    />
                                </th>
                            )}
                            <th scope="col" className="px-4 py-3 text-left w-10"></th> {/* Expand arrow column */}

                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    scope="col"
                                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.type === 'number' || col.key === 'amount' ? 'text-right' : ''
                                        }`}
                                >
                                    {col.label}
                                </th>
                            ))}

                            {isAdmin && (
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            )}
                        </tr>

                        {/* Filter Row */}
                        {showFilters && (
                            <tr className="bg-white border-b border-gray-200">
                                {isAdmin && <th className="px-4 py-2 w-10"></th>}
                                <th className="px-4 py-2 w-10"></th>

                                {columns.map(col => (
                                    <th key={col.key} className="px-4 py-2">
                                        {col.searchable ? (
                                            <div className="relative">
                                                {col.type === 'select' ? (
                                                    <div className="relative w-full">
                                                        <select
                                                            value={columnFilters[col.key] || ''}
                                                            onChange={(e) => setColumnFilters({ ...columnFilters, [col.key]: e.target.value })}
                                                            className="w-full pl-3 pr-8 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white appearance-none"
                                                        >
                                                            <option value="">Select</option>
                                                            {col.options?.map(opt => (
                                                                <option key={opt} value={opt}>{opt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                                                            ))}
                                                        </select>
                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                                            <FiChevronDown className="w-3 h-3" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="relative w-full">
                                                        {col.key === 'item_name' && (
                                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                                                                <FiSearch className="w-3 h-3 text-gray-400" />
                                                            </div>
                                                        )}
                                                        <input
                                                            type="text"
                                                            placeholder={col.key === 'item_name' ? 'Search Name...' : 'Search'}
                                                            value={columnFilters[col.key] || ''}
                                                            onChange={(e) => setColumnFilters({ ...columnFilters, [col.key]: e.target.value })}
                                                            className={`w-full py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white ${col.key === 'item_name' ? 'pl-8' : 'pl-3'}`}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-7"></div>
                                        )}
                                    </th>
                                ))}
                                {isAdmin && <th className="px-4 py-2"></th>}
                            </tr>
                        )}
                    </thead>

                    {/* Table Body - Grouped by Category */}
                    {Object.entries(filteredGroupedItems).map(([category, catItems]) => {
                        const isExpanded = expandedCategories.has(category);
                        const catTotal = sectionTotals[category] || { count: 0, amount: 0 };
                        const catItemIds = catItems.map(i => i.id);
                        const allCatSelected = catItemIds.length > 0 && catItemIds.every(id => selectedItems.includes(id));
                        const someCatSelected = catItemIds.some(id => selectedItems.includes(id));

                        // Calculate colSpan: columns.length + spacer + checkbox(if admin)
                        const totalColSpan = columns.length + 1 + (isAdmin ? 2 : 0);

                        return (
                            <tbody key={category} className="bg-white">
                                {/* Category Header Row */}
                                <tr
                                    className="bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100"
                                    onClick={() => toggleCategory(category)}
                                >
                                    <td colSpan={totalColSpan} className="px-0 py-0">
                                        <div className="flex items-center min-w-full py-3">
                                            {isAdmin && (
                                                <div className="px-4 w-10 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={allCatSelected}
                                                        ref={el => {
                                                            if (el) el.indeterminate = someCatSelected && !allCatSelected;
                                                        }}
                                                        onChange={() => toggleSelectCategory(category)}
                                                        className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                                                    />
                                                </div>
                                            )}

                                            <div className="px-4 w-10 flex items-center justify-center text-gray-400">
                                                <FiChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            </div>

                                            <div className="flex-1 px-4 flex items-center gap-3">
                                                <span className="font-bold text-gray-800 text-sm">{category}</span>
                                                <span className="bg-white text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200 shadow-sm">
                                                    {catTotal.count} Items
                                                </span>
                                            </div>

                                            <div className="px-4 text-sm font-semibold text-gray-900 pr-8">
                                                {formatAmount(catTotal.amount)}
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                {/* Items */}
                                {isExpanded && catItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors border-b border-gray-200">
                                        {isAdmin && (
                                            <td className="px-4 py-4 w-10 align-middle">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.includes(item.id)}
                                                    onChange={() => toggleSelectItem(item.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                                                />
                                            </td>
                                        )}

                                        <td className="px-4 py-4 w-10"></td> {/* Spacer for expand arrow */}

                                        {columns.map(col => (
                                            <td
                                                key={col.key}
                                                className={`px-4 py-4 text-sm text-gray-500 ${col.type === 'number' || col.key === 'amount' ? 'text-right whitespace-nowrap' : 'text-left'
                                                    } ${col.key !== 'item_name' ? 'whitespace-nowrap' : ''}`}
                                            >
                                                {renderCell(item, col)}
                                            </td>
                                        ))}

                                        {isAdmin && (
                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionMenuId(actionMenuId === item.id ? null : item.id);
                                                    }}
                                                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                                                >
                                                    <FiMoreVertical className="w-5 h-5" />
                                                </button>

                                                {/* Action Menu - Positioning needs to be improved for table usually, 
                                                    but relative container works if overflowing isn't hidden 
                                                */}
                                                {actionMenuId === item.id && (
                                                    <div className="absolute right-8 top-8 mt-2 w-48 rounded-md shadow-lg bg-white border border-gray-100 z-50">
                                                        <div className="py-1" role="menu">
                                                            {onEdit && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onEdit(item); setActionMenuId(null); }}
                                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                                                >
                                                                    <FiEdit2 className="w-4 h-4" /> Edit
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onDelete(item.id); setActionMenuId(null); }}
                                                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                            >
                                                                <FiTrash2 className="w-4 h-4" /> Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        );
                    })}
                </table>
                {/* Empty State */}
                {Object.keys(filteredGroupedItems).length === 0 && (
                    <div className="text-center py-16 text-gray-400 bg-white border-t border-gray-200">
                        <p>No items found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default BoqGrid;
