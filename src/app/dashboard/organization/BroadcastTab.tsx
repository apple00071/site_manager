'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FiSend, FiAlertCircle, FiCheckCircle, FiSearch, FiUsers } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

const BroadcastTab = () => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [allUsers, setAllUsers] = useState<{ id: string, full_name: string }[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFetchingUsers, setIsFetchingUsers] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            setIsFetchingUsers(true);
            try {
                const response = await fetch('/api/admin/users');
                if (!response.ok) throw new Error('Failed to fetch users');
                const data = await response.json();
                setAllUsers(data || []);
            } catch (err) {
                console.error('Failed to fetch users:', err);
            } finally {
                setIsFetchingUsers(false);
            }
        };
        fetchUsers();
    }, []);

    const filteredUsers = allUsers.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleUser = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const toggleAll = () => {
        if (selectedUserIds.length === filteredUsers.length) {
            setSelectedUserIds([]);
        } else {
            setSelectedUserIds(filteredUsers.map(u => u.id));
        }
    };

    const handleSendBroadcast = async () => {
        if (!message.trim()) {
            setStatus({ type: 'error', text: 'Please enter a message.' });
            return;
        }

        setIsLoading(true);
        setStatus(null);

        try {
            const response = await fetch('/api/admin/broadcast-notification?adminId=' + user?.id, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`
                },
                // We don't actually use the body yet in the API, but good to include for future flexibility
                body: JSON.stringify({
                    title: title.trim(),
                    message: message.trim(),
                    userIds: selectedUserIds
                })
            });

            const result = await response.json();

            if (response.ok) {
                setStatus({ type: 'success', text: `Broadcast sent successfully to ${result.message}` });
                setMessage('');
            } else {
                setStatus({ type: 'error', text: result.error || 'Failed to send broadcast.' });
            }
        } catch (error) {
            console.error('Error sending broadcast:', error);
            setStatus({ type: 'error', text: 'An unexpected error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full">
            <div className="p-6 space-y-6">
                {status && (
                    <div className={`p-4 rounded-lg flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                        }`}>
                        {status.type === 'success' ? <FiCheckCircle className="mt-0.5 shrink-0" /> : <FiAlertCircle className="mt-0.5 shrink-0" />}
                        <p className="text-sm font-medium">{status.text}</p>
                    </div>
                )}

                <div>
                    <label htmlFor="broadcast-title" className="block text-sm font-medium text-gray-700 mb-2">
                        Notification Title
                    </label>
                    <input
                        id="broadcast-title"
                        type="text"
                        className="w-full rounded-xl border-gray-200 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm p-4 transition-all"
                        placeholder="e.g. Site Update, Holiday Notice..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="broadcast-message" className="block text-sm font-medium text-gray-700 mb-2">
                        Notification Message
                    </label>
                    <textarea
                        id="broadcast-message"
                        rows={4}
                        className="w-full rounded-xl border-gray-200 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm p-4 transition-all"
                        placeholder="Enter the holiday wish or announcement here..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={isLoading}
                    />
                    <p className="mt-2 text-xs text-gray-400">
                        This message will be sent exactly as entered to all users.
                    </p>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">
                            Recipients ({selectedUserIds.length} selected)
                        </label>
                        <button
                            type="button"
                            onClick={toggleAll}
                            className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold"
                        >
                            {selectedUserIds.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="mb-3">
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="w-full text-xs rounded-lg border-gray-200 focus:border-yellow-500 focus:ring-yellow-500 p-2"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="border border-gray-100 rounded-xl p-2 space-y-1 bg-gray-50/30">
                        {isFetchingUsers ? (
                            <div className="p-4 text-center text-xs text-gray-400 italic">Loading users...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="p-4 text-center text-xs text-gray-400 italic">No users found</div>
                        ) : (
                            filteredUsers.map(u => (
                                <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 h-4 w-4"
                                        checked={selectedUserIds.includes(u.id)}
                                        onChange={() => toggleUser(u.id)}
                                    />
                                    <span className="text-sm text-gray-600 truncate">{u.full_name}</span>
                                </label>
                            ))
                        )}
                    </div>
                    <p className="mt-2 text-[10px] text-gray-400">
                        * If no users are selected, the notification will be sent to ALL active users by default.
                    </p>
                </div>

                <div className="pt-2">
                    <button
                        onClick={handleSendBroadcast}
                        disabled={isLoading || !message.trim()}
                        className={`
                            w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                            ${isLoading || !message.trim()
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-yellow-500 text-gray-900 hover:bg-yellow-600 shadow-md active:scale-[0.98]'
                            }
                        `}
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900/20 border-t-gray-900"></div>
                                Sending...
                            </>
                        ) : (
                            <>
                                <FiSend />
                                Send Broadcast Now
                            </>
                        )}
                    </button>
                    <p className="mt-4 text-[10px] text-center text-gray-400">
                        ⚠️ Warning: This action cannot be undone. Notifications will be delivered immediately to all devices.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BroadcastTab;
