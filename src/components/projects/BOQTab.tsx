'use client';

import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
    FiPlus, FiDownload, FiEdit2, FiTrash2, FiSearch, FiPackage,
    FiCheck, FiX, FiLayers, FiMapPin, FiUser, FiPhone, FiHome, FiAlertCircle,
    FiCheckSquare, FiSquare, FiFilter, FiCalendar, FiTruck, FiCamera,
    FiImage, FiFileText, FiEye, FiCheckCircle, FiClock, FiRefreshCw
} from 'react-icons/fi';
import { compressImage, uploadFile } from '@/lib/uploadUtils';
import { generateBoqPDF, BoqPdfItem, generateLaminatePDF, LaminatePdfItem } from '@/lib/reports/boqPdfGenerator';
import type { Project } from '@/components/projects/ProjectDetailsClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';

export interface BOQItem {
    id: string;
    project_id: string;
    item_name: string;
    category?: string | null;
    sub_category?: string | null;
    description?: string | null;
    material_company?: string | null;
    unit: string;
    quantity: number;
    rate?: number;
    sort_order?: number;
    order_status?: string | null;
    delivered_quantity?: number | null;
    delivered_at?: string | null;
    delivered_by?: string | null;
    delivery_challan_url?: string | null;
    delivery_notes?: string | null;
    bill_number?: string | null;
}

export interface DeliveryBill {
    id: string;
    bill_number: string;
    bill_type: 'boq' | 'laminate';
    order_date: string;
    status: 'ordered' | 'delivered';
    item_count: number;
    items: BOQItem[];
    delivery_date?: string | null;
    delivered_at?: string | null;
    delivered_by?: string | null;
    delivery_challan_url?: string | null;
    delivery_notes?: string | null;
    created_at?: string;
}

export interface BOQTabHandle {
    openAddItem: () => void;
    openExportPdf: () => void;
    openAddLaminate?: () => void;
    openExportLaminatePdf?: () => void;
}

interface BOQTabProps {
    projectId: string;
    project?: Project | null;
    activeSubTab?: string;
    onSubTabChange?: (tab: string) => void;
}

interface CatalogItem {
    name: string;
    category: string;
    defaultCompany: string;
    defaultUnit: string;
}

export const LAMINATE_COMPANIES = [
    'Royal Touch',
    'Merino',
    'Greenlam',
    'Century',
    'Advance'
];

export const LAMINATE_CODE_SUGGESTIONS = [
    '1024 SF',
    '217 SF',
    '1.0mm Matt',
    '0.8mm Liner',
    '1025 SF Glossy',
    'Charcoal Grey Matt'
];

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

