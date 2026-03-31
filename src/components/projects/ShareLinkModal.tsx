'use client';

import { useState, useEffect } from 'react';
import { FiCopy, FiCheck, FiRefreshCw, FiToggleLeft, FiToggleRight, FiShield, FiUserPlus, FiKey, FiUser, FiArrowRight } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';

interface LinkedUser {
    id: string;
    full_name: string;
    username: string;
    email?: string;
}

interface ShareLinkModalProps {
    projectId: string;
    customerName?: string;
    onClose: () => void;
}

export const ShareLinkModal = ({ projectId, customerName, onClose }: ShareLinkModalProps) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [linkedUser, setLinkedUser] = useState<LinkedUser | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [tempPassword, setTempPassword] = useState<string | null>(null);
    
    // Manual editing state
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualName, setManualName] = useState(customerName || '');

    useEffect(() => {
        fetchStatus();
    }, [projectId]);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/${projectId}/portal-credentials`);
            if (res.ok) {
                const data = await res.json();
                setLinkedUser(data.linkedUser);
                setIsActive(data.isActive);
                // The API also returns customerName, but we favor the prop passed from parent
                if (!manualName && data.customerName) setManualName(data.customerName);
            }
        } catch (err) {
            console.error('Failed to fetch status:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async () => {
        try {
            setActionLoading(true);
            const res = await fetch(`/api/projects/${projectId}/portal-credentials`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_status', isActive: !isActive })
            });
            if (res.ok) {
                setIsActive(!isActive);
                showToast('success', `Portal access ${!isActive ? 'Enabled' : 'Disabled'}`);
            }
        } catch (err) {
            showToast('error', 'Update failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateAccount = async (nameToUse: string) => {
        const finalName = nameToUse || customerName;
        if (!finalName) {
            showToast('error', 'Client name is missing');
            return;
        }
        try {
            setActionLoading(true);
            const res = await fetch(`/api/projects/${projectId}/portal-credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: finalName })
            });
            if (res.ok) {
                const data = await res.json();
                setTempPassword(data.temporaryPassword);
                showToast('success', 'Portal access generated');
                fetchStatus();
                setShowManualForm(false);
            } else {
                const err = await res.json();
                showToast('error', err.error || 'Failed to create account');
            }
        } catch (err) {
            showToast('error', 'System error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!confirm('Are you sure you want to reset the password? The existing password will stop working.')) return;
        try {
            setActionLoading(true);
            const res = await fetch(`/api/projects/${projectId}/portal-credentials`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset_password' })
            });
            if (res.ok) {
                const data = await res.json();
                setTempPassword(data.newPassword);
                showToast('success', 'Password reset successfully');
            }
        } catch (err) {
            showToast('error', 'Reset failed');
        } finally {
            setActionLoading(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast('success', `${label} copied!`);
    };

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FiShield className="text-yellow-500 shrink-0" size={24} /> <span>Client Portal Access</span>
            </h2>
            <p className="text-sm text-gray-500 mb-6">
                Direct credentials management for your projects.
            </p>

            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                </div>
            ) : linkedUser ? (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    {/* Status Toggle */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div>
                            <div className="font-semibold text-gray-900 text-sm">Portal Access Status</div>
                            <div className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-green-600' : 'text-red-500'}`}>
                                {isActive ? 'Enabled' : 'Disabled'}
                            </div>
                        </div>
                        <button
                            onClick={handleToggleActive}
                            disabled={actionLoading}
                            className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors ${isActive ? 'text-green-500 bg-green-50 hover:bg-green-100' : 'text-gray-400 bg-gray-100'}`}
                        >
                            {isActive ? <FiToggleRight className="w-8 h-8" /> : <FiToggleLeft className="w-8 h-8" />}
                        </button>
                    </div>

                    {/* Account Info */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Username</label>
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                    <FiUser className="text-yellow-500" />
                                    {linkedUser.username}
                                    <button onClick={() => copyToClipboard(linkedUser.username, 'Username')} className="text-gray-400 hover:text-yellow-600 transition-colors">
                                        <FiCopy size={14}/>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Full Name</label>
                                <div className="text-sm font-medium text-gray-700 truncate">{linkedUser.full_name}</div>
                            </div>
                        </div>

                        {tempPassword ? (
                            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-100 rounded-xl animate-in fade-in zoom-in-95 duration-300">
                                <label className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest block mb-2">Temporary Password (Copy Now!)</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-white border border-yellow-200 rounded-lg px-3 py-2 font-mono text-sm font-bold text-gray-900 overflow-hidden truncate">
                                        {tempPassword}
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(tempPassword, 'Password')}
                                        className="bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-black transition-colors"
                                    >
                                        <FiCopy />
                                    </button>
                                </div>
                                <p className="text-[10px] text-yellow-600 mt-2 italic">* Password shown only once.</p>
                            </div>
                        ) : (
                            <button
                                onClick={handleResetPassword}
                                disabled={actionLoading}
                                className="w-full py-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <FiKey /> Reset & Show Password
                            </button>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                        <div className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                            Secure Portal Access
                        </div>
                        <button onClick={onClose} className="bg-gray-900 text-white py-2 px-8 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-200">Close</button>
                    </div>
                </div>
            ) : (
                <div className="py-8 text-center bg-gray-50 rounded-[2rem] border border-dashed border-gray-200 animate-in fade-in zoom-in-95 duration-300">
                    <FiUserPlus className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    
                    {showManualForm ? (
                        <div className="px-6 space-y-4">
                             <div>
                                <label className="block text-[10px] font-black tracking-widest text-gray-400 uppercase mb-2 ml-1 text-left">Client Full Name</label>
                                <input
                                    type="text"
                                    autoFocus
                                    className="w-full px-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-yellow-500/10 outline-none transition-all font-medium"
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => handleCreateAccount(manualName)}
                                disabled={actionLoading}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-2xl w-full text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {actionLoading ? 'Creating...' : <>Generate for Specified Name <FiArrowRight /></>}
                            </button>
                            <button onClick={() => setShowManualForm(false)} className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-gray-600">
                                Cancel Manual Edit
                            </button>
                        </div>
                    ) : (
                        <div className="px-10">
                            <h3 className="text-gray-900 font-bold text-sm mb-2">Create Portal Access</h3>
                            <p className="text-gray-400 text-xs mb-8">
                                Account for <span className="font-bold text-gray-900">{customerName || manualName || 'the client'}</span> using project details.
                            </p>
                            
                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => handleCreateAccount(manualName || customerName || '')}
                                    disabled={actionLoading}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-2xl w-full text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {actionLoading ? 'Generating...' : <>Generate Portal Access <FiArrowRight /></>}
                                </button>
                                
                                <button 
                                    onClick={() => setShowManualForm(true)}
                                    className="text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-gray-600 transition-colors"
                                >
                                    Edit Name Manually
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
