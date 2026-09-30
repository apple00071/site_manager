'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { FiUpload, FiX, FiCheck } from 'react-icons/fi';
import { uploadFiles } from '@/lib/uploadUtils';
import { CustomDropdown, CustomDatePicker } from '@/components/ui/CustomControls';

interface OfficeExpenseFormProps {
    expense?: any;
    defaultProjectId?: string;
    projectsList?: Array<{ id: string; title: string; project_code?: string }>;
    onSuccess: () => void;
    onCancel: () => void;
}

const OFFICE_CATEGORIES = [
    'Office Supplies',
    'Utilities',
    'Rent',
    'Travel',
    'Marketing',
    'Meals & Entertainment',
    'Maintenance',
    'Professional Services',
    'Software/Subscriptions',
    'Other'
];

const PROJECT_CATEGORIES = [
    'Material Purchase',
    'Site Transport / Conveyance',
    'Labour / Work Charges',
    'Tools & Equipment',
    'Site Refreshments / Snacks',
    'Client Site Visit',
    'Site Miscellaneous',
    'Other'
];

export default function OfficeExpenseForm({
    expense,
    defaultProjectId,
    projectsList,
    onSuccess,
    onCancel
}: OfficeExpenseFormProps) {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [projects, setProjects] = useState<Array<{ id: string; title: string; project_code?: string }>>(
        projectsList || []
    );

    const initialProjectId = expense?.project_id 
        ? expense.project_id 
        : (expense?.source === 'office' ? 'office' : (defaultProjectId && defaultProjectId !== 'all' ? defaultProjectId : 'office'));

    const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);

    const [formData, setFormData] = useState({
        amount: expense?.amount?.toString() || '',
        description: expense?.description || '',
        category: expense?.category || '',
        expense_date: expense?.expense_date || new Date().toISOString().split('T')[0],
        bill_urls: expense?.bill_urls || [],
    });

    // Fetch projects if not provided
    useEffect(() => {
        if (!projectsList || projectsList.length === 0) {
            fetch('/api/admin/projects')
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    const list = Array.isArray(data) ? data : data?.projects || [];
                    setProjects(list.map((p: any) => {
                        const code = (p.project_code || p.ref_no || `AI-${p.id?.slice(0, 4) || ''}`)
                            .replace('AI/PRJ/', 'AI/')
                            .replace('PRJ/', '');
                        return {
                            id: p.id,
                            title: p.title,
                            project_code: code
                        };
                    }));
                })
                .catch(err => console.error('Failed to load projects in expense form:', err));
        }
    }, [projectsList]);

    const isProjectExpense = selectedProjectId !== 'office';
    const categories = isProjectExpense ? PROJECT_CATEGORIES : OFFICE_CATEGORIES;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const urls = await uploadFiles(
                files,
                'inventory-bills',
                'office-expenses'
            );

            setFormData(prev => ({ ...prev, bill_urls: [...prev.bill_urls, ...urls] }));
            if (urls.length > 0) {
                showToast('success', `${urls.length} files uploaded successfully`);
            }
        } catch (error: any) {
            console.error('Error uploading file:', error);
            showToast('error', error.message || 'Failed to upload files');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const removeFile = (urlToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            bill_urls: prev.bill_urls.filter((url: string) => url !== urlToRemove)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!formData.amount) {
            showToast('error', 'Please enter an amount');
            return;
        }

        setLoading(true);
        try {
            const amountNum = parseFloat(formData.amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                showToast('error', 'Please enter a valid amount greater than 0');
                setLoading(false);
                return;
            }

            const dataToSave = {
                amount: amountNum,
                description: formData.description,
                category: formData.category,
                expense_date: formData.expense_date,
                bill_urls: formData.bill_urls,
                project_id: selectedProjectId === 'office' ? null : selectedProjectId,
            };

            const url = expense ? `/api/office-expenses?id=${expense.id}` : '/api/office-expenses';
            const method = expense ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to save expense');
            }

            const label = isProjectExpense ? 'Project expense' : 'Office expense';
            showToast('success', `${label} ${expense ? 'updated' : 'recorded'} successfully`);
            onSuccess();
        } catch (error: any) {
            console.error('Detailed error saving expense:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                error
            });
            showToast('error', error.message || 'Failed to save expense');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Project Selection Dropdown */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Expense For (Project / Office) *
                </label>
                <CustomDropdown
                    value={selectedProjectId}
                    onChange={(val) => {
                        setSelectedProjectId(val);
                        if (val === 'office') {
                            setFormData(prev => ({ ...prev, category: 'Office Supplies' }));
                        } else if (val !== 'office' && !PROJECT_CATEGORIES.includes(formData.category)) {
                            setFormData(prev => ({ ...prev, category: 'Material Purchase' }));
                        }
                    }}
                    options={[
                        { id: 'office', title: 'Office / Non-Project Expense' },
                        ...projects.map(p => ({
                            id: p.id,
                            title: p.title
                        }))
                    ]}
                    searchable={true}
                    placeholder="Select Project or Office"
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Amount (₹) *
                </label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold select-none">₹</span>
                    <input
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                        placeholder="0.00"
                        step="0.01"
                        required
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Category
                </label>
                <CustomDropdown
                    value={formData.category}
                    onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                    options={[
                        { id: '', title: 'None' },
                        ...categories.map(cat => ({ id: cat, title: cat }))
                    ]}
                    placeholder="Select Category"
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Date *
                </label>
                <CustomDatePicker
                    value={formData.expense_date}
                    onChange={(val) => setFormData(prev => ({ ...prev, expense_date: val }))}
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Description / Purpose
                </label>
                <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                    placeholder={isProjectExpense ? 'e.g. Site transport, Local hardware purchase, Tea for carpenter...' : 'What was this expense for?'}
                />
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Bill / Receipts
                </label>
                {/* Multi-file selection */}
                <div className="space-y-3">
                    {formData.bill_urls.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            {formData.bill_urls.map((url: string, idx: number) => (
                                <div key={idx} className="relative group">
                                    {url.toLowerCase().endsWith('.pdf') ? (
                                        <div className="w-full h-28 flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                                            <FiUpload className="w-6 h-6 text-red-500 mb-1" />
                                            <span className="text-[10px] text-gray-500 truncate w-full">PDF Document</span>
                                        </div>
                                    ) : (
                                        <img
                                            src={url}
                                            alt={`Bill ${idx + 1}`}
                                            className="w-full h-28 object-cover rounded-lg border border-gray-200"
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeFile(url)}
                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full shadow-sm hover:bg-red-600 transition-colors"
                                    >
                                        <FiX className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative">
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            accept="application/pdf,image/*"
                            multiple
                            className="hidden"
                            id="bill-upload"
                            disabled={uploading}
                        />
                        <label
                            htmlFor="bill-upload"
                            className={`
                                flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-all
                                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            <FiUpload className="w-5 h-5 text-gray-400 mb-1" />
                            <span className="text-xs text-gray-500">
                                {uploading ? 'Uploading...' : 'Attach bill receipts (Image or PDF)'}
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading || uploading}
                    className="flex-1 px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <FiCheck className="w-4 h-4" />
                    )}
                    {expense ? 'Update Expense' : 'Record Expense'}
                </button>
            </div>
        </form>
    );
}

