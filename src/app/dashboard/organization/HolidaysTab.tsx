'use client';

import { useState, useEffect } from 'react';
import { FiCalendar, FiPlus, FiTrash2, FiInfo } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';

interface Holiday {
    id: string;
    date: string;
    name: string;
}

export default function HolidaysTab() {
    const { showToast } = useToast();
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);

    // Form state
    const [holidayName, setHolidayName] = useState('');
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [tempDate, setTempDate] = useState('');

    useEffect(() => {
        fetchHolidays();
    }, []);

    const fetchHolidays = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/holidays');
            if (!res.ok) throw new Error('Failed to fetch holidays');
            const data = await res.json();
            setHolidays(data || []);
        } catch (err: any) {
            console.error('Error fetching holidays:', err);
            showToast('error', 'Failed to load holidays');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDate = (date: string) => {
        if (!date) return;
        if (selectedDates.includes(date)) {
            showToast('warning', 'Date already selected');
            return;
        }
        setSelectedDates(prev => [...prev, date].sort());
        setTempDate('');
    };

    const handleRemoveDate = (dateToRemove: string) => {
        setSelectedDates(prev => prev.filter(d => d !== dateToRemove));
    };

    const handleAddHoliday = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!holidayName || selectedDates.length === 0) return;

        try {
            setAdding(true);

            const res = await fetch('/api/admin/holidays', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rows: selectedDates.map(date => ({ date, name: holidayName }))
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to add holidays');
            }

            showToast('success', `${selectedDates.length} Holiday(s) added successfully`);
            setHolidayName('');
            setSelectedDates([]);
            fetchHolidays();
        } catch (err: any) {
            showToast('error', err.message || 'Failed to add holidays');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteHoliday = async (id: string) => {
        if (!confirm('Are you sure you want to remove this holiday? Notifications will resume for this date.')) return;

        try {
            const res = await fetch(`/api/admin/holidays?id=${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Failed to remove holiday');

            showToast('success', 'Holiday removed');
            setHolidays(prev => prev.filter(h => h.id !== id));
        } catch (err: any) {
            showToast('error', 'Failed to remove holiday');
        }
    };

    return (
        <div className="bg-white overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex items-center justify-between border-b border-gray-100">
                <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
                        <FiCalendar className="text-yellow-500" /> Holiday list
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        Manage dates when automated project status notifications should be silenced.
                    </p>
                </div>
            </div>

            <div className="border-t border-gray-200 px-4 py-5 sm:p-6 space-y-6">
                {/* Info Card */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <FiInfo className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-blue-700">
                                <b>Note:</b> Automated reports (Daily Briefing, Site Log Reminders) are automatically silenced every <b>Tuesday</b>. Use this section to add additional festival or special holidays.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Add New Holiday Form */}
                <form onSubmit={handleAddHoliday} className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Holiday Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Diwali, Pongal, Office Outing"
                                value={holidayName}
                                onChange={e => setHolidayName(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-yellow-500 outline-none bg-white transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Dates</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={tempDate}
                                    onChange={e => handleAddDate(e.target.value)}
                                    className="flex-1 border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-yellow-500 outline-none bg-white transition-all shadow-sm"
                                />
                            </div>
                            <p className="mt-1.5 text-[10px] text-gray-400">Select multiple dates from the calendar to group them.</p>
                        </div>
                    </div>

                    {/* Selected Dates Display */}
                    {selectedDates.length > 0 && (
                        <div className="pt-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Selected Dates ({selectedDates.length})</label>
                            <div className="flex flex-wrap gap-2">
                                {selectedDates.map(date => (
                                    <span key={date} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-lg border border-yellow-200">
                                        {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDate(date)}
                                            className="hover:bg-yellow-200 rounded-full p-0.5 transition-colors"
                                        >
                                            <FiTrash2 className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={adding || selectedDates.length === 0 || !holidayName}
                            className="btn-primary flex items-center justify-center gap-2 px-8 py-3 shadow-lg shadow-yellow-100 disabled:opacity-50 disabled:shadow-none"
                        >
                            {adding ? 'Adding...' : <><FiPlus className="w-5 h-5" /> Save {selectedDates.length > 0 ? `${selectedDates.length} Dates` : 'Holidays'}</>}
                        </button>
                    </div>
                </form>

                {/* Holiday List */}
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Active Holiday Library</h4>
                        <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">{holidays.length} Total</span>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                        </div>
                    ) : holidays.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 italic">
                            No holidays added yet. Notifications are active for all scheduled days (except Tuesdays).
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {holidays.map(holiday => (
                                <div key={holiday.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-yellow-100 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-yellow-50 p-2.5 rounded-lg border border-yellow-100">
                                            <FiCalendar className="text-yellow-600 w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-semibold text-gray-900 truncate text-sm">{holiday.name}</div>
                                            <div className="text-xs text-gray-500">{new Date(holiday.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteHoliday(holiday.id)}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        title="Delete holiday"
                                    >
                                        <FiTrash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
