import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiSave, FiUpload, FiFile, FiAlertCircle, FiCheck, FiTrash2, FiUser, FiPhone, FiBriefcase, FiPlus } from 'react-icons/fi';
import { CustomDropdown, CustomDatePicker } from '@/components/ui/CustomControls';
import { supabase } from '@/lib/supabase';

const TRADES = [
    { id: 'carpenter', title: 'Carpenter', keywords: ['carpent', 'wood', 'plywood'] },
    { id: 'electrician', title: 'Electrician', keywords: ['electr'] },
    { id: 'plumber', title: 'Plumber', keywords: ['plumb', 'sanitary'] },
    { id: 'painter', title: 'Painter', keywords: ['paint', 'polish'] },
    { id: 'granite_worker', title: 'Granite & Marble', keywords: ['granite', 'marble', 'tile', 'civil', 'mason'] },
    { id: 'glass_worker', title: 'Glass & Aluminum', keywords: ['glass', 'aluminum', 'aluminium', 'fabricat'] }
];

type ModalSection = 'info' | 'customer' | 'property' | 'workers' | null;

interface EditProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    section: ModalSection;
    initialData: any;
    isSaving: boolean;
    initialWorker?: string;
}

const formatProjectCode = (project: any): string => {
    if (!project) return '-';
    if (project.project_code) return project.project_code;
    if (project.ref_no) return project.ref_no;

    const dateStr = project.created_at || project.start_date;
    const dateObj = dateStr ? new Date(dateStr) : new Date();
    const yearShort = !isNaN(dateObj.getTime()) ? dateObj.getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);

    // ponytail: Fallback for unassigned project codes without random hashing
    return `AI/${yearShort}/01`;
};

