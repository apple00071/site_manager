'use client';

import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
    FiPlus, FiDownload, FiEdit2, FiTrash2, FiSearch, FiPackage,
    FiCheck, FiX, FiLayers, FiMapPin, FiUser, FiPhone, FiHome, FiAlertCircle
} from 'react-icons/fi';
import { generateBoqPDF, BoqPdfItem } from '@/lib/reports/boqPdfGenerator';
import type { Project } from '@/components/projects/ProjectDetailsClient';

export interface BOQItem {
    id: string;
    project_id: string;
    item_name: string;
    category?: string | null;
    description?: string | null; // Used to store Material Company
    material_company?: string | null;
    unit: string;
    quantity: number;
    rate?: number;
    sort_order?: number;
}

export interface BOQTabHandle {
    openAddItem: () => void;
    openExportPdf: () => void;
}

interface BOQTabProps {
    projectId: string;
    project?: Project | null;
}

interface CatalogItem {
    name: string;
    category: string;
    defaultCompany: string;
    defaultUnit: string;
}

// 23 Exact Hardcoded Items from User's Specification
export const HARDCODED_ITEMS: CatalogItem[] = [
    // Plywood & Boards
    { name: '16mm Royal Touch ply', category: 'Plywood & Boards', defaultCompany: 'Royal Touch', defaultUnit: 'Sheets' },
    { name: '9 mm Austin Gold ply', category: 'Plywood & Boards', defaultCompany: 'Austin Gold', defaultUnit: 'Sheets' },
    { name: '12 mm Royal Touch ply', category: 'Plywood & Boards', defaultCompany: 'Royal Touch', defaultUnit: 'Sheets' },
    { name: '19mm Royal Touch block board', category: 'Plywood & Boards', defaultCompany: 'Royal Touch', defaultUnit: 'Sheets' },
    { name: '25mm Royal Touch block board', category: 'Plywood & Boards', defaultCompany: 'Royal Touch', defaultUnit: 'Sheets' },
    { name: '0.8 Fabric liner 217SF', category: 'Plywood & Boards', defaultCompany: 'Royal Touch', defaultUnit: 'Sheets' },
    { name: '8mm flexi ply', category: 'Plywood & Boards', defaultCompany: 'Royal Touch', defaultUnit: 'Sheets' },

    // Adhesives
    { name: 'Fevicol Marine', category: 'Adhesives', defaultCompany: 'Fevicol', defaultUnit: 'Kg' },
    { name: 'Probond', category: 'Adhesives', defaultCompany: 'Probond', defaultUnit: 'Kg' },

    // PTA Screws
    { name: 'PTA Screws 75X4', category: 'PTA Screws', defaultCompany: 'Standard', defaultUnit: 'Boxes' },
    { name: 'PTA Screws 60X4', category: 'PTA Screws', defaultCompany: 'Standard', defaultUnit: 'Boxes' },
    { name: 'PTA Screws 50X4', category: 'PTA Screws', defaultCompany: 'Standard', defaultUnit: 'Boxes' },
    { name: 'PTA Screws 35X4', category: 'PTA Screws', defaultCompany: 'Standard', defaultUnit: 'Boxes' },
    { name: 'PTA Screws 30X4', category: 'PTA Screws', defaultCompany: 'Standard', defaultUnit: 'Boxes' },

    // Nails
    { name: 'Nails 2"X14No', category: 'Nails', defaultCompany: 'Standard', defaultUnit: 'Kg' },
    { name: 'Nails 1 1/2"X14No', category: 'Nails', defaultCompany: 'Standard', defaultUnit: 'Kg' },
    { name: 'Nails 1 1/4"X14No', category: 'Nails', defaultCompany: 'Standard', defaultUnit: 'Kg' },
    { name: 'Nails 1" X17No', category: 'Nails', defaultCompany: 'Standard', defaultUnit: 'Kg' },
    { name: 'Nails 3/4X19No', category: 'Nails', defaultCompany: 'Standard', defaultUnit: 'Kg' },

    // Consumables & Tools
    { name: 'Grinder paper 80no', category: 'Consumables & Tools', defaultCompany: 'Standard', defaultUnit: 'Nos' },
    { name: 'Grinder paper 60no', category: 'Consumables & Tools', defaultCompany: 'Standard', defaultUnit: 'Nos' },
    { name: 'Joint Pins', category: 'Consumables & Tools', defaultCompany: 'Standard', defaultUnit: 'Boxes' },
    { name: 'Laminate Cutter', category: 'Consumables & Tools', defaultCompany: 'Standard', defaultUnit: 'Nos' },
];

