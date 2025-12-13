'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    FiPlus, FiUpload, FiSend, FiGrid, FiList,
    FiAlertCircle, FiX, FiPackage, FiRefreshCw, FiDownload
} from 'react-icons/fi';
import { BoqGrid } from '@/components/boq/BoqGrid';
import { BoqCardMobile } from '@/components/boq/BoqCardMobile';
import { BoqImport } from '@/components/boq/BoqImport';
import { ProposalBuilder } from '@/components/boq/ProposalBuilder';

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
    status: 'draft' | 'confirmed' | 'completed';
    order_status?: string;
    item_type?: string;
    source?: string;
    draft_quantity?: number;
    linked_pos?: { id: string; po_number: string; status?: string }[];
    sort_order: number;
    remarks: string | null;
}

interface BOQTabProps {
    projectId: string;
}

const UNITS = ['Sqft', 'Rft', 'Nos', 'Kg', 'Cum', 'Sqm', 'Lump Sum', 'Set', 'Pair', 'Metric Ton'];
const STATUSES = ['draft', 'confirmed', 'completed'];

export function BOQTab({ projectId }: BOQTabProps) {
    const { isAdmin } = useAuth();
    const [items, setItems] = useState<BOQItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
    const [showImport, setShowImport] = useState(false);
    const [showProposal, setShowProposal] = useState(false);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [sectionTotals, setSectionTotals] = useState<Record<string, { count: number; amount: number }>>({});
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Dynamic categories from data
    const categories = useMemo(() => {
        const cats = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];
        return cats.sort();
    }, [items]);

    const fetchItems = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ project_id: projectId });
            if (activeCategory) params.set('section', activeCategory);

            const res = await fetch(`/api/boq?${params}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setItems(data.items || []);
            setSectionTotals(data.sectionTotals || {});
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BOQ');
        } finally {
            setLoading(false);
        }
    }, [projectId, activeCategory]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (filterStatus !== 'all' && item.status !== filterStatus) return false;
            return true;
        });
    }, [items, filterStatus]);

    const totals = useMemo(() => {
        const total = filteredItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        return { total };
    }, [filteredItems]);

    // Inline update
    const handleInlineUpdate = async (id: string, field: string, value: any) => {
        try {
            const res = await fetch('/api/boq', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, [field]: value }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Update local state
            setItems(prev => prev.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            ));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this item?')) return;
        try {
            const res = await fetch(`/api/boq?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchItems();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    const handleAddItem = async () => {
        try {
            const res = await fetch('/api/boq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    category: activeCategory || 'Uncategorized',
                    item_name: 'New Item',
                    unit: 'Nos',
                    quantity: 0,
                    rate: 0,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchItems();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Add failed');
        }
    };

    const handleBulkStatusUpdate = async (status: string) => {
        if (selectedItems.length === 0) return;
        try {
            const res = await fetch('/api/boq', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_status',
                    project_id: projectId,
                    item_ids: selectedItems,
                    status,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchItems();
            setSelectedItems([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
        }
    };

    const addCategory = () => {
        if (newCategoryName.trim()) {
            setActiveCategory(newCategoryName.trim());
            setNewCategoryName('');
            setShowAddCategory(false);
        }
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="flex gap-2 pb-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-9 w-24 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                    <div className="h-12 bg-gray-100 rounded"></div>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-14 bg-gray-50 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <div className="px-4 md:px-6 py-4 border-b bg-white">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Bill of Quantities</h2>
                        <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-gray-500">
                                {filteredItems.length} items
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                                Total: {formatAmount(totals.total)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* View Toggle */}
                        <div className="flex rounded-lg overflow-hidden border border-gray-200">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 focus:outline-none ${viewMode === 'grid' ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                style={viewMode === 'grid' ? { backgroundColor: '#eab308' } : {}}
                            >
                                <FiGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`p-2 focus:outline-none ${viewMode === 'cards' ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                style={viewMode === 'cards' ? { backgroundColor: '#eab308' } : {}}
                            >
                                <FiList className="w-4 h-4" />
                            </button>
                        </div>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                        >
                            <option value="all">All Status</option>
                            {STATUSES.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        {isAdmin && (
                            <>
                                <button
                                    onClick={() => setShowImport(true)}
                                    className="btn-secondary flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                                >
                                    <FiUpload className="w-4 h-4" />
                                    <span>Import</span>
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    className="btn-brand flex items-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    <span>Add</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="px-4 md:px-6 py-3 bg-white border-b overflow-x-auto">
                <div className="flex gap-2 min-w-max items-center">
                    <button
                        onClick={() => setActiveCategory(null)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap focus:outline-none ${activeCategory === null
                            ? 'text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        style={activeCategory === null ? { backgroundColor: '#eab308' } : {}}
                    >
                        All Items
                        <span
                            className={`ml-2 px-1.5 py-0.5 rounded text-xs ${activeCategory === null ? 'text-white' : 'bg-white text-gray-600'}`}
                            style={activeCategory === null ? { backgroundColor: '#ca8a04' } : {}}
                        >
                            {items.length}
                        </span>
                    </button>

                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap focus:outline-none ${activeCategory === cat
                                ? 'text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            style={activeCategory === cat ? { backgroundColor: '#eab308' } : {}}
                        >
                            {cat}
                            {sectionTotals[cat] && (
                                <>
                                    <span
                                        className={`ml-2 px-1.5 py-0.5 rounded text-xs ${activeCategory === cat ? 'text-white' : 'bg-white text-gray-600'}`}
                                        style={activeCategory === cat ? { backgroundColor: '#ca8a04' } : {}}
                                    >
                                        {sectionTotals[cat].count}
                                    </span>
                                    <span className="ml-1 text-xs opacity-75">
                                        {formatAmount(sectionTotals[cat].amount)}
                                    </span>
                                </>
                            )}
                        </button>
                    ))}

                    {/* Add Category */}
                    {showAddCategory ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Category name"
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') addCategory();
                                    if (e.key === 'Escape') {
                                        setShowAddCategory(false);
                                        setNewCategoryName('');
                                    }
                                }}
                            />
                            <button onClick={addCategory} className="p-2 bg-amber-500 text-white rounded-lg focus:outline-none hover:bg-amber-600">
                                <FiPlus className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} className="p-2 bg-gray-100 text-gray-600 rounded-lg focus:outline-none hover:bg-gray-200">
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAddCategory(true)}
                            className="px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 focus:outline-none"
                        >
                            <FiPlus className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedItems.length > 0 && isAdmin && (
                <div className="px-4 md:px-6 py-2 bg-amber-50 border-b flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-medium text-amber-800">
                        {selectedItems.length} selected
                    </span>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => handleBulkStatusUpdate('confirmed')}
                            className="px-3 py-1.5 text-sm text-white rounded-lg hover:opacity-90 focus:outline-none"
                            style={{ backgroundColor: '#eab308' }}
                        >
                            Confirm
                        </button>
                        <button
                            onClick={() => handleBulkStatusUpdate('completed')}
                            className="px-3 py-1.5 text-sm text-white rounded-lg hover:opacity-90 focus:outline-none"
                            style={{ backgroundColor: '#ca8a04' }}
                        >
                            Complete
                        </button>
                        <button
                            onClick={() => setShowProposal(true)}
                            className="px-3 py-1.5 text-sm text-white rounded-lg flex items-center gap-1 hover:opacity-90 focus:outline-none"
                            style={{ backgroundColor: '#eab308' }}
                        >
                            <FiSend className="w-3 h-3" />
                            Send Proposal
                        </button>
                        <button
                            onClick={() => setSelectedItems([])}
                            className="px-3 py-1.5 text-sm bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 focus:outline-none"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="mx-4 md:mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                    <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded">
                        <FiX className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <FiPackage className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No BOQ items yet</h3>
                        <p className="text-sm text-gray-500 text-center max-w-sm">
                            Start by adding items to your bill of quantities
                        </p>
                        {isAdmin && (
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={() => setShowImport(true)}
                                    className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium"
                                >
                                    <FiUpload className="w-4 h-4" />
                                    Import from Excel
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    className="btn-brand flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    Add Item
                                </button>
                            </div>
                        )}
                    </div>
                ) : (viewMode === 'cards' || isMobile) ? (
                    <BoqCardMobile
                        items={filteredItems}
                        isAdmin={isAdmin}
                        selectedItems={selectedItems}
                        onSelect={setSelectedItems}
                        onUpdate={handleInlineUpdate}
                        onDelete={handleDelete}
                    />
                ) : (
                    <div className="p-4 md:p-6">
                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                            <BoqGrid
                                items={filteredItems}
                                isAdmin={isAdmin}
                                selectedItems={selectedItems}
                                onSelect={setSelectedItems}
                                onUpdate={handleInlineUpdate}
                                onDelete={handleDelete}
                                onAdd={handleAddItem}
                                categories={categories}
                            />

                            {/* Grand Total */}
                            <div className="border-t-2 border-gray-200 bg-gray-50 px-4 py-3 flex justify-between items-center">
                                <span className="text-sm font-semibold text-gray-700">
                                    {activeCategory ? `${activeCategory} Total` : 'Grand Total'}
                                </span>
                                <span className="text-lg font-bold text-gray-900">
                                    {formatAmount(totals.total)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showImport && (
                <BoqImport
                    projectId={projectId}
                    onImportComplete={fetchItems}
                    onClose={() => setShowImport(false)}
                />
            )}

            {showProposal && (
                <ProposalBuilder
                    projectId={projectId}
                    items={items}
                    selectedItemIds={selectedItems}
                    onClose={() => setShowProposal(false)}
                    onSuccess={() => {
                        fetchItems();
                        setSelectedItems([]);
                    }}
                />
            )}
        </div>
    );
}

export default BOQTab;
