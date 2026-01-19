'use client';

import { useState, useEffect } from 'react';
import { FiCopy, FiCheck, FiRefreshCw, FiToggleLeft, FiToggleRight, FiExternalLink, FiLock } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';

interface ClientAccess {
    id: string;
    token: string;
    is_active: boolean;
    expires_at: string | null;
}

interface ShareLinkModalProps {
    projectId: string;
    onClose: () => void;
}

export const ShareLinkModal = ({ projectId, onClose }: ShareLinkModalProps) => {
    const { showToast } = useToast();
    const [access, setAccess] = useState<ClientAccess | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchAccess();
    }, [projectId]);

    const fetchAccess = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/projects/${projectId}/client-access`);
            if (res.ok) {
                const data = await res.json();
                setAccess(data.access);
            }
        } catch (err) {
            console.error('Failed to fetch access:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async () => {
        if (!access) return;
        try {
            const res = await fetch(`/api/projects/${projectId}/client-access`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !access.is_active })
            });
            if (res.ok) {
                setAccess(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
                showToast('success', `Link ${!access.is_active ? 'Activated' : 'Deactivated'}`);
            }
        } catch (err) {
            showToast('error', 'Update failed');
        }
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            const res = await fetch(`/api/projects/${projectId}/client-access`, {
                method: 'POST'
            });
            if (res.ok) {
                const data = await res.json();
                setAccess(data.access);
                showToast('success', 'New link generated');
            }
        } catch (err) {
            showToast('error', 'Generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const publicUrl = access
        ? `${window.location.origin}/public/project/${access.token}`
        : '';

    const handleCopy = () => {
        if (!publicUrl) return;
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        showToast('success', 'Link copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FiExternalLink className="text-amber-500 shrink-0" size={24} /> <span>Share Project Live Link</span>
            </h2>
            <p className="text-sm text-gray-500 mb-6">
                Generate a secure, read-only link to share with your customer. They'll be able to see photos and progress reports without login.
            </p>

            {loading ? (
                <div className="py-12 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                </div>
            ) : access ? (
                <div className="space-y-6">
                    {/* Status Toggle */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                        <div>
                            <div className="font-semibold text-gray-900">Link Status</div>
                            <div className={`text-sm ${access.is_active ? 'text-green-600' : 'text-red-500'}`}>
                                {access.is_active ? 'Active & Sharable' : 'Disabled'}
                            </div>
                        </div>
                        <button
                            onClick={handleToggleActive}
                            className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors ${access.is_active ? 'text-green-500 bg-green-50 hover:bg-green-100' : 'text-gray-400 bg-gray-100'}`}
                        >
                            <div className="flex items-center justify-center w-full h-full">
                                {access.is_active ? <FiToggleRight className="w-8 h-8" /> : <FiToggleLeft className="w-8 h-8" />}
                            </div>
                        </button>
                    </div>

                    {/* URL Card */}
                    {access.is_active && (
                        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Public Access URL</label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 truncate font-mono">
                                    {publicUrl}
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="w-11 h-11 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0"
                                >
                                    {copied ? <FiCheck className="w-5 h-5" /> : <FiCopy className="w-5 h-5" />}
                                </button>
                                <a
                                    href={publicUrl}
                                    target="_blank"
                                    className="w-11 h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center flex-shrink-0"
                                >
                                    <FiExternalLink className="w-5 h-5" />
                                </a>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-gray-100 flex justify-between gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <FiRefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                            Reset Link & Token
                        </button>
                        <button onClick={onClose} className="btn-secondary py-1.5 px-6">Close</button>
                    </div>
                </div>
            ) : (
                <div className="py-8 text-center bg-amber-50 rounded-2xl border border-dashed border-amber-200">
                    <FiLock className="w-10 h-10 text-amber-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium mb-4">No live link generated for this project yet.</p>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="btn-primary mx-auto flex items-center justify-center px-8 h-12"
                    >
                        {generating ? 'Generating...' : 'Generate Live Link'}
                    </button>
                </div>
            )}
        </div>
    );
};