export const BOQTab = forwardRef<BOQTabHandle, BOQTabProps>(({ projectId, project, activeSubTab, onSubTabChange }, ref) => {
    const { hasPermission } = useUserPermissions();
    const canCreate = hasPermission('boq.create');
    const canEdit = hasPermission('boq.edit');
    const canDelete = hasPermission('boq.delete');
    const canManageDelivery = hasPermission('boq.delivery');

    const [items, setItems] = useState<BOQItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Sub-tab selection (synced with parent or local)
    const [internalSubTab, setInternalSubTab] = useState<'boq' | 'laminate' | 'delivery_bills'>('boq');
    const currentSubTab = (activeSubTab === 'laminate' || activeSubTab === 'boq' || activeSubTab === 'delivery_bills') ? (activeSubTab as 'boq' | 'laminate' | 'delivery_bills') : internalSubTab;

    const handleSwitchSubTab = (tab: 'boq' | 'laminate' | 'delivery_bills') => {
        setInternalSubTab(tab);
        if (onSubTabChange) onSubTabChange(tab);
    };

    // Delivery Bills State
    const [bills, setBills] = useState<DeliveryBill[]>([]);
    const [loadingBills, setLoadingBills] = useState(false);
    const [billStatusFilter, setBillStatusFilter] = useState<'all' | 'ordered' | 'delivered'>('all');
    const [selectedBillForDelivery, setSelectedBillForDelivery] = useState<DeliveryBill | null>(null);

    // Custom items stored per project in localStorage
    const [customCatalog, setCustomCatalog] = useState<CatalogItem[]>([]);

    // Modals - BOQ
    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState<BOQItem | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);

    // Modals - Laminate
    const [showLaminateModal, setShowLaminateModal] = useState(false);
    const [editingLaminate, setEditingLaminate] = useState<BOQItem | null>(null);
    const [showExportLaminateModal, setShowExportLaminateModal] = useState(false);

    // BOQ Add/Edit Form State
    const [isCustomItem, setIsCustomItem] = useState(false);
    const [selectedCatalogItem, setSelectedCatalogItem] = useState<string>(HARDCODED_ITEMS[0].name);
    const [customItemName, setCustomItemName] = useState('');
    const [itemSupplier, setItemSupplier] = useState('');
    const [quantity, setQuantity] = useState<number | string>(1);
    const [unit, setUnit] = useState(HARDCODED_ITEMS[0].defaultUnit);

    // Laminate Add/Edit Form State
    const [laminateCode, setLaminateCode] = useState('');
    const [laminateCompany, setLaminateCompany] = useState('');
    const [laminateQuantity, setLaminateQuantity] = useState<number | string>(1);

    // Table multi-selection state
    const [selectedBoqIds, setSelectedBoqIds] = useState<Set<string>>(new Set());
    const [selectedLaminateIds, setSelectedLaminateIds] = useState<Set<string>>(new Set());

    // Export Modal item selection & supplier/company filters
    const [exportSelectedBoqIds, setExportSelectedBoqIds] = useState<Set<string>>(new Set());
    const [exportSupplierFilter, setExportSupplierFilter] = useState<string>('all');

    const [exportSelectedLaminateIds, setExportSelectedLaminateIds] = useState<Set<string>>(new Set());
    const [exportCompanyFilter, setExportCompanyFilter] = useState<string>('all');

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
    const [exportDate, setExportDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [exportMarkOrdered, setExportMarkOrdered] = useState(true);

    // Delivery Confirmation State
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [deliveryTargetItems, setDeliveryTargetItems] = useState<BOQItem[]>([]);
    const [deliveryQuantities, setDeliveryQuantities] = useState<Record<string, number>>({});
    const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [deliveryPhotoFile, setDeliveryPhotoFile] = useState<File | null>(null);
    const [deliveryPhotoPreview, setDeliveryPhotoPreview] = useState<string | null>(null);
    const [submittingDelivery, setSubmittingDelivery] = useState(false);

    // Challan Lightbox Preview State
    const [previewChallan, setPreviewChallan] = useState<{
        url: string;
        title: string;
        notes?: string;
        date?: string;
    } | null>(null);

    const openDeliveryModalForBill = (bill: DeliveryBill) => {
        setSelectedBillForDelivery(bill);
        setDeliveryTargetItems(bill.items);
        const initialQtys: Record<string, number> = {};
        bill.items.forEach(it => {
            initialQtys[it.id] = (it.delivered_quantity && it.delivered_quantity > 0) ? it.delivered_quantity : (it.quantity || 1);
        });
        setDeliveryQuantities(initialQtys);
        setDeliveryDate(new Date().toISOString().split('T')[0]);
        setDeliveryNotes(bill.delivery_notes || '');
        setDeliveryPhotoFile(null);
        setDeliveryPhotoPreview(bill.delivery_challan_url || null);
        setShowDeliveryModal(true);
    };

    const openDeliveryModalForItems = (targetItems: BOQItem[]) => {
        if (targetItems.length === 0) return;
        setSelectedBillForDelivery(null);
        setDeliveryTargetItems(targetItems);
        const initialQtys: Record<string, number> = {};
        targetItems.forEach(it => {
            initialQtys[it.id] = (it.delivered_quantity && it.delivered_quantity > 0) ? it.delivered_quantity : (it.quantity || 1);
        });
        setDeliveryQuantities(initialQtys);
        setDeliveryDate(new Date().toISOString().split('T')[0]);
        setDeliveryNotes('');
        setDeliveryPhotoFile(null);
        setDeliveryPhotoPreview(null);
        setShowDeliveryModal(true);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setDeliveryPhotoFile(file);
        const objectUrl = URL.createObjectURL(file);
        setDeliveryPhotoPreview(objectUrl);
    };

    const handleConfirmDeliverySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (deliveryTargetItems.length === 0) return;

        setSubmittingDelivery(true);
        try {
            let challanUrl: string | null = null;
            if (deliveryPhotoFile) {
                const compressed = await compressImage(deliveryPhotoFile);
                challanUrl = await uploadFile(
                    compressed,
                    'project-update-photos',
                    `boq-delivery/${projectId}`
                );
            }

            const res = await fetch('/api/boq/delivery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    bill_number: selectedBillForDelivery?.bill_number,
                    item_ids: deliveryTargetItems.map(it => it.id),
                    delivered_quantities: deliveryQuantities,
                    delivery_date: deliveryDate,
                    delivery_challan_url: challanUrl,
                    delivery_notes: deliveryNotes.trim() || undefined,
                    status: 'delivered'
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to confirm delivery');
            }

            setShowDeliveryModal(false);
            setDeliveryTargetItems([]);
            setSelectedBillForDelivery(null);
            setSelectedBoqIds(new Set());
            setSelectedLaminateIds(new Set());
            await Promise.all([fetchItems(), fetchBills()]);
        } catch (err: any) {
            alert(err.message || 'Error confirming delivery');
        } finally {
            setSubmittingDelivery(false);
        }
    };

    const handleBulkMarkOrdered = async (itemIds: string[]) => {
        try {
            const res = await fetch('/api/boq/bills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    item_ids: itemIds,
                    bill_type: currentSubTab === 'laminate' ? 'laminate' : 'boq',
                    order_date: new Date().toISOString().split('T')[0],
                    notes: `Marked ordered on ${new Date().toISOString().split('T')[0]}`
                })
            });
            if (!res.ok) throw new Error('Failed to update status');
            await Promise.all([fetchItems(), fetchBills()]);
            setSelectedBoqIds(new Set());
            setSelectedLaminateIds(new Set());
        } catch (err: any) {
            alert(err.message || 'Error updating status');
        }
    };

    const handleStatusChange = async (item: BOQItem, newStatus: string) => {
        if (newStatus === 'delivered') {
            openDeliveryModalForItems([item]);
            return;
        }

        try {
            const res = await fetch('/api/boq/delivery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    item_ids: [item.id],
                    status: newStatus,
                    delivery_notes: newStatus === 'ordered'
                        ? `Marked as ordered on ${new Date().toISOString().split('T')[0]}`
                        : undefined
                })
            });
            if (!res.ok) throw new Error('Failed to update status');
            await Promise.all([fetchItems(), fetchBills()]);
        } catch (err: any) {
            alert(err.message || 'Error updating status');
        }
    };

    const renderDeliveryStatusBadge = (item: BOQItem) => {
        const isDelivered = item.order_status === 'delivered';
        const isOrdered = item.order_status === 'ordered';
        const billLabel = item.bill_number || (item.delivery_notes?.match(/(?:\[)?(Bill\s*#?\d+)/i)?.[1]) || null;

        if (isDelivered) {
            return (
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                        <FiCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{billLabel ? `${billLabel} • Delivered` : 'Bill #1 • Delivered'}</span>
                    </span>
                    {item.delivery_challan_url && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreviewChallan({
                                    url: item.delivery_challan_url!,
                                    title: `${item.item_name} - Delivery Challan`,
                                    notes: item.delivery_notes || undefined,
                                    date: item.delivered_at
                                        ? new Date(item.delivered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : undefined
                                });
                            }}
                            className="p-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            title="View Challan Photo"
                        >
                            <FiImage className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            );
        }

        if (isOrdered) {
            return (
                <button
                    type="button"
                    onClick={() => handleSwitchSubTab('delivery_bills')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                    title="Click to view in Delivery Bills"
                >
                    <FiTruck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{billLabel ? `${billLabel} • Ordered` : 'Bill #1 • Ordered'}</span>
                </button>
            );
        }

        return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                Not Ordered
            </span>
        );
    };

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
            if (!canCreate) {
                alert('Permission denied: You do not have permission to add BOQ items.');
                return;
            }
            setEditingItem(null);
            setIsCustomItem(false);
            const first = HARDCODED_ITEMS[0];
            setSelectedCatalogItem(first.name);
            setUnit(first.defaultUnit);
            setQuantity(1);
            setCustomItemName('');
            setItemSupplier('');
            setShowItemModal(true);
        },
        openExportPdf: () => {
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
            // Pre-select items: if items are checked in the table, use those; otherwise select all
            if (selectedBoqIds.size > 0) {
                setExportSelectedBoqIds(new Set(selectedBoqIds));
            } else {
                setExportSelectedBoqIds(new Set(items.filter(it => it.category !== 'laminate').map(i => i.id)));
            }
            setExportSupplierFilter('all');
            setShowExportModal(true);
        },
        openAddLaminate: () => {
            if (!canCreate) {
                alert('Permission denied: You do not have permission to add BOQ items.');
                return;
            }
            setEditingLaminate(null);
            setLaminateCode('');
            setLaminateCompany('Royal Touch');
            setLaminateQuantity(1);
            setShowLaminateModal(true);
        },
        openExportLaminatePdf: () => {
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
            if (selectedLaminateIds.size > 0) {
                setExportSelectedLaminateIds(new Set(selectedLaminateIds));
            } else {
                setExportSelectedLaminateIds(new Set(items.filter(it => it.category === 'laminate').map(i => i.id)));
            }
            setExportCompanyFilter('all');
            setShowExportLaminateModal(true);
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

    // Fetch Consolidated Delivery Bills
    const fetchBills = async () => {
        setLoadingBills(true);
        try {
            const res = await fetch(`/api/boq/bills?project_id=${projectId}`);
            if (res.ok) {
                const data = await res.json();
                setBills(data.bills || []);
            }
        } catch (err) {
            console.error('Error fetching delivery bills:', err);
        } finally {
            setLoadingBills(false);
        }
    };

    useEffect(() => {
        fetchItems();
        fetchBills();
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
            setUnit(found.defaultUnit || 'Sheets');
        }
    };

    // Open Edit Modal
    const handleEditItem = (item: BOQItem) => {
        if (!canEdit) {
            alert('Permission denied: You do not have permission to edit BOQ items.');
            return;
        }
        setEditingItem(item);
        const matching = combinedCatalog.find(c => c.name.toLowerCase() === item.item_name.toLowerCase());
        if (matching) {
            setIsCustomItem(false);
            setSelectedCatalogItem(matching.name);
        } else {
            setIsCustomItem(true);
            setCustomItemName(item.item_name);
        }
        setQuantity(item.quantity || 1);
        setUnit(item.unit || 'Sheets');
        setItemSupplier(item.sub_category || item.category || '');
        setShowItemModal(true);
    };

    // Save Item (Create or Update)
    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem && !canEdit) {
            alert('Permission denied: You do not have permission to edit BOQ items.');
            return;
        }
        if (!editingItem && !canCreate) {
            alert('Permission denied: You do not have permission to create BOQ items.');
            return;
        }
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
                    defaultCompany: '',
                    defaultUnit: unit || 'Sheets'
                };
                const updated = [...customCatalog, newCatItem];
                setCustomCatalog(updated);
                try {
                    localStorage.setItem(`boq_custom_items_${projectId}`, JSON.stringify(updated));
                } catch (_) {}
            }

            const cleanSupplier = itemSupplier.trim() || null;

            if (editingItem) {
                // Update
                const res = await fetch('/api/boq', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingItem.id,
                        item_name: finalItemName,
                        sub_category: cleanSupplier,
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
                        sub_category: cleanSupplier,
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
            setItemSupplier('');
            await fetchItems();
        } catch (err: any) {
            alert(err.message || 'Error saving item');
        } finally {
            setSaving(false);
        }
    };

    // Delete Item
    const handleDeleteItem = async (id: string) => {
        if (!canDelete) {
            alert('Permission denied: You do not have permission to delete BOQ items.');
            return;
        }
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
    // Separate BOQ items and Laminate items
    const boqItems = useMemo(() => items.filter(it => it.category !== 'laminate'), [items]);
    const laminateItems = useMemo(() => items.filter(it => it.category === 'laminate'), [items]);

    // Unique suppliers/categories list for filtering & dividing
    const availableSuppliers = useMemo(() => {
        const set = new Set<string>();
        boqItems.forEach(it => {
            const s = it.sub_category?.trim();
            if (s) set.add(s);
        });
        return Array.from(set).sort();
    }, [boqItems]);

    // Unique laminate companies list for filtering
    const availableLaminateCompanies = useMemo(() => {
        const set = new Set<string>();
        laminateItems.forEach(it => {
            const c = (it.sub_category || it.material_company)?.trim();
            if (c) set.add(c);
        });
        return Array.from(set).sort();
    }, [laminateItems]);

    // Table selection helpers - BOQ
    const toggleSelectBoq = (id: string) => {
        setSelectedBoqIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAllBoq = () => {
        if (selectedBoqIds.size === filteredBoqItems.length && filteredBoqItems.length > 0) {
            setSelectedBoqIds(new Set());
        } else {
            setSelectedBoqIds(new Set(filteredBoqItems.map(i => i.id)));
        }
    };

    // Table selection helpers - Laminate
    const toggleSelectLaminate = (id: string) => {
        setSelectedLaminateIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAllLaminate = () => {
        if (selectedLaminateIds.size === filteredLaminateItems.length && filteredLaminateItems.length > 0) {
            setSelectedLaminateIds(new Set());
        } else {
            setSelectedLaminateIds(new Set(filteredLaminateItems.map(i => i.id)));
        }
    };

    // Export BOQ PDF Trigger (Exports only selected items; supplier is NEVER printed on PDF)
    const handleDownloadPdf = () => {
        const itemsToExport = boqItems.filter(it => exportSelectedBoqIds.has(it.id));
        if (itemsToExport.length === 0) {
            alert('Please select at least one item to export.');
            return;
        }

        const pdfItems: BoqPdfItem[] = itemsToExport.map(it => ({
            id: it.id,
            item_name: it.item_name,
            quantity: it.quantity,
            unit: it.unit
        }));

        generateBoqPDF({
            siteName: exportSiteName || project?.title || 'Site Project',
            siteAddress: exportSiteAddress || project?.address || 'N/A',
            engineerName: exportEngineerName || 'Site Engineer',
            engineerMobile: exportEngineerMobile || 'N/A',
            deliveryFloor: exportDeliveryFloor || 'Ground Floor',
            date: exportDate,
            items: pdfItems
        });

        if (exportMarkOrdered) {
            fetch('/api/boq/bills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    item_ids: itemsToExport.map(it => it.id),
                    bill_type: 'boq',
                    order_date: exportDate,
                    notes: `BOQ Material Requirement Export on ${exportDate}`
                })
            }).then(async () => {
                await Promise.all([fetchItems(), fetchBills()]);
            }).catch(err => console.error(err));
        }

        setShowExportModal(false);
    };

    // Open Edit Laminate Modal
    const handleEditLaminate = (item: BOQItem) => {
        if (!canEdit) {
            alert('Permission denied: You do not have permission to edit BOQ items.');
            return;
        }
        setEditingLaminate(item);
        setLaminateCode(item.item_name || '');
        setLaminateCompany(item.sub_category || item.material_company || 'Royal Touch');
        setLaminateQuantity(item.quantity || 1);
        setShowLaminateModal(true);
    };

    // Save Laminate Item
    const handleSaveLaminate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingLaminate && !canEdit) {
            alert('Permission denied: You do not have permission to edit BOQ items.');
            return;
        }
        if (!editingLaminate && !canCreate) {
            alert('Permission denied: You do not have permission to create BOQ items.');
            return;
        }
        const finalCode = laminateCode.trim();
        if (!finalCode) {
            alert('Please specify a laminate code');
            return;
        }

        const numQty = parseFloat(String(laminateQuantity)) || 0;
        if (numQty <= 0) {
            alert('Quantity must be greater than 0');
            return;
        }

        const finalCompany = laminateCompany.trim() || 'Standard';

        setSaving(true);
        try {
            if (editingLaminate) {
                const res = await fetch('/api/boq', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingLaminate.id,
                        category: 'laminate',
                        item_name: finalCode,
                        sub_category: finalCompany,
                        description: null,
                        quantity: numQty,
                        unit: 'Sheets',
                        rate: 0
                    })
                });
                if (!res.ok) throw new Error('Failed to update laminate item');
            } else {
                const res = await fetch('/api/boq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        project_id: projectId,
                        category: 'laminate',
                        item_name: finalCode,
                        sub_category: finalCompany,
                        description: null,
                        quantity: numQty,
                        unit: 'Sheets',
                        rate: 0,
                        status: 'confirmed'
                    })
                });
                if (!res.ok) throw new Error('Failed to create laminate item');
            }

            setShowLaminateModal(false);
            setEditingLaminate(null);
            await fetchItems();
        } catch (err: any) {
            alert(err.message || 'Error saving laminate item');
        } finally {
            setSaving(false);
        }
    };

    // Export Laminate PDF Trigger (Exports only selected items; supplier is NEVER printed on PDF)
    const handleDownloadLaminatePdf = () => {
        const itemsToExport = laminateItems.filter(it => exportSelectedLaminateIds.has(it.id));
        if (itemsToExport.length === 0) {
            alert('Please select at least one laminate sheet to export.');
            return;
        }

        const pdfItems: LaminatePdfItem[] = itemsToExport.map(it => ({
            id: it.id,
            item_name: it.item_name,
            company: it.sub_category || it.material_company || '-',
            quantity: it.quantity,
            unit: it.unit || 'Sheets'
        }));

        generateLaminatePDF({
            siteName: exportSiteName || project?.title || 'Site Project',
            siteAddress: exportSiteAddress || project?.address || 'N/A',
            engineerName: exportEngineerName || 'Site Engineer',
            engineerMobile: exportEngineerMobile || 'N/A',
            deliveryFloor: exportDeliveryFloor || 'Ground Floor',
            date: exportDate,
            items: pdfItems
        });

        if (exportMarkOrdered) {
            fetch('/api/boq/bills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    item_ids: itemsToExport.map(it => it.id),
                    bill_type: 'laminate',
                    order_date: exportDate,
                    notes: `Laminate Sheet Export on ${exportDate}`
                })
            }).then(async () => {
                await Promise.all([fetchItems(), fetchBills()]);
            }).catch(err => console.error(err));
        }

        setShowExportLaminateModal(false);
    };

    // Filter items by search query
    const filteredBoqItems = useMemo(() => {
        if (!searchQuery.trim()) return boqItems;
        const q = searchQuery.toLowerCase();
        return boqItems.filter(i => i.item_name.toLowerCase().includes(q));
    }, [boqItems, searchQuery]);

    const filteredLaminateItems = useMemo(() => {
        if (!searchQuery.trim()) return laminateItems;
        const q = searchQuery.toLowerCase();
        return laminateItems.filter(i =>
            i.item_name.toLowerCase().includes(q) ||
            (i.description && i.description.toLowerCase().includes(q)) ||
            (i.sub_category && i.sub_category.toLowerCase().includes(q))
        );
    }, [laminateItems, searchQuery]);

    const filteredBills = useMemo(() => {
        return bills.filter(b => {
            if (billStatusFilter !== 'all' && b.status !== billStatusFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const numMatch = b.bill_number.toLowerCase().includes(q);
                const notesMatch = b.delivery_notes?.toLowerCase().includes(q) || false;
                const itemsMatch = b.items?.some(it => it.item_name.toLowerCase().includes(q)) || false;
                return numMatch || notesMatch || itemsMatch;
            }
            return true;
        });
    }, [bills, billStatusFilter, searchQuery]);

    return (
        <div className="bg-white shadow sm:rounded-lg p-4 sm:p-6 space-y-6">


            {/* Search & Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder={
                            currentSubTab === 'delivery_bills'
                                ? 'Search bills by Bill #, items, remarks...'
                                : currentSubTab === 'laminate'
                                    ? 'Search by laminate code, location, or finish...'
                                    : 'Search by item name...'
                        }
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:bg-white"
                    />
                </div>
                <div className="text-xs font-semibold text-gray-500 self-center sm:self-auto">
                    {currentSubTab === 'delivery_bills'
                        ? `${filteredBills.length} of ${bills.length} Bills`
                        : currentSubTab === 'laminate'
                            ? `${filteredLaminateItems.length} of ${laminateItems.length} Laminates`
                            : `${filteredBoqItems.length} of ${boqItems.length} Items`}
                </div>
            </div>

            {/* Loading & Error States */}
            {loading ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
                    <p className="mt-3 text-sm text-gray-500">
                        Loading {currentSubTab === 'delivery_bills' ? 'Delivery bills' : currentSubTab === 'laminate' ? 'Laminate sheets' : 'BOQ items'}...
                    </p>
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
            ) : currentSubTab === 'delivery_bills' ? (
                /* ======================== CONSOLIDATED DELIVERY BILLS VIEW ======================== */
                loadingBills ? (
                    <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
                        <p className="mt-3 text-sm text-gray-500">Loading delivery bills...</p>
                    </div>
                ) : bills.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiTruck className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No Delivery Bills yet</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                            Orders exported from BOQ or Laminates will appear here for site delivery verification.
                        </p>
                        <button
                            type="button"
                            onClick={() => handleSwitchSubTab('boq')}
                            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-sm shadow-sm transition-colors cursor-pointer"
                        >
                            <span>Go to BOQ Items to Export</span>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Filter Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/80 p-3 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {(['all', 'ordered', 'delivered'] as const).map(f => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setBillStatusFilter(f)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                                            billStatusFilter === f
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                        }`}
                                    >
                                        {f === 'all'
                                            ? `All Bills (${bills.length})`
                                            : f === 'ordered'
                                                ? `Awaiting Delivery (${bills.filter(b => b.status === 'ordered').length})`
                                                : `Delivered (${bills.filter(b => b.status === 'delivered').length})`}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={fetchBills}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-colors cursor-pointer"
                            >
                                <FiRefreshCw className="w-3.5 h-3.5" />
                                <span>Refresh</span>
                            </button>
                        </div>

                        {/* Bill Cards List */}
                        <div className="grid grid-cols-1 gap-4">
                            {filteredBills.map(bill => {
                                const isDelivered = bill.status === 'delivered';
                                return (
                                    <div
                                        key={bill.id || bill.bill_number}
                                        className={`rounded-2xl border transition-all overflow-hidden ${
                                            isDelivered
                                                ? 'border-emerald-200 bg-white shadow-xs'
                                                : 'border-amber-300 bg-linear-to-b from-amber-50/30 via-white to-white shadow-sm'
                                        }`}
                                    >
                                        {/* Bill Card Header */}
                                        <div className={`p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 ${
                                            isDelivered ? 'border-emerald-100 bg-emerald-50/30' : 'border-amber-100 bg-amber-50/50'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                                    isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    <FiTruck className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-base font-bold text-gray-900">{bill.bill_number}</h4>
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                                            bill.bill_type === 'laminate'
                                                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                : 'bg-blue-50 text-blue-700 border-blue-200'
                                                        }`}>
                                                            {bill.bill_type === 'laminate' ? 'Laminates' : 'BOQ Materials'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        Exported on: <span className="font-medium text-gray-700">{bill.order_date}</span> • {bill.item_count} {bill.item_count === 1 ? 'item' : 'items'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2.5">
                                                {isDelivered ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        <FiCheckCircle className="w-4 h-4 text-emerald-600" />
                                                        <span>Delivered</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                        <FiClock className="w-4 h-4 text-amber-700" />
                                                        <span>Awaiting Site Delivery</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bill Items List */}
                                        <div className="p-4 sm:p-5 space-y-3">
                                            <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-50/50">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-gray-100/70 text-gray-600 uppercase font-semibold border-b border-gray-200/60">
                                                        <tr>
                                                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                                                            <th className="py-2.5 px-3">Item Name</th>
                                                            <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                                                            {isDelivered && (
                                                                <th className="py-2.5 px-3 text-right text-emerald-800">Received Qty</th>
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 bg-white">
                                                        {bill.items.map((it, idx) => (
                                                            <tr key={it.id || idx} className="hover:bg-gray-50/70 transition-colors">
                                                                <td className="py-2 px-3 text-center text-gray-400 font-medium">{idx + 1}</td>
                                                                <td className="py-2 px-3 font-semibold text-gray-900">
                                                                    {it.item_name}
                                                                    {it.sub_category && (
                                                                        <span className="ml-2 text-[10px] text-gray-500 font-normal">({it.sub_category})</span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2 px-3 text-right font-medium text-gray-700">
                                                                    {it.quantity} {it.unit || 'Sheets'}
                                                                </td>
                                                                {isDelivered && (
                                                                    <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                                                        {it.delivered_quantity ?? it.quantity} {it.unit || 'Sheets'}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Delivery Summary & Proof info */}
                                            {isDelivered ? (
                                                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/70 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                                                    <div className="space-y-1">
                                                        {bill.delivered_at && (
                                                            <p className="text-gray-600">
                                                                <span className="font-semibold text-gray-800">Delivered On:</span>{' '}
                                                                {new Date(bill.delivered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        )}
                                                        {bill.delivery_notes &&
                                                            !bill.delivery_notes.startsWith('Marked as ordered') &&
                                                            !bill.delivery_notes.startsWith('Order placed') &&
                                                            !bill.delivery_notes.startsWith('BOQ Material') &&
                                                            !bill.delivery_notes.startsWith('Laminate Sheet') && (
                                                            <p className="text-gray-600">
                                                                <span className="font-semibold text-gray-800">Remarks:</span> {bill.delivery_notes.replace(/^\[Bill\s*#?\d+\s*\|\s*[^\]]+\]\s*/i, '').trim()}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {bill.delivery_challan_url && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewChallan({
                                                                url: bill.delivery_challan_url!,
                                                                title: `${bill.bill_number} - Delivery Challan`,
                                                                notes: bill.delivery_notes || undefined,
                                                                date: bill.delivered_at
                                                                    ? new Date(bill.delivered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                                    : undefined
                                                            })}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-2xs shrink-0 cursor-pointer"
                                                        >
                                                            <FiImage className="w-3.5 h-3.5" />
                                                            <span>View Challan Proof</span>
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                /* Site Engineer Action: Receive Bill */
                                                <div className="pt-2 flex items-center justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => openDeliveryModalForBill(bill)}
                                                        className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer text-xs sm:text-sm"
                                                    >
                                                        <FiCamera className="w-4 h-4" />
                                                        <span>Receive Bill Delivery</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            ) : currentSubTab === 'boq' ? (
                /* ======================== BOQ ITEMS VIEW ======================== */
                boqItems.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiPackage className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No BOQ items yet</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                            Add material items from the standard catalogue or enter your own custom items to prepare your site delivery sheet.
                        </p>
                        {canCreate && (
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
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Bulk selection action bar */}
                        {selectedBoqIds.size > 0 && (
                            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs sm:text-sm text-amber-900 shadow-xs animate-fadeIn">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{selectedBoqIds.size}</span>
                                    <span>of {boqItems.length} items selected</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const selectedItems = boqItems.filter(it => selectedBoqIds.has(it.id));
                                            openDeliveryModalForItems(selectedItems);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                    >
                                        <FiTruck className="w-3.5 h-3.5" />
                                        <span>Confirm Delivery ({selectedBoqIds.size})</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleBulkMarkOrdered(Array.from(selectedBoqIds))}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                    >
                                        <FiCheck className="w-3.5 h-3.5" />
                                        <span>Mark Ordered</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExportSelectedBoqIds(new Set(selectedBoqIds));
                                            setExportSupplierFilter('all');
                                            setShowExportModal(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f0b100] hover:bg-[#d49b00] text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                    >
                                        <FiDownload className="w-3.5 h-3.5" />
                                        <span>Export Selected ({selectedBoqIds.size})</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedBoqIds(new Set())}
                                        className="text-xs text-gray-500 hover:text-gray-800 underline font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/75 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-600 font-semibold">
                                            <th className="py-3.5 px-3 w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filteredBoqItems.length > 0 && selectedBoqIds.size === filteredBoqItems.length}
                                                    onChange={toggleSelectAllBoq}
                                                    title="Select All"
                                                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                                                />
                                            </th>
                                            <th className="py-3.5 px-2 w-12 text-center">#</th>
                                            <th className="py-3.5 px-4">Particular (Item)</th>
                                            <th className="py-3.5 px-4 w-44 text-right">Quantity</th>
                                            <th className="py-3.5 px-4 w-48 text-left">Delivery Status</th>
                                            {(canEdit || canDelete) && <th className="py-3.5 px-4 w-24 text-center">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {filteredBoqItems.map((item, index) => {
                                            const isSelected = selectedBoqIds.has(item.id);
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={`transition-colors ${isSelected ? 'bg-amber-50/70 hover:bg-amber-100/60' : 'hover:bg-amber-50/40'}`}
                                                >
                                                    <td className="py-3.5 px-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectBoq(item.id)}
                                                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="py-3.5 px-2 text-center text-gray-400 font-medium">
                                                        {index + 1}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-gray-900">{item.item_name}</span>
                                                            {item.sub_category && (
                                                                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                                                                    {item.sub_category}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                                                        <span>{item.quantity}</span>
                                                        <span className="ml-1.5 text-xs font-normal text-gray-500">{item.unit}</span>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {renderDeliveryStatusBadge(item)}
                                                    </td>
                                                    {(canEdit || canDelete) && (
                                                        <td className="py-3.5 px-4 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={() => handleEditItem(item)}
                                                                        title="Edit Item"
                                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                    >
                                                                        <FiEdit2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button
                                                                        onClick={() => handleDeleteItem(item.id)}
                                                                        title="Delete Item"
                                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    >
                                                                        <FiTrash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {filteredBoqItems.map((item, index) => {
                                    const isSelected = selectedBoqIds.has(item.id);
                                    return (
                                        <div key={item.id} className={`p-4 space-y-2 ${isSelected ? 'bg-amber-50/60' : ''}`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectBoq(item.id)}
                                                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[11px] flex items-center justify-center font-bold">
                                                        {index + 1}
                                                    </span>
                                                    <span className="font-semibold text-gray-900">{item.item_name}</span>
                                                </div>
                                                {(canEdit || canDelete) && (
                                                    <div className="flex items-center gap-1">
                                                        {canEdit && (
                                                            <button
                                                                onClick={() => handleEditItem(item)}
                                                                className="p-1.5 text-gray-500 hover:text-amber-600 rounded"
                                                            >
                                                                <FiEdit2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                                                            >
                                                                <FiTrash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {item.sub_category && (
                                                <div className="ml-6">
                                                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                                                        {item.sub_category}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50">
                                                <span className="text-gray-500 font-medium">Quantity:</span>
                                                <span className="font-bold text-gray-900 text-sm">
                                                    {item.quantity} {item.unit}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50">
                                                <span className="text-gray-500 font-medium">Delivery:</span>
                                                {renderDeliveryStatusBadge(item)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )
            ) : (
                /* ======================== LAMINATE VIEW ======================== */
                laminateItems.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiLayers className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No Laminate sheets yet</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                            Add laminate sheet requirements for wardrobes, kitchen shutters, TV units, and internal liner.
                        </p>
                        {canCreate && (
                            <button
                                onClick={() => {
                                    setEditingLaminate(null);
                                    setLaminateCode('');
                                    setLaminateCompany('Royal Touch');
                                    setLaminateQuantity(1);
                                    setShowLaminateModal(true);
                                }}
                                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#f0b100] hover:bg-[#d49b00] text-white font-medium rounded-lg text-sm shadow-sm transition-colors"
                            >
                                <FiPlus className="w-4 h-4" />
                                <span>Add First Laminate</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Bulk selection action bar */}
                        {selectedLaminateIds.size > 0 && (
                            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs sm:text-sm text-amber-900 shadow-xs animate-fadeIn">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{selectedLaminateIds.size}</span>
                                    <span>of {laminateItems.length} laminate sheets selected</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const selectedItems = laminateItems.filter(it => selectedLaminateIds.has(it.id));
                                            openDeliveryModalForItems(selectedItems);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                    >
                                        <FiTruck className="w-3.5 h-3.5" />
                                        <span>Confirm Delivery ({selectedLaminateIds.size})</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleBulkMarkOrdered(Array.from(selectedLaminateIds))}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                    >
                                        <FiCheck className="w-3.5 h-3.5" />
                                        <span>Mark Ordered</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExportSelectedLaminateIds(new Set(selectedLaminateIds));
                                            setExportCompanyFilter('all');
                                            setShowExportLaminateModal(true);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f0b100] hover:bg-[#d49b00] text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                                    >
                                        <FiDownload className="w-3.5 h-3.5" />
                                        <span>Export Selected ({selectedLaminateIds.size})</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedLaminateIds(new Set())}
                                        className="text-xs text-gray-500 hover:text-gray-800 underline font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/75 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-600 font-semibold">
                                            <th className="py-3.5 px-3 w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filteredLaminateItems.length > 0 && selectedLaminateIds.size === filteredLaminateItems.length}
                                                    onChange={toggleSelectAllLaminate}
                                                    title="Select All"
                                                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                                                />
                                            </th>
                                            <th className="py-3.5 px-2 w-12 text-center">#</th>
                                            <th className="py-3.5 px-4">Laminate Code</th>
                                            <th className="py-3.5 px-4">Company</th>
                                            <th className="py-3.5 px-4 w-36 text-right">Quantity</th>
                                            <th className="py-3.5 px-4 w-48 text-left">Delivery Status</th>
                                            {(canEdit || canDelete) && <th className="py-3.5 px-4 w-24 text-center">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm">
                                        {filteredLaminateItems.map((item, index) => {
                                            const isSelected = selectedLaminateIds.has(item.id);
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={`transition-colors ${isSelected ? 'bg-amber-50/70 hover:bg-amber-100/60' : 'hover:bg-amber-50/40'}`}
                                                >
                                                    <td className="py-3.5 px-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectLaminate(item.id)}
                                                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="py-3.5 px-2 text-center text-gray-400 font-medium">
                                                        {index + 1}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                                                        {item.item_name}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-gray-700">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                            {item.sub_category || item.material_company || 'Standard'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                                                        <span>{item.quantity}</span>
                                                        <span className="ml-1.5 text-xs font-normal text-gray-500">{item.unit || 'Sheets'}</span>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        {renderDeliveryStatusBadge(item)}
                                                    </td>
                                                    {(canEdit || canDelete) && (
                                                        <td className="py-3.5 px-4 text-center">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={() => handleEditLaminate(item)}
                                                                        title="Edit Laminate"
                                                                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                    >
                                                                        <FiEdit2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button
                                                                        onClick={() => handleDeleteItem(item.id)}
                                                                        title="Delete Laminate"
                                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    >
                                                                        <FiTrash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {filteredLaminateItems.map((item, index) => {
                                    const isSelected = selectedLaminateIds.has(item.id);
                                    return (
                                        <div key={item.id} className={`p-4 space-y-2 ${isSelected ? 'bg-amber-50/60' : ''}`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectLaminate(item.id)}
                                                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] flex items-center justify-center font-bold">
                                                        {index + 1}
                                                    </span>
                                                    <span className="font-semibold text-gray-900">{item.item_name}</span>
                                                </div>
                                                {(canEdit || canDelete) && (
                                                    <div className="flex items-center gap-1">
                                                        {canEdit && (
                                                            <button
                                                                onClick={() => handleEditLaminate(item)}
                                                                className="p-1.5 text-gray-500 hover:text-amber-600 rounded"
                                                            >
                                                                <FiEdit2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                                                            >
                                                                <FiTrash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs ml-6">
                                                <span className="text-gray-500">Company:</span>
                                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                                                    {item.sub_category || item.material_company || 'Standard'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50">
                                                <span className="text-gray-500 font-medium">Quantity:</span>
                                                <span className="font-bold text-gray-900 text-sm">
                                                    {item.quantity} {item.unit || 'Sheets'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50">
                                                <span className="text-gray-500 font-medium">Delivery:</span>
                                                {renderDeliveryStatusBadge(item)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )
            )}

            {/* ========================================================================= */}
            {/* ADD / EDIT BOQ ITEM MODAL */}
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
                            {/* Particular (Item) */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                        Particular (Item) <span className="text-red-500">*</span>
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

                            {/* Supplier / Category (Optional - for grouping & dividing items) */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                    Supplier / Category <span className="text-gray-400 font-normal lowercase">(optional - for grouping & dividing)</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Hardware Supplier, Plywood Depot, Asian Paints..."
                                    value={itemSupplier}
                                    onChange={e => setItemSupplier(e.target.value)}
                                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                />
                                {availableSuppliers.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {availableSuppliers.slice(0, 5).map(sup => (
                                            <button
                                                key={sup}
                                                type="button"
                                                onClick={() => setItemSupplier(sup)}
                                                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                                    itemSupplier === sup
                                                        ? 'bg-amber-100 border-amber-300 text-amber-800 font-semibold'
                                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {sup}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quantity and Unit */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                                    Quantity & Unit <span className="text-red-500">*</span>
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
                                    className="px-5 py-2 text-sm font-semibold bg-[#f0b100] hover:bg-[#d49b00] text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* ADD / EDIT LAMINATE MODAL */}
            {/* ========================================================================= */}
            {showLaminateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-amber-50/40">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-[#f0b100] text-white rounded-lg">
                                    <FiLayers className="w-4 h-4" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    {editingLaminate ? 'Edit Laminate Sheet' : 'Add Laminate Sheet'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowLaminateModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveLaminate} className="p-6 space-y-4">
                            {/* Laminate Code */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                    Laminate Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 1024 SF, 217 SF, 1.0mm Matt..."
                                    value={laminateCode}
                                    onChange={e => setLaminateCode(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium"
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {LAMINATE_CODE_SUGGESTIONS.map(sugg => (
                                        <button
                                            key={sugg}
                                            type="button"
                                            onClick={() => setLaminateCode(sugg)}
                                            className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                                                laminateCode === sugg
                                                    ? 'bg-amber-100 border-amber-300 text-amber-800 font-semibold'
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                            }`}
                                        >
                                            {sugg}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Company */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                    Company <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Royal Touch, Merino, Greenlam, Century..."
                                    value={laminateCompany}
                                    onChange={e => setLaminateCompany(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium"
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {LAMINATE_COMPANIES.map(comp => (
                                        <button
                                            key={comp}
                                            type="button"
                                            onClick={() => setLaminateCompany(comp)}
                                            className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-colors ${
                                                laminateCompany === comp
                                                    ? 'bg-[#f0b100] text-white border-[#f0b100] shadow-sm'
                                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            {comp}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Quantity */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                    Quantity (Sheets) <span className="text-red-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.1"
                                        placeholder="Number of sheets"
                                        value={laminateQuantity}
                                        onChange={e => setLaminateQuantity(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-bold text-gray-900"
                                    />
                                    <span className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold border border-gray-200">
                                        Sheets
                                    </span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowLaminateModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 text-sm font-semibold bg-[#f0b100] hover:bg-[#d49b00] text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingLaminate ? 'Update Laminate' : 'Add Laminate'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* EXPORT BOQ TO PDF MODAL */}
            {/* ========================================================================= */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
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

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Assigned Site Engineer Name */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                        <FiUser className="w-3.5 h-3.5 text-gray-400" />
                                        <span>Site Engineer</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={exportEngineerName}
                                        onChange={e => setExportEngineerName(e.target.value)}
                                        placeholder="Site Engineer Name"
                                        className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium text-gray-900"
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
                                        className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium text-gray-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Delivery Floor */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase mb-1">
                                        <FiLayers className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Material Delivery Floor</span> <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Ground Floor, 5th Floor, Terrace..."
                                        value={exportDeliveryFloor}
                                        onChange={e => setExportDeliveryFloor(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-gray-900"
                                    />
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <span className="text-[11px] text-gray-400 font-medium mr-0.5">Quick pick:</span>
                                        {DELIVERY_FLOORS.map(floor => (
                                            <button
                                                key={floor}
                                                type="button"
                                                onClick={() => setExportDeliveryFloor(floor)}
                                                className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                                                    exportDeliveryFloor.toLowerCase().trim() === floor.toLowerCase().trim()
                                                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold shadow-xs'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {floor}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Requirement / Order Date */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                        <FiCalendar className="w-3.5 h-3.5 text-gray-400" />
                                        <span>Requirement Date</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={exportDate}
                                        onChange={e => setExportDate(e.target.value)}
                                        className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-gray-900"
                                    />
                                    <p className="mt-2 text-[11px] text-gray-400">
                                        Printed on top header, details card and sign-off
                                    </p>
                                </div>
                            </div>

                            {/* Items Included for Export */}
                            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 bg-amber-500 text-white rounded-md">
                                            <FiPackage className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-900 uppercase">Items to Export</span>
                                    </div>
                                    <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-full">
                                        {exportSelectedBoqIds.size === boqItems.length
                                            ? `All ${boqItems.length} Items Included`
                                            : `${exportSelectedBoqIds.size} of ${boqItems.length} Items Selected`}
                                    </span>
                                </div>

                                {exportSelectedBoqIds.size < boqItems.length ? (
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 pt-1">
                                        {boqItems.filter(it => exportSelectedBoqIds.has(it.id)).map(item => (
                                            <span
                                                key={item.id}
                                                className="inline-flex items-center gap-1.5 text-xs bg-white text-gray-800 px-2.5 py-1 rounded-lg border border-amber-200 font-medium shadow-2xs"
                                            >
                                                <span>{item.item_name}</span>
                                                <span className="text-amber-800 font-bold">({item.quantity} {item.unit})</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-600">
                                        All items in the current BOQ will be exported to the material requirement PDF.
                                    </p>
                                )}
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={exportMarkOrdered}
                                        onChange={e => setExportMarkOrdered(e.target.checked)}
                                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                                    />
                                    <span>Automatically mark exported items as &quot;Ordered&quot;</span>
                                </label>
                            </div>
                        </div>

                        {/* Sticky Action Footer */}
                        <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200/70 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={exportSelectedBoqIds.size === 0}
                                onClick={handleDownloadPdf}
                                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-[#f0b100] hover:bg-[#d49b00] text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                            >
                                <FiDownload className="w-4 h-4" />
                                <span>Download PDF ({exportSelectedBoqIds.size})</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* EXPORT LAMINATE TO PDF MODAL */}
            {/* ========================================================================= */}
            {showExportLaminateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-amber-50/40 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#f0b100] text-white rounded-lg">
                                    <FiDownload className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Export Laminate Requirement PDF</h3>
                                    <p className="text-xs text-gray-500">Official sheet for laminate sheets delivery & approvals</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowExportLaminateModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Assigned Site Engineer Name */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                        <FiUser className="w-3.5 h-3.5 text-gray-400" />
                                        <span>Site Engineer</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={exportEngineerName}
                                        onChange={e => setExportEngineerName(e.target.value)}
                                        placeholder="Site Engineer Name"
                                        className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium text-gray-900"
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
                                        className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-medium text-gray-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Delivery Floor */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase mb-1">
                                        <FiLayers className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Material Delivery Floor</span> <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Ground Floor, 5th Floor, Terrace..."
                                        value={exportDeliveryFloor}
                                        onChange={e => setExportDeliveryFloor(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-gray-900"
                                    />
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <span className="text-[11px] text-gray-400 font-medium mr-0.5">Quick pick:</span>
                                        {DELIVERY_FLOORS.map(floor => (
                                            <button
                                                key={floor}
                                                type="button"
                                                onClick={() => setExportDeliveryFloor(floor)}
                                                className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                                                    exportDeliveryFloor.toLowerCase().trim() === floor.toLowerCase().trim()
                                                        ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold shadow-xs'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {floor}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Requirement / Order Date */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                        <FiCalendar className="w-3.5 h-3.5 text-gray-400" />
                                        <span>Requirement Date</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={exportDate}
                                        onChange={e => setExportDate(e.target.value)}
                                        className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-gray-900"
                                    />
                                    <p className="mt-2 text-[11px] text-gray-400">
                                        Printed on top header, details card and sign-off
                                    </p>
                                </div>
                            </div>

                            {/* Laminate Items Included for Export */}
                            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 bg-[#f0b100] text-white rounded-md">
                                            <FiLayers className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-900 uppercase">Laminate Sheets to Export</span>
                                    </div>
                                    <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-full">
                                        {exportSelectedLaminateIds.size === laminateItems.length
                                            ? `All ${laminateItems.length} Sheets Included`
                                            : `${exportSelectedLaminateIds.size} of ${laminateItems.length} Sheets Selected`}
                                    </span>
                                </div>

                                {exportSelectedLaminateIds.size < laminateItems.length ? (
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 pt-1">
                                        {laminateItems.filter(it => exportSelectedLaminateIds.has(it.id)).map(item => (
                                            <span
                                                key={item.id}
                                                className="inline-flex items-center gap-1.5 text-xs bg-white text-gray-800 px-2.5 py-1 rounded-lg border border-amber-200 font-medium shadow-2xs"
                                            >
                                                <span>{item.item_name}</span>
                                                <span className="text-amber-800 font-bold">({item.quantity} {item.unit || 'Sheets'})</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-600">
                                        All laminate sheets in this project will be exported to the requirement PDF.
                                    </p>
                                )}
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={exportMarkOrdered}
                                        onChange={e => setExportMarkOrdered(e.target.checked)}
                                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
                                    />
                                    <span>Automatically mark exported items as &quot;Ordered&quot;</span>
                                </label>
                            </div>
                        </div>

                        {/* Sticky Action Footer */}
                        <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowExportLaminateModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200/70 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={exportSelectedLaminateIds.size === 0}
                                onClick={handleDownloadLaminatePdf}
                                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-[#f0b100] hover:bg-[#d49b00] text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                            >
                                <FiDownload className="w-4 h-4" />
                                <span>Download Laminate PDF ({exportSelectedLaminateIds.size})</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* CONFIRM MATERIAL DELIVERY MODAL */}
            {/* ========================================================================= */}
            {showDeliveryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-50/50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-600 text-white rounded-lg">
                                    <FiTruck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Confirm Material Delivery</h3>
                                    <p className="text-xs text-gray-500">Record received materials and notify the Admin</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDeliveryModal(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleConfirmDeliverySubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 space-y-4 overflow-y-auto flex-1">
                                {/* Items Verification */}
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                                        Delivered Items & Quantities ({deliveryTargetItems.length})
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {deliveryTargetItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                                            >
                                                <div className="flex-1 min-w-0 pr-3">
                                                    <p className="font-semibold text-gray-900 truncate">{item.item_name}</p>
                                                    <p className="text-[11px] text-gray-500">
                                                        Ordered / Required: {item.quantity} {item.unit || 'Units'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span className="text-[11px] text-gray-500 font-medium">Received:</span>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min="0"
                                                        value={deliveryQuantities[item.id] ?? item.quantity}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setDeliveryQuantities(prev => ({ ...prev, [item.id]: val }));
                                                        }}
                                                        className="w-20 px-2 py-1 bg-white border border-gray-300 rounded font-bold text-gray-900 text-right outline-none focus:ring-1 focus:ring-emerald-500"
                                                    />
                                                    <span className="text-gray-600 font-medium w-12 truncate">{item.unit || 'Units'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Delivery Date */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                        <FiCalendar className="w-3.5 h-3.5 text-gray-400" />
                                        <span>Delivery Date</span> <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={deliveryDate}
                                        onChange={e => setDeliveryDate(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-gray-900"
                                    />
                                </div>

                                {/* Delivery Challan Photo Upload */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                        <FiCamera className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Delivery Challan / Material Photo</span>
                                        <span className="text-gray-400 font-normal lowercase">(proof for Admin)</span>
                                    </label>
                                    
                                    {deliveryPhotoPreview ? (
                                        <div className="relative rounded-xl border border-emerald-200 bg-emerald-50/50 p-2 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={deliveryPhotoPreview}
                                                    alt="Challan preview"
                                                    className="w-14 h-14 object-cover rounded-lg border border-emerald-200"
                                                />
                                                <div className="text-xs">
                                                    <p className="font-semibold text-emerald-950 truncate max-w-xs">
                                                        {deliveryPhotoFile?.name || 'Challan Photo'}
                                                    </p>
                                                    <p className="text-[11px] text-emerald-700">Ready to upload</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDeliveryPhotoFile(null);
                                                    setDeliveryPhotoPreview(null);
                                                }}
                                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remove photo"
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/30 cursor-pointer transition-colors">
                                            <FiCamera className="w-6 h-6 text-gray-400 mb-1" />
                                            <span className="text-xs font-semibold text-emerald-800">
                                                Take photo or upload delivery challan copy
                                            </span>
                                            <span className="text-[11px] text-gray-400 mt-0.5">JPEG, PNG, HEIC from camera or gallery</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={handlePhotoChange}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                </div>

                                {/* Delivery Notes / Remarks */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-1">
                                        <FiFileText className="w-3.5 h-3.5 text-gray-400" />
                                        <span>Remarks / Challan Number</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Challan #1042, All sheets checked in good condition..."
                                        value={deliveryNotes}
                                        onChange={e => setDeliveryNotes(e.target.value)}
                                        className="w-full px-3.5 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-900"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowDeliveryModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200/70 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingDelivery}
                                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                                >
                                    {submittingDelivery ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FiCheck className="w-4 h-4" />
                                            <span>Confirm & Notify Admin</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* CHALLAN / DELIVERY PROOF LIGHTBOX MODAL */}
            {/* ========================================================================= */}
            {previewChallan && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
                    onClick={() => setPreviewChallan(null)}
                >
                    <div
                        className="bg-gray-900 text-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] border border-gray-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 shrink-0">
                            <div>
                                <h4 className="font-bold text-sm text-gray-100">{previewChallan.title}</h4>
                                {previewChallan.date && (
                                    <p className="text-[11px] text-gray-400">Delivered on: {previewChallan.date}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={previewChallan.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download
                                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                                    title="Open Full Image / Download"
                                >
                                    <FiDownload className="w-4 h-4" />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setPreviewChallan(null)}
                                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/50">
                            <img
                                src={previewChallan.url}
                                alt="Delivery Challan"
                                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                            />
                        </div>

                        {previewChallan.notes && (
                            <div className="px-5 py-2.5 bg-gray-800/80 border-t border-gray-800 text-xs text-gray-300">
                                <span className="font-semibold text-amber-400 mr-1.5">Remarks:</span>
                                {previewChallan.notes}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

BOQTab.displayName = 'BOQTab';