export const STANDARD_UNITS = [
    'Sheets', 'Kg', 'Boxes', 'Nos', 'Pkts', 'Bundles', 'Tubes', 'Sqft', 'Rft', 'Pairs', 'Sets', 'Lump Sum'
];

export const DELIVERY_FLOORS = [
    'Basement', 'Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', 'Terrace'
];

function resolveSiteEngineer(proj?: Project | null) {
    if (!proj) return { name: '', mobile: '' };

    // 1. Explicit site supervisor assigned to project
    if (proj.site_supervisor?.full_name) {
        return {
            name: proj.site_supervisor.full_name,
            mobile: proj.site_supervisor.phone_number || ''
        };
    }

    // 2. Check project members for designated site engineer / supervisor
    if (proj.project_members && proj.project_members.length > 0) {
        const eng = proj.project_members.find(pm => {
            const des = pm.users?.designation?.toLowerCase() || '';
            return des.includes('engineer') || des.includes('supervisor') || des.includes('site');
        });
        if (eng?.users?.full_name) {
            return {
                name: eng.users.full_name,
                mobile: eng.users.phone_number || ''
            };
        }
    }

    // Do NOT fallback to designer (assigned_employee)
    return { name: '', mobile: '' };
}

export const BOQTab = forwardRef<BOQTabHandle, BOQTabProps>(({ projectId, project }, ref) => {
    const [items, setItems] = useState<BOQItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Custom items stored per project in localStorage
    const [customCatalog, setCustomCatalog] = useState<CatalogItem[]>([]);

    // Modals
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<BOQItem | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);

    // Add/Edit Form State (Only 3 Core Fields)
    const [isCustomItem, setIsCustomItem] = useState(false);
    const [selectedCatalogItem, setSelectedCatalogItem] = useState<string>(HARDCODED_ITEMS[0].name);
    const [customItemName, setCustomItemName] = useState('');
    const [materialCompany, setMaterialCompany] = useState(HARDCODED_ITEMS[0].defaultCompany);
    const [quantity, setQuantity] = useState<number | string>(1);
    const [unit, setUnit] = useState(HARDCODED_ITEMS[0].defaultUnit);
    const [saving, setSaving] = useState(false);

    // PDF Export Settings
    const initialEng = resolveSiteEngineer(project);
    const [exportSiteName, setExportSiteName] = useState(project?.title || '');
    const [exportSiteAddress, setExportSiteAddress] = useState(project?.address || '');
    const [exportEngineerName, setExportEngineerName] = useState(initialEng.name);
    const [exportEngineerMobile, setExportEngineerMobile] = useState(initialEng.mobile);
    const [exportDeliveryFloor, setExportDeliveryFloor] = useState(
        project?.floor_number ? `${project.floor_number} Floor` : 'Ground Floor'
    );

    // Available engineers from site_supervisor and project_members (excluding designer)
    const availableEngineersList = useMemo(() => {
        const list: Array<{ id: string; name: string; mobile: string; designation: string }> = [];
        if (project?.site_supervisor?.full_name) {
            list.push({
                id: project.site_supervisor.id,
                name: project.site_supervisor.full_name,
                mobile: project.site_supervisor.phone_number || '',
                designation: 'Site Supervisor'
            });
        }
        if (project?.project_members) {
            project.project_members.forEach(pm => {
                if (pm.users?.full_name && pm.users.id !== project.assigned_employee?.id) {
                    // Don't add duplicate
                    if (!list.some(l => l.name === pm.users?.full_name)) {
                        list.push({
                            id: pm.users.id,
                            name: pm.users.full_name,
                            mobile: pm.users.phone_number || '',
                            designation: pm.users.designation || 'Site Team'
                        });
                    }
                }
            });
        }
        return list;
    }, [project]);

    // Expose handlers to parent page
    useImperativeHandle(ref, () => ({
        openAddItem: () => {
            setEditingItem(null);
            setIsCustomItem(false);
            const first = HARDCODED_ITEMS[0];
            setSelectedCatalogItem(first.name);
            setMaterialCompany(first.defaultCompany);
            setUnit(first.defaultUnit);
            setQuantity(1);
            setCustomItemName('');
            setShowItemModal(true);
        },
        openExportPdf: () => {
            setShowExportModal(true);
        }
    }));

    // Load custom catalog from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`boq_custom_items_${projectId}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) setCustomCatalog(parsed);
            }
        } catch (_) {}
    }, [projectId]);

    // Keep export defaults synced if project prop loads or updates
    useEffect(() => {
        if (project) {
            setExportSiteName(project.title || '');
            setExportSiteAddress(project.address || '');
            const resolved = resolveSiteEngineer(project);
            setExportEngineerName(resolved.name);
            setExportEngineerMobile(resolved.mobile);
            if (project.floor_number) {
                setExportDeliveryFloor(project.floor_number.includes('Floor') ? project.floor_number : `${project.floor_number} Floor`);
            }
        }
    }, [project]);

    // Fetch BOQ Items
    const fetchItems = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/boq?project_id=${projectId}&limit=1000`);
            if (!res.ok) throw new Error('Failed to fetch BOQ items');
            const data = await res.json();
            const rawItems: any[] = data.items || [];
            // Map description to material_company
            const mapped: BOQItem[] = rawItems.map(it => ({
                ...it,
                material_company: it.material_company || it.description || ''
            }));
            setItems(mapped);
        } catch (err: any) {
            setError(err.message || 'Error loading BOQ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [projectId]);

    // Full catalog = hardcoded + custom
    const combinedCatalog = useMemo(() => {
        return [...HARDCODED_ITEMS, ...customCatalog];
    }, [customCatalog]);

    // Handle selecting an item from the hardcoded catalog
    const handleCatalogSelect = (itemName: string) => {
        setSelectedCatalogItem(itemName);
        const found = combinedCatalog.find(c => c.name === itemName);
        if (found) {
            setMaterialCompany(found.defaultCompany || '');
            setUnit(found.defaultUnit || 'Sheets');
        }
    };

    // Open Edit Modal
    const handleEditItem = (item: BOQItem) => {
        setEditingItem(item);
        const matching = combinedCatalog.find(c => c.name.toLowerCase() === item.item_name.toLowerCase());
        if (matching) {
            setIsCustomItem(false);
            setSelectedCatalogItem(matching.name);
        } else {
            setIsCustomItem(true);
            setCustomItemName(item.item_name);
        }
        setMaterialCompany(item.material_company || item.description || '');
        setQuantity(item.quantity || 1);
        setUnit(item.unit || 'Sheets');
        setShowItemModal(true);
    };

    // Save Item (Create or Update)
    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalItemName = isCustomItem ? customItemName.trim() : selectedCatalogItem.trim();
        if (!finalItemName) {
            alert('Please specify an item name');
            return;
        }

        const numQty = parseFloat(String(quantity)) || 0;
        if (numQty <= 0) {
            alert('Quantity must be greater than 0');
            return;
        }

        setSaving(true);
        try {
            if (isCustomItem && !combinedCatalog.some(c => c.name.toLowerCase() === finalItemName.toLowerCase())) {
                // Save custom item to local project catalog for future selection
                const newCatItem: CatalogItem = {
                    name: finalItemName,
                    category: 'Custom Items',
                    defaultCompany: materialCompany || '',
                    defaultUnit: unit || 'Sheets'
                };
                const updated = [...customCatalog, newCatItem];
                setCustomCatalog(updated);
                try {
                    localStorage.setItem(`boq_custom_items_${projectId}`, JSON.stringify(updated));
                } catch (_) {}
            }

            if (editingItem) {
                // Update
                const res = await fetch('/api/boq', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingItem.id,
                        item_name: finalItemName,
                        description: materialCompany, // Store material company in description
                        quantity: numQty,
                        unit: unit,
                        rate: 0
                    })
                });
                if (!res.ok) throw new Error('Failed to update item');
            } else {
                // Create
                const res = await fetch('/api/boq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: projectId,
                        item_name: finalItemName,
                        description: materialCompany, // Store material company in description
                        quantity: numQty,
                        unit: unit,
                        rate: 0,
                        status: 'confirmed'
                    })
                });
                if (!res.ok) throw new Error('Failed to create item');
            }

            setShowItemModal(false);
            setEditingItem(null);
            await fetchItems();
        } catch (err: any) {
            alert(err.message || 'Error saving item');
        } finally {
            setSaving(false);
        }
    };

    // Delete Item
    const handleDeleteItem = async (id: string) => {
        if (!confirm('Are you sure you want to remove this item from BOQ?')) return;
        try {
            const res = await fetch(`/api/boq?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete item');
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err: any) {
            alert(err.message || 'Error deleting item');
        }
    };

    // Export PDF Trigger
    const handleDownloadPdf = () => {
        if (items.length === 0) {
            alert('There are no items in this BOQ to export.');
            return;
        }

        const pdfItems: BoqPdfItem[] = items.map(it => ({
            id: it.id,
            item_name: it.item_name,
            material_company: it.material_company || it.description || 'Standard',
            quantity: it.quantity,
            unit: it.unit
        }));

        generateBoqPDF({
            siteName: exportSiteName || project?.title || 'Site Project',
            siteAddress: exportSiteAddress || project?.address || 'N/A',
            engineerName: exportEngineerName || 'Site Engineer',
            engineerMobile: exportEngineerMobile || 'N/A',
            deliveryFloor: exportDeliveryFloor || 'Ground Floor',
            items: pdfItems
        });

        setShowExportModal(false);
    };

    // Filter items by search query
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items;
        const q = searchQuery.toLowerCase();
        return items.filter(i =>
            i.item_name.toLowerCase().includes(q) ||
            (i.material_company && i.material_company.toLowerCase().includes(q)) ||
            (i.description && i.description.toLowerCase().includes(q))
        );
    }, [items, searchQuery]);

    return (
        <div className="bg-white shadow sm:rounded-lg p-4 sm:p-6 space-y-6">
            {/* Search & Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by item name or material company..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:bg-white"
                    />
                </div>
                <div className="text-xs font-semibold text-gray-500 self-center sm:self-auto">
                    {filteredItems.length} of {items.length} Items
                </div>
            </div>

            {/* Main Table / List */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
                    <p className="mt-3 text-sm text-gray-500">Loading BOQ items...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
                    <FiAlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
                    <p className="font-medium">{error}</p>
                    <button
                        onClick={fetchItems}
                        className="mt-3 px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold rounded-md"
                    >
                        Try Again
                    </button>
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FiPackage className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">No BOQ items yet</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                        Add material items from the standard catalogue or enter your own custom items to prepare your site delivery sheet.
                    </p>
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setIsCustomItem(false);
                            setShowItemModal(true);
                        }}
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-sm shadow-sm transition-colors"
                    >
                        <FiPlus className="w-4 h-4" />
                        <span>Add First Item</span>
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-600 font-semibold">
                                    <th className="py-3.5 px-4 w-16 text-center">#</th>
                                    <th className="py-3.5 px-4">Particular (Item)</th>
                                    <th className="py-3.5 px-4 w-64">Material Company</th>
                                    <th className="py-3.5 px-4 w-44 text-right">Quantity</th>
                                    <th className="py-3.5 px-4 w-24 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {filteredItems.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                                        <td className="py-3.5 px-4 text-center text-gray-400 font-medium">
                                            {index + 1}
                                        </td>
                                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                                            {item.item_name}
                                        </td>
                                        <td className="py-3.5 px-4 text-gray-600">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                                {item.material_company || item.description || 'Standard'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                                            <span>{item.quantity}</span>
                                            <span className="ml-1.5 text-xs font-normal text-gray-500">{item.unit}</span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleEditItem(item)}
                                                    title="Edit Item"
                                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                >
                                                    <FiEdit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    title="Delete Item"
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {filteredItems.map((item, index) => (
                            <div key={item.id} className="p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center font-bold">
                                            {index + 1}
                                        </span>
                                        <span className="font-semibold text-gray-900">{item.item_name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleEditItem(item)}
                                            className="p-1.5 text-gray-500 hover:text-amber-600 rounded"
                                        >
                                            <FiEdit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                                        >
                                            <FiTrash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1">
                                    <span className="text-gray-500 font-medium">Company:</span>
                                    <span className="font-semibold text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                        {item.material_company || item.description || 'Standard'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500 font-medium">Quantity:</span>
                                    <span className="font-bold text-gray-900 text-sm">
                                        {item.quantity} {item.unit}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* ADD / EDIT ITEM MODAL (3 Core Fields: Item, Material Company, Qty) */}
            {/* ========================================================================= */}
            {showItemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingItem ? 'Edit BOQ Item' : 'Add BOQ Item'}
                            </h3>
                            <button
                                onClick={() => setShowItemModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                            {/* Toggle Between Predefined Catalog and Custom Item */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                        1. Particular (Item) <span className="text-red-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsCustomItem(!isCustomItem)}
                                        className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline"
                                    >
                                        {isCustomItem ? '← Select from Standard Catalog' : '+ Add Custom Item Instead'}
                                    </button>
                                </div>

                                {!isCustomItem ? (
                                    <select
                                        value={selectedCatalogItem}
                                        onChange={e => handleCatalogSelect(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                    >
                                        {/* Group by category */}
                                        {['Plywood & Boards', 'Adhesives', 'PTA Screws', 'Nails', 'Consumables & Tools', 'Custom Items'].map(cat => {
                                            const catItems = combinedCatalog.filter(c => c.category === cat);
                                            if (catItems.length === 0) return null;
                                            return (
                                                <optgroup key={cat} label={`── ${cat} ──`}>
                                                    {catItems.map(c => (
                                                        <option key={c.name} value={c.name}>
                                                            {c.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            );
                                        })}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="e.g. 18mm Marine Ply, SS Hinges 4-inch..."
                                        value={customItemName}
                                        onChange={e => setCustomItemName(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                    />
                                )}
                            </div>

                            {/* Field 2: Material Company */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                                    2. Material Company / Brand
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Royal Touch, Austin Gold, Fevicol, Asian Paints..."
                                    value={materialCompany || ''}
                                    onChange={e => setMaterialCompany(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {['Royal Touch', 'Austin Gold', 'Fevicol', 'Probond', 'Standard'].map(brand => (
                                        <button
                                            key={brand}
                                            type="button"
                                            onClick={() => setMaterialCompany(brand)}
                                            className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                                materialCompany === brand
                                                    ? 'bg-amber-100 border-amber-300 text-amber-800 font-semibold'
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            {brand}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Field 3: Quantity and Unit */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                                    3. Quantity & Unit <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0.1"
                                            placeholder="Quantity"
                                            value={quantity}
                                            onChange={e => setQuantity(e.target.value)}
                                            required
                                            className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-semibold text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <select
                                            value={unit}
                                            onChange={e => setUnit(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                        >
                                            {STANDARD_UNITS.map(u => (
                                                <option key={u} value={u}>
                                                    {u}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowItemModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* EXPORT TO PDF MODAL (With Logo, Site, Engineer, Phone & Delivery Floor) */}
            {/* ========================================================================= */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                                    <FiDownload className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Export BOQ Requirement PDF</h3>
                                    <p className="text-xs text-gray-500">Includes official Apple Interiors logo & site header</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Site Name */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                    <FiHome className="w-3.5 h-3.5 text-gray-400" />
                                    <span>Site / Project Name</span>
                                </label>
                                <input
                                    type="text"
                                    value={exportSiteName}
                                    onChange={e => setExportSiteName(e.target.value)}
                                    placeholder="Site Name"
                                    className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                            </div>

                            {/* Site Address */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                    <FiMapPin className="w-3.5 h-3.5 text-gray-400" />
                                    <span>Site Address</span>
                                </label>
                                <input
                                    type="text"
                                    value={exportSiteAddress}
                                    onChange={e => setExportSiteAddress(e.target.value)}
                                    placeholder="Full delivery address"
                                    className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Assigned Site Engineer Name */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase">
                                            <FiUser className="w-3.5 h-3.5 text-gray-400" />
                                            <span>Site Engineer</span>
                                        </label>
                                        {availableEngineersList.length > 0 && (
                                            <select
                                                onChange={e => {
                                                    const selected = availableEngineersList.find(u => u.name === e.target.value);
                                                    if (selected) {
                                                        setExportEngineerName(selected.name);
                                                        setExportEngineerMobile(selected.mobile);
                                                    }
                                                }}
                                                className="text-[11px] text-amber-600 bg-transparent border-0 outline-none cursor-pointer font-medium hover:underline max-w-[120px] truncate"
                                            >
                                                <option value="">Quick select...</option>
                                                {availableEngineersList.map(u => (
                                                    <option key={u.id} value={u.name}>
                                                        {u.name} ({u.designation})
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={exportEngineerName}
                                        onChange={e => setExportEngineerName(e.target.value)}
                                        placeholder="Enter Site Engineer Name"
                                        className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                                    />
                                </div>

                                {/* Mobile Number */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                        <FiPhone className="w-3.5 h-3.5 text-gray-400" />
                                        <span>Mobile Number</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={exportEngineerMobile}
                                        onChange={e => setExportEngineerMobile(e.target.value)}
                                        placeholder="Phone Number"
                                        className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Material Delivery Floor (Requested specifically by user) */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase mb-1">
                                    <FiLayers className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Material Delivery Floor</span> <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={exportDeliveryFloor}
                                        onChange={e => setExportDeliveryFloor(e.target.value)}
                                        className="flex-1 px-3.5 py-2 text-sm bg-amber-50/50 border border-amber-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-gray-900"
                                    >
                                        {DELIVERY_FLOORS.map(floor => (
                                            <option key={floor} value={floor}>
                                                {floor}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Or type custom floor"
                                        value={exportDeliveryFloor}
                                        onChange={e => setExportDeliveryFloor(e.target.value)}
                                        className="w-40 px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:bg-white outline-none"
                                    />
                                </div>
                            </div>

                            {/* Preview summary */}
                            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border border-gray-200 space-y-1">
                                <div className="flex justify-between">
                                    <span>Total Line Items:</span>
                                    <span className="font-bold text-gray-900">{items.length} items</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Brand Header:</span>
                                    <span className="font-bold text-amber-700">Apple Interiors (With Logo)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Footer:</span>
                                    <span>Site Engineer & Store In-Charge Signatures</span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowExportModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownloadPdf}
                                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition-colors"
                                >
                                    <FiDownload className="w-4 h-4" />
                                    <span>Download PDF</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

BOQTab.displayName = 'BOQTab';
