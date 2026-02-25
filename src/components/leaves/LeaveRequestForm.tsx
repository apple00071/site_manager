'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { FiCheck, FiX } from 'react-icons/fi';

interface LeaveRequestFormProps {
    leave?: any;
    defaultType?: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const LEAVE_TYPES = [
    'Casual Leave',
    'Sick Leave',
    'Paid Leave',
    'Other',
    'Permission' // Keep internal
];

export default function LeaveRequestForm({ leave, defaultType, onSuccess, onCancel }: LeaveRequestFormProps) {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        leave_type: defaultType || leave?.leave_type || (defaultType === 'Permission' ? 'Permission' : 'Pending'),
        start_date: leave?.start_date || new Date().toISOString().split('T')[0],
        end_date: leave?.end_date || new Date().toISOString().split('T')[0],
        start_time: leave?.start_time || '09:00',
        end_time: leave?.end_time || '10:00',
        reason: leave?.reason || '',
    });

    const isPermission = formData.leave_type === 'Permission' || defaultType === 'Permission';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (isPermission) {
            formData.end_date = formData.start_date; // Sync before validation
        }

        if (!formData.reason || !formData.start_date || !formData.end_date) {
            showToast('error', 'Please fill in all required fields');
            return;
        }

        if (new Date(formData.end_date) < new Date(formData.start_date)) {
            showToast('error', 'End date cannot be before start date');
            return;
        }

        if (isPermission && formData.start_time >= formData.end_time) {
            showToast('error', 'End time must be after start time');
            return;
        }

        const submitData = { ...formData };
        if (!isPermission) {
            // Clear times for normal leaves
            (submitData as any).start_time = null;
            (submitData as any).end_time = null;
        }

        setLoading(true);
        try {
            const url = leave ? `/api/leaves?id=${leave.id}` : '/api/leaves';
            const method = leave ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to save leave request');
            }

            showToast('success', `Leave request ${leave ? 'updated' : 'submitted'} successfully`);
            onSuccess();
        } catch (error: any) {
            console.error('Error saving leave request:', error);
            showToast('error', error.message || 'Failed to save leave request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {!isPermission && (
                <div className="mb-4">
                    <p className="text-sm text-gray-500">
                        Leave applications will be reviewed by the admin. The leave type (Paid/LOP) will be determined upon approval.
                    </p>
                </div>
            )}

            <div className={`grid ${isPermission ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isPermission ? 'Date *' : 'Start Date *'}
                    </label>
                    <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                        required
                    />
                </div>
                {!isPermission && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            End Date *
                        </label>
                        <input
                            type="date"
                            value={formData.end_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                            required
                        />
                    </div>
                )}
            </div>

            {isPermission && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Time *
                        </label>
                        <input
                            type="time"
                            value={formData.start_time}
                            onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            End Time *
                        </label>
                        <input
                            type="time"
                            value={formData.end_time}
                            onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                            required
                        />
                    </div>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason *
                </label>
                <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all text-sm"
                    placeholder={isPermission ? "Why do you need this short permission?" : "Why are you taking leave?"}
                    required
                />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg text-sm font-medium hover:bg-yellow-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <FiCheck className="w-5 h-5" />
                    )}
                    {leave ? 'Update Request' : 'Submit Application'}
                </button>
            </div>
        </form>
    );
}
