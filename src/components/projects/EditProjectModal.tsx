import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiSave } from 'react-icons/fi';
import { CustomDropdown, CustomDatePicker } from '@/components/ui/CustomControls';

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

export function EditProjectModal({ isOpen, onClose, onSave, section, initialData, isSaving, initialWorker }: EditProjectModalProps) {
    const [formData, setFormData] = useState<any>({});
    const [selectedWorker, setSelectedWorker] = useState<string>('carpenter');

    useEffect(() => {
        if (isOpen && initialWorker) {
            setSelectedWorker(initialWorker);
        }
    }, [isOpen, initialWorker]);

    useEffect(() => {
        if (isOpen && initialData) {
            setFormData(initialData);
        }
    }, [isOpen, initialData]);

    const overlayRef = useRef<HTMLDivElement>(null);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
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
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                    />
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

                        {/* Workers Fields */}
                        {section === 'workers' && (
                            <div className="col-span-2 space-y-6">
                                <div className="grid grid-cols-1 gap-4 p-4 border border-gray-100 rounded-lg bg-gray-50/50">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                                        <CustomDropdown
                                            value={selectedWorker}
                                            onChange={setSelectedWorker}
                                            options={[
                                                { id: 'carpenter', title: 'Carpenter' },
                                                { id: 'electrician', title: 'Electrician' },
                                                { id: 'plumber', title: 'Plumber' },
                                                { id: 'painter', title: 'Painter' },
                                                { id: 'granite_worker', title: 'Granite Worker' },
                                                { id: 'glass_worker', title: 'Glass Worker' }
                                            ]}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={formData[`${selectedWorker}_name`] || ''}
                                                onChange={(e) => handleChange(`${selectedWorker}_name`, e.target.value)}
                                                placeholder={`Enter ${selectedWorker.replace('_', ' ')} name`}
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                                            <input
                                                type="tel"
                                                value={formData[`${selectedWorker}_phone`] || ''}
                                                onChange={(e) => handleChange(`${selectedWorker}_phone`, e.target.value)}
                                                placeholder="Enter phone"
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 italic">
                                        Select a designation to add or update details. Changes are saved when you click "Save Changes".
                                    </p>
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