export function EditProjectModal({ isOpen, onClose, onSave, section, initialData, isSaving, initialWorker }: EditProjectModalProps) {
    const [formData, setFormData] = useState<any>({});
    const [selectedWorker, setSelectedWorker] = useState<string>('carpenter');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [uploadingPDF, setUploadingPDF] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [registeredVendors, setRegisteredVendors] = useState<any[]>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [saveToDirectory, setSaveToDirectory] = useState<Record<string, boolean>>({});
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && section === 'workers') {
            setLoadingVendors(true);
            Promise.all([
                fetch('/api/suppliers?active=true').then(r => r.ok ? r.json() : { suppliers: [] }).catch(() => ({ suppliers: [] })),
                fetch('/api/contract-workers?active=true').then(r => r.ok ? r.json() : { workers: [] }).catch(() => ({ workers: [] }))
            ]).then(([suppliersData, workersData]) => {
                const sups = (suppliersData.suppliers || []).map((s: any) => ({
                    id: `sup_${s.id}`,
                    name: s.name,
                    contact_name: s.contact_name,
                    phone: s.contact_phone || '',
                    trade: s.trade_category || 'Vendor',
                    source: 'Vendor'
                }));
                const cws = (workersData.workers || []).map((w: any) => ({
                    id: `cw_${w.id}`,
                    name: w.full_name,
                    contact_name: null,
                    phone: w.phone || '',
                    trade: w.trade || 'Worker',
                    source: 'Contract Worker'
                }));
                setRegisteredVendors([...sups, ...cws]);
            }).finally(() => {
                setLoadingVendors(false);
            });
        }
    }, [isOpen, section]);

    useEffect(() => {
        if (isOpen && initialWorker) {
            setSelectedWorker(initialWorker);
        }
    }, [isOpen, initialWorker]);

    useEffect(() => {
        if (isOpen && initialData) {
            setFormData(initialData);
            setPdfFile(null);
            setLocalError(null);
        }
    }, [isOpen, initialData]);



    const overlayRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setLocalError('Please upload a PDF or image file (JPG, PNG, or WebP)');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            setLocalError('File size must be less than 10MB');
            return;
        }

        setPdfFile(file);
        setLocalError(null);
    };

    useEffect(() => {
        if (!isOpen) return;

        // Style Guard: Lock both html and body
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.overscrollBehaviorY = 'none';
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehaviorY = 'none';

        const handleTouchMove = (e: TouchEvent) => {
            const touchY = e.touches[0].clientY;
            const scrollEl = overlayRef.current?.querySelector('form');

            if (scrollEl) {
                const touchDiff = touchY - (window as any)._modalTouchStartY || 0;
                if (scrollEl.scrollTop <= 0 && touchDiff > 0) {
                    if (e.cancelable) e.preventDefault();
                }
            } else {
                if (e.cancelable) e.preventDefault();
            }
            e.stopPropagation();
        };

        const handleTouchStart = (e: TouchEvent) => {
            (window as any)._modalTouchStartY = e.touches[0].clientY;
            e.stopPropagation();
        };

        const overlay = overlayRef.current;
        if (overlay) {
            overlay.addEventListener('touchstart', handleTouchStart, { passive: true });
            overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
        }

        return () => {
            document.documentElement.style.overflow = '';
            document.documentElement.style.overscrollBehaviorY = '';
            document.body.style.overflow = '';
            document.body.style.overscrollBehaviorY = '';
            if (overlay) {
                overlay.removeEventListener('touchstart', handleTouchStart);
                overlay.removeEventListener('touchmove', handleTouchMove);
            }
        };
    }, [isOpen]);

    if (!isOpen || !section) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        let finalData = { ...formData };

        if (pdfFile) {
            try {
                setUploadingPDF(true);
                const fileExt = pdfFile.name.split('.').pop();
                const fileName = `requirements-${Date.now()}.${fileExt}`;
                const filePath = `requirements/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('project-requirements')
                    .upload(filePath, pdfFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('project-requirements')
                    .getPublicUrl(filePath);

                finalData.requirements_pdf_url = publicUrl;
            } catch (err: any) {
                console.error('PDF upload error:', err);
                setLocalError('Failed to upload document: ' + err.message);
                setUploadingPDF(false);
                return;
            } finally {
                setUploadingPDF(false);
            }
        }

        if (section === 'workers') {
            const tradesToRegister = TRADES.filter(t => 
                saveToDirectory[t.id] && formData[`${t.id}_name`]?.trim()
            );
            if (tradesToRegister.length > 0) {
                await Promise.all(tradesToRegister.map(t => 
                    fetch('/api/suppliers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: formData[`${t.id}_name`].trim(),
                            contact_phone: formData[`${t.id}_phone`]?.trim() || null,
                            trade_category: t.title,
                            vendor_type: 'Contractor',
                            is_active: true
                        })
                    }).catch(e => console.warn('Could not auto-register vendor:', e))
                ));
            }
        }

        onSave(finalData);
    };

    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const getTitle = () => {
        switch (section) {
            case 'info': return 'Edit Project Information';
            case 'customer': return 'Edit Customer Details';
            case 'property': return 'Edit Property Details';
            case 'workers': return 'Edit Vendor Details';
            default: return 'Edit Project';
        }
    };

    return createPortal(
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center"
            data-modal="true"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h3 className="text-lg font-semibold text-gray-900">{getTitle()}</h3>
                    <button onClick={onClose} className="btn-ghost rounded-full">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6" style={{ overscrollBehavior: 'none' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        {/* Project Info Fields */}
                        {section === 'info' && (
                            <>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formatProjectCode(formData)}
                                        title={`Full UUID: ${formData.id || ''}`}
                                        className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-xs font-mono text-gray-600 cursor-not-allowed select-all"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                                    <input
                                        type="text"
                                        value={formData.title || ''}
                                        onChange={(e) => handleChange('title', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                                        placeholder="Enter project title"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <CustomDropdown
                                        value={formData.status || 'pending'}
                                        onChange={(val) => handleChange('status', val)}
                                        options={[
                                            { id: 'pending', title: 'Design Phase' },
                                            { id: 'in_progress', title: 'Execution Phase' },
                                            { id: 'handover', title: 'Handover Phase' },
                                            { id: 'on_hold', title: 'On Hold' },
                                            { id: 'completed', title: 'Completed' }
                                        ]}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                    <CustomDatePicker
                                        value={formData.start_date ? formData.start_date.split('T')[0] : ''}
                                        onChange={(val) => handleChange('start_date', val)}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Completion</label>
                                    <CustomDatePicker
                                        value={formData.estimated_completion_date ? formData.estimated_completion_date.split('T')[0] : ''}
                                        onChange={(val) => handleChange('estimated_completion_date', val)}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Budget (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.project_budget || ''}
                                        onChange={(e) => handleChange('project_budget', e.target.value === '' ? null : parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                                {formData.status === 'completed' && (
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Actual Completion Date</label>
                                        <CustomDatePicker
                                            value={formData.actual_completion_date ? formData.actual_completion_date.split('T')[0] : ''}
                                            onChange={(val) => handleChange('actual_completion_date', val)}
                                        />
                                    </div>
                                )}
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Notes</label>
                                    <textarea
                                        value={formData.project_notes || ''}
                                        onChange={(e) => handleChange('project_notes', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm font-light text-gray-600"
                                    />
                                </div>
                                <div className="sm:col-span-2 pt-2">
                                    <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <FiFile className="text-yellow-600" />
                                        Requirements Document
                                    </label>
                                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 bg-gray-50/50 hover:bg-gray-50 hover:border-yellow-300/50 transition-all group">
                                        <div className="flex flex-col items-center text-center">
                                            {pdfFile ? (
                                                <div className="flex items-center gap-3 text-sm text-green-600 font-medium bg-green-50 px-4 py-2 rounded-lg border border-green-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                    <FiFile className="w-5 h-5" />
                                                    <span className="truncate max-w-[200px]">{pdfFile.name}</span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setPdfFile(null)}
                                                        className="p-1 hover:bg-green-100 rounded-full transition-colors"
                                                    >
                                                        <FiX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                                        <FiUpload className="w-6 h-6 text-gray-400 group-hover:text-yellow-600 transition-colors" />
                                                    </div>
                                                    {formData.requirements_pdf_url ? (
                                                        <div className="space-y-2">
                                                            <p className="text-sm text-gray-600">Document is already uploaded.</p>
                                                            <button 
                                                                type="button"
                                                                onClick={() => fileInputRef.current?.click()}
                                                                className="text-sm font-semibold text-yellow-600 hover:text-yellow-700 underline underline-offset-4"
                                                            >
                                                                Change Document
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-medium text-gray-700">Click to upload requirements</p>
                                                            <p className="text-xs text-gray-500">PDF, JPG, PNG or WebP (max 10MB)</p>
                                                            <button 
                                                                type="button"
                                                                onClick={() => fileInputRef.current?.click()}
                                                                className="mt-3 inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-yellow-400 transition-all shadow-sm"
                                                            >
                                                                Select File
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <input 
                                            ref={fileInputRef}
                                            type="file" 
                                            className="hidden" 
                                            accept=".pdf,image/*"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                    {localError && (
                                        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                                            <FiAlertCircle className="w-4 h-4" />
                                            {localError}
                                        </div>
                                    )}
                                    {uploadingPDF && (
                                        <div className="mt-3 flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                            <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs font-semibold text-yellow-800 animate-pulse">Uploading document to secure storage...</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Customer Details Fields */}
                        {section === 'customer' && (
                            <>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                                    <input
                                        type="text"
                                        value={formData.customer_name || ''}
                                        onChange={(e) => handleChange('customer_name', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <input
                                        type="text"
                                        value={formData.phone_number || ''}
                                        onChange={(e) => handleChange('phone_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Phone</label>
                                    <input
                                        type="text"
                                        value={formData.alt_phone_number || ''}
                                        onChange={(e) => handleChange('alt_phone_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                    <textarea
                                        value={formData.address || ''}
                                        onChange={(e) => handleChange('address', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>

                            </>
                        )}

                        {/* Property Details Fields */}
                        {section === 'property' && (
                            <>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                                    <CustomDropdown
                                        value={formData.property_type || ''}
                                        onChange={(val) => handleChange('property_type', val)}
                                        options={[
                                            { id: 'apartment', title: 'Apartment' },
                                            { id: 'villa', title: 'Villa' },
                                            { id: 'office', title: 'Office' },
                                            { id: 'plot', title: 'Plot' }
                                        ]}
                                        placeholder="Select Type"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Apartment/Building Name</label>
                                    <input
                                        type="text"
                                        value={formData.apartment_name || ''}
                                        onChange={(e) => handleChange('apartment_name', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Block Number</label>
                                    <input
                                        type="text"
                                        value={formData.block_number || ''}
                                        onChange={(e) => handleChange('block_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Flat Number</label>
                                    <input
                                        type="text"
                                        value={formData.flat_number || ''}
                                        onChange={(e) => handleChange('flat_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Floor Number</label>
                                    <input
                                        type="text"
                                        value={formData.floor_number || ''}
                                        onChange={(e) => handleChange('floor_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Area (sq.ft)</label>
                                    <input
                                        type="number"
                                        value={formData.area_sqft || ''}
                                        onChange={(e) => handleChange('area_sqft', e.target.value === '' ? null : parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
                                </div>
                            </>
                        )}

                        {/* Workers / Vendor Selection Fields */}
                        {section === 'workers' && (
                            <div className="col-span-2 space-y-4">
                                {/* Trade Selection Tabs */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                        Select Trade
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {TRADES.map((t) => {
                                            const isAssigned = !!formData[`${t.id}_name`];
                                            const isSelected = selectedWorker === t.id;
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => setSelectedWorker(t.id)}
                                                    className={`px-3 py-2 rounded-lg border text-left transition-all flex items-center justify-between text-xs ${
                                                        isSelected
                                                            ? 'border-yellow-500 bg-yellow-50/70 text-gray-950 font-semibold ring-1 ring-yellow-400/50'
                                                            : isAssigned
                                                            ? 'border-gray-200 bg-gray-50 text-gray-800'
                                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span className="truncate">{t.title}</span>
                                                    {isAssigned && (
                                                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                                                            Assigned
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Active Trade Vendor Details Card */}
                                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50 space-y-3.5">
                                    <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900">
                                                {TRADES.find(t => t.id === selectedWorker)?.title || selectedWorker} Details
                                            </h4>
                                            <p className="text-xs text-gray-500">
                                                Pick an existing vendor, or type new vendor details below
                                            </p>
                                        </div>
                                        {formData[`${selectedWorker}_name`] && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleChange(`${selectedWorker}_name`, '');
                                                    handleChange(`${selectedWorker}_phone`, '');
                                                }}
                                                className="text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1 hover:underline"
                                            >
                                                <FiTrash2 className="w-3.5 h-3.5" />
                                                <span>Clear</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Registered Vendor Picker */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                                            <span>Registered Vendor</span>
                                            {loadingVendors && <span className="text-[10px] text-gray-400">Loading directory...</span>}
                                        </label>
                                        <select
                                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all shadow-xs"
                                            onChange={(e) => {
                                                const vId = e.target.value;
                                                if (!vId) return;
                                                if (vId === '__manual__') {
                                                    handleChange(`${selectedWorker}_name`, '');
                                                    handleChange(`${selectedWorker}_phone`, '');
                                                    setSaveToDirectory(prev => ({ ...prev, [selectedWorker]: true }));
                                                    setTimeout(() => nameInputRef.current?.focus(), 50);
                                                    e.target.value = '';
                                                    return;
                                                }
                                                const v = registeredVendors.find(item => item.id === vId);
                                                if (v) {
                                                    const displayName = v.contact_name && v.contact_name !== v.name
                                                        ? `${v.name} (${v.contact_name})`
                                                        : v.name;
                                                    handleChange(`${selectedWorker}_name`, displayName);
                                                    handleChange(`${selectedWorker}_phone`, v.phone || '');
                                                    setSaveToDirectory(prev => ({ ...prev, [selectedWorker]: false }));
                                                }
                                                e.target.value = '';
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>
                                                -- Choose from registered vendors ({registeredVendors.length} available) --
                                            </option>
                                            <option value="__manual__">
                                                + New Vendor (Enter details below)
                                            </option>
                                            {(() => {
                                                const currentTrade = TRADES.find(t => t.id === selectedWorker);
                                                const kws = currentTrade?.keywords || [];
                                                const matching = registeredVendors.filter(v => 
                                                    kws.some(kw => (v.trade || '').toLowerCase().includes(kw) || (v.name || '').toLowerCase().includes(kw))
                                                );
                                                const others = registeredVendors.filter(v => !matching.includes(v));

                                                return (
                                                    <>
                                                        {matching.length > 0 && (
                                                            <optgroup label={`Recommended for ${currentTrade?.title || 'this trade'}`}>
                                                                {matching.map(v => (
                                                                    <option key={v.id} value={v.id}>
                                                                        {v.name}{v.contact_name ? ` (${v.contact_name})` : ''} · {v.phone || 'No phone'} [{v.trade}]
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        )}
                                                        <optgroup label="All Registered Vendors & Workers">
                                                            {others.map(v => (
                                                                <option key={v.id} value={v.id}>
                                                                    {v.name}{v.contact_name ? ` (${v.contact_name})` : ''} · {v.phone || 'No phone'} [{v.trade}]
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    </>
                                                );
                                            })()}
                                        </select>
                                    </div>

                                    {/* Name and Phone inputs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Vendor / Contractor Name
                                            </label>
                                            <input
                                                ref={nameInputRef}
                                                type="text"
                                                value={formData[`${selectedWorker}_name`] || ''}
                                                onChange={(e) => handleChange(`${selectedWorker}_name`, e.target.value)}
                                                placeholder="Enter name or company"
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-xs font-medium text-gray-900"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Contact Phone Number
                                            </label>
                                            <input
                                                type="tel"
                                                value={formData[`${selectedWorker}_phone`] || ''}
                                                onChange={(e) => handleChange(`${selectedWorker}_phone`, e.target.value)}
                                                placeholder="e.g. 9876543210"
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-xs font-medium text-gray-900"
                                            />
                                        </div>
                                    </div>

                                    {/* Save to Directory Checkbox */}
                                    <div className="pt-1">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                id={`save_vendor_${selectedWorker}`}
                                                checked={!!saveToDirectory[selectedWorker]}
                                                onChange={(e) => setSaveToDirectory(prev => ({ ...prev, [selectedWorker]: e.target.checked }))}
                                                className="w-3.5 h-3.5 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
                                            />
                                            <span className="text-xs text-gray-700">
                                                Save this vendor to directory for future projects
                                            </span>
                                        </label>
                                        {saveToDirectory[selectedWorker] && (
                                            <p className="text-[11px] text-emerald-600 pl-5.5 mt-0.5">
                                                Will be saved under {TRADES.find(t => t.id === selectedWorker)?.title || 'this trade'}.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
                                        <span>Select trades above to configure multiple assignments before saving.</span>
                                        <span className="font-medium text-gray-700">
                                            {TRADES.filter(t => !!formData[`${t.id}_name`]).length} of {TRADES.length} assigned
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <FiSave className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
