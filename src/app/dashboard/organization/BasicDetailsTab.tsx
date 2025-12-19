'use client';

import { useState } from 'react';
import { FiSave, FiUpload } from 'react-icons/fi';

export default function BasicDetailsTab() {
    const [saving, setSaving] = useState(false);
    const [companyDetails, setCompanyDetails] = useState({
        name: 'Apple Interior',
        slug: 'apple-interior',
        address: '',
        city: '',
        state: '',
        pincode: '',
        phone: '',
        email: '',
        website: '',
        gst_number: '',
        pan_number: '',
        bank_name: '',
        bank_account_number: '',
        bank_ifsc: '',
        bank_branch: '',
    });

    const handleChange = (field: string, value: string) => {
        setCompanyDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        // TODO: Implement API call to save company details
        await new Promise(resolve => setTimeout(resolve, 1000));
        alert('Company details saved successfully!');
        setSaving(false);
    };

    return (
        <div className="space-y-6">
            {/* Company Information */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 border-b pb-3">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                        <input
                            type="text"
                            value={companyDetails.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                        <input
                            type="text"
                            value={companyDetails.slug}
                            readOnly
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <textarea
                            value={companyDetails.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            rows={2}
                            placeholder="Enter full company address..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                            type="text"
                            value={companyDetails.city}
                            onChange={(e) => handleChange('city', e.target.value)}
                            placeholder="e.g. Hyderabad"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                            type="text"
                            value={companyDetails.state}
                            onChange={(e) => handleChange('state', e.target.value)}
                            placeholder="e.g. Telangana"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                        <input
                            type="text"
                            value={companyDetails.pincode}
                            onChange={(e) => handleChange('pincode', e.target.value)}
                            placeholder="e.g. 500001"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                            type="tel"
                            value={companyDetails.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            placeholder="e.g. +91 9963120180"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={companyDetails.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="e.g. info@appleinterior.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                        <input
                            type="url"
                            value={companyDetails.website}
                            onChange={(e) => handleChange('website', e.target.value)}
                            placeholder="e.g. https://appleinterior.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                </div>
            </div>

            {/* Tax Information */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 border-b pb-3">Tax Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                        <input
                            type="text"
                            value={companyDetails.gst_number}
                            onChange={(e) => handleChange('gst_number', e.target.value)}
                            placeholder="e.g. 36AABCT1234F1ZK"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                        <input
                            type="text"
                            value={companyDetails.pan_number}
                            onChange={(e) => handleChange('pan_number', e.target.value)}
                            placeholder="e.g. AABCT1234F"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                </div>
            </div>

            {/* Bank Details */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 border-b pb-3">Bank Details (for Invoice)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                        <input
                            type="text"
                            value={companyDetails.bank_name}
                            onChange={(e) => handleChange('bank_name', e.target.value)}
                            placeholder="e.g. HDFC Bank"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                        <input
                            type="text"
                            value={companyDetails.bank_account_number}
                            onChange={(e) => handleChange('bank_account_number', e.target.value)}
                            placeholder="e.g. 50100XXXXXXXXX"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                        <input
                            type="text"
                            value={companyDetails.bank_ifsc}
                            onChange={(e) => handleChange('bank_ifsc', e.target.value)}
                            placeholder="e.g. HDFC0001234"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                        <input
                            type="text"
                            value={companyDetails.bank_branch}
                            onChange={(e) => handleChange('bank_branch', e.target.value)}
                            placeholder="e.g. Jubilee Hills Branch"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                </div>
            </div>

            {/* Logo Upload (placeholder) */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 border-b pb-3">Company Logo</h3>
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                        <img src="/icon.png" alt="Logo" className="w-16 h-16" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                    <div>
                        <button className="btn-secondary">
                            <FiUpload className="h-4 w-4" />
                            Upload New Logo
                        </button>
                        <p className="text-xs text-gray-500 mt-2">PNG or JPG, max 2MB. Used in PO and Invoices.</p>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                    <FiSave className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Company Details'}
                </button>
            </div>
        </div>
    );
}
