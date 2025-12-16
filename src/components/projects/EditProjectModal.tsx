import React, { useState, useEffect } from 'react';
import { FiX, FiSave } from 'react-icons/fi';

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
            case 'workers': return 'Edit Worker Details';
            default: return 'Edit Project';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h3 className="text-lg font-semibold text-gray-900">{getTitle()}</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Project Info Fields */}
                        {section === 'info' && (
                            <>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                        value={formData.status || 'pending'}
                                        onChange={(e) => handleChange('status', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="on_hold">On Hold</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Stage</label>
                                    <select
                                        value={formData.workflow_stage || 'visit'}
                                        onChange={(e) => handleChange('workflow_stage', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    >
                                        <option value="visit">Details</option>
                                        <option value="design">Design</option>
                                        <option value="boq">BOQ</option>
                                        <option value="orders">Orders</option>
                                        <option value="work_progress">Work Progress</option>
                                        <option value="snag">Snag</option>
                                        <option value="finance">Finance</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={formData.start_date ? formData.start_date.split('T')[0] : ''}
                                        onChange={(e) => handleChange('start_date', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Completion</label>
                                    <input
                                        type="date"
                                        value={formData.estimated_completion_date ? formData.estimated_completion_date.split('T')[0] : ''}
                                        onChange={(e) => handleChange('estimated_completion_date', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                {formData.status === 'completed' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Actual Completion Date</label>
                                        <input
                                            type="date"
                                            value={formData.actual_completion_date ? formData.actual_completion_date.split('T')[0] : ''}
                                            onChange={(e) => handleChange('actual_completion_date', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Budget (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.project_budget || ''}
                                        onChange={(e) => handleChange('project_budget', e.target.value === '' ? null : parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Notes</label>
                                    <textarea
                                        value={formData.project_notes || ''}
                                        onChange={(e) => handleChange('project_notes', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </>
                        )}

                        {/* Customer Details Fields */}
                        {section === 'customer' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                                    <input
                                        type="text"
                                        value={formData.customer_name || ''}
                                        onChange={(e) => handleChange('customer_name', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <input
                                        type="text"
                                        value={formData.phone_number || ''}
                                        onChange={(e) => handleChange('phone_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Phone</label>
                                    <input
                                        type="text"
                                        value={formData.alt_phone_number || ''}
                                        onChange={(e) => handleChange('alt_phone_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                    <textarea
                                        value={formData.address || ''}
                                        onChange={(e) => handleChange('address', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </>
                        )}

                        {/* Property Details Fields */}
                        {section === 'property' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                                    <select
                                        value={formData.property_type || ''}
                                        onChange={(e) => handleChange('property_type', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    >
                                        <option value="">Select Type</option>
                                        <option value="apartment">Apartment</option>
                                        <option value="villa">Villa</option>
                                        <option value="office">Office</option>
                                        <option value="plot">Plot</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Apartment/Building Name</label>
                                    <input
                                        type="text"
                                        value={formData.apartment_name || ''}
                                        onChange={(e) => handleChange('apartment_name', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Block Number</label>
                                    <input
                                        type="text"
                                        value={formData.block_number || ''}
                                        onChange={(e) => handleChange('block_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Flat Number</label>
                                    <input
                                        type="text"
                                        value={formData.flat_number || ''}
                                        onChange={(e) => handleChange('flat_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Floor Number</label>
                                    <input
                                        type="text"
                                        value={formData.floor_number || ''}
                                        onChange={(e) => handleChange('floor_number', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Area (sq.ft)</label>
                                    <input
                                        type="number"
                                        value={formData.area_sqft || ''}
                                        onChange={(e) => handleChange('area_sqft', e.target.value === '' ? null : parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
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
                                        <select
                                            value={selectedWorker}
                                            onChange={(e) => setSelectedWorker(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all"
                                        >
                                            <option value="carpenter">Carpenter</option>
                                            <option value="electrician">Electrician</option>
                                            <option value="plumber">Plumber</option>
                                            <option value="painter">Painter</option>
                                            <option value="granite_worker">Granite Worker</option>
                                            <option value="glass_worker">Glass Worker</option>
                                        </select>
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
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-yellow-500 border border-transparent rounded-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all gap-2"
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
        </div>
    );
}
