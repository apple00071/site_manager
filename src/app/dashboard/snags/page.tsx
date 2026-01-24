'use client';

import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useEffect, useState, useMemo } from 'react';
import {
    FiPlus, FiFilter, FiCheckCircle, FiClock, FiAlertTriangle, FiUser,
    FiMapPin, FiCamera, FiX, FiInfo, FiSend, FiSearch, FiChevronRight,
    FiCalendar, FiMessageSquare, FiPhone, FiLayers
} from 'react-icons/fi';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { SnagTimeline, TimelineItem } from '@/components/projects/SnagTimeline';

interface Snag {
    id: string;
    description: string;
    location: string | null;
    category: string | null;
    priority: 'low' | 'medium' | 'high';
    status: 'open' | 'assigned' | 'resolved' | 'verified' | 'closed';
    photos: string[];
    project_id?: string | null;
    site_name?: string | null;
    client_name?: string | null;
    customer_phone?: string | null;
    project?: { id: string; title: string };
    assigned_to_user?: { id: string; full_name: string };
    created_by_user?: { id: string; full_name: string };
    created_at: string;
    closed_at?: string;
    resolved_photos?: string[];
    resolved_description?: string;
}

interface ProjectOption {
    id: string;
    title: string;
}

interface UserOption {
    id: string;
    name: string;
}

export default function SnagsPage() {
    const { setTitle, setSubtitle } = useHeaderTitle();
    const router = useRouter();
    const { user } = useAuth();
    const { hasPermission, isAdmin } = useUserPermissions();

    // Permission checks
    const canCreate = hasPermission('snags.create');
    const canResolve = hasPermission('snags.resolve');
    const canVerify = hasPermission('snags.verify');

    // Data State
    const [snags, setSnags] = useState<Snag[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
    const [history, setHistory] = useState<any[]>([]);

    // UI State
    const [selectedSnag, setSelectedSnag] = useState<Snag | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const [followUpNote, setFollowUpNote] = useState('');
    const [resolving, setResolving] = useState(false);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Form/Interactive State
    const [resolveData, setResolveData] = useState({ description: '', photos: [] as string[] });
    const [projectUsers, setProjectUsers] = useState<UserOption[]>([]);
    const [formData, setFormData] = useState({
        project_id: '',
        site_name: '',
        client_name: '',
        customer_phone: '',
        description: '',
        location: '',
        category: '',
        priority: 'medium',
        assigned_to_user_id: '',
        photos: [] as string[]
    });

    const searchParams = useSearchParams();
    const snagIdParam = searchParams?.get('snagId');

    // Header Setup
    useEffect(() => {
        setTitle('Snag Dashboard');
        fetchGlobalSnags();
    }, []);

    // Deep Linking
    useEffect(() => {
        if (snagIdParam && snags.length > 0) {
            const snag = snags.find(s => s.id === snagIdParam);
            if (snag) setSelectedSnag(snag);
        }
    }, [snagIdParam, snags]);

    useEffect(() => {
        if (selectedSnag) {
            fetchHistory(selectedSnag.id);
        } else {
            setHistory([]);
        }
    }, [selectedSnag]);

    // Data Fetchers
    const fetchGlobalSnags = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/snags?all=true');
            const data = await res.json();
            if (data.snags) {
                setSnags(data.snags);
                // Select first snag by default on desktop if none selected
                if (data.snags.length > 0 && !selectedSnag && window.innerWidth >= 1024) {
                    setSelectedSnag(data.snags[0]);
                }
            }
        } catch (err) {
            console.error('Failed to fetch snags', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await fetch(`/api/admin/users`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setProjectUsers(data
                    .filter((u: any) => u.role !== 'admin')
                    .map((u: any) => ({
                        id: u.id,
                        name: u.full_name || u.email
                    })));
            }
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    };

    const fetchHistory = async (snagId: string) => {
        try {
            const res = await fetch(`/api/snags/${snagId}/history`);
            const data = await res.json();
            if (data.history) setHistory(data.history);
        } catch (err) {
            console.error('Failed to fetch history', err);
        }
    };

    // Filtered Data
    const filteredSnags = useMemo(() => {
        return snags.filter(s => {
            const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
            const matchesProject = selectedProjectId === 'all' || s.project_id === selectedProjectId;
            const matchesSearch = s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.site_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (s.project?.title.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesStatus && matchesProject && matchesSearch;
        });
    }, [snags, filterStatus, selectedProjectId, searchQuery]);

    const stats = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return {
            total: snags.filter(s => s.status !== 'closed').length,
            high: snags.filter(s => s.priority === 'high' && s.status !== 'closed').length,
            pending: snags.filter(s => s.status === 'resolved').length,
            closed: snags.filter(s => s.status === 'closed').length
        };
    }, [snags]);

    const projectOptions = useMemo(() => {
        const unique = new Map();
        snags.forEach(s => {
            if (s.project_id && s.project) {
                unique.set(s.project_id, s.project.title);
            }
        });
        return Array.from(unique.entries()).map(([id, title]) => ({ id, title }));
    }, [snags]);

    // Handlers
    const handleUpdateStatus = async (status: string, snagId?: string) => {
        const targetId = snagId || selectedSnag?.id;
        if (!targetId) return;

        setResolving(true);
        try {
            const payload: any = { id: targetId, action: status };
            if (status === 'resolve') {
                payload.resolved_description = resolveData.description;
                payload.resolved_photos = resolveData.photos;
            }

            const res = await fetch('/api/snags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                await fetchGlobalSnags();
                if (selectedSnag) fetchHistory(selectedSnag.id);
                if (!snagId) setShowResolveModal(false);
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to update status');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setResolving(false);
        }
    };

    const handlePostFollowUp = async () => {
        if (!selectedSnag || !followUpNote) return;
        setResolving(true);
        try {
            const res = await fetch('/api/snags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedSnag.id, action: 'comment', comment: followUpNote })
            });

            if (res.ok) {
                setFollowUpNote('');
                setShowFollowUpModal(false);
                fetchHistory(selectedSnag.id);
            } else {
                alert('Failed to post update');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setResolving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isResolve = false) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingPhotos(true);
        const uploadedUrls: string[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const path = isResolve ? 'resolved' : 'general';
                const fileName = `${path}/${Date.now()}_${i}.${fileExt}`;

                const { error } = await supabase.storage.from('project-update-photos').upload(fileName, file);
                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage.from('project-update-photos').getPublicUrl(fileName);
                uploadedUrls.push(publicUrl);
            }
            if (isResolve) {
                setResolveData(prev => ({ ...prev, photos: [...prev.photos, ...uploadedUrls] }));
            } else {
                setFormData(prev => ({ ...prev, photos: [...prev.photos, ...uploadedUrls] }));
            }
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload photos');
        } finally {
            setUploadingPhotos(false);
        }
    };

    const handleSubmitNewSnag = async () => {
        if (!formData.description) return alert('Description is required');
        try {
            const res = await fetch('/api/snags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, project_id: formData.project_id || null })
            });

            if (res.ok) {
                fetchGlobalSnags();
                setShowModal(false);
                setFormData({
                    project_id: '', site_name: '', client_name: '', customer_phone: '',
                    description: '', location: '', category: '', priority: 'medium',
                    assigned_to_user_id: '', photos: []
                });
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to create snag');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // UI Helpers
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'assigned': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'resolved': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'verified': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'closed': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'text-rose-600';
            case 'medium': return 'text-yellow-600';
            case 'low': return 'text-blue-600';
            default: return 'text-gray-600';
        }
    };

    const generateTimeline = (snag: Snag): TimelineItem[] => {
        const items: TimelineItem[] = [];

        // Base Report
        items.push({
            id: 'base', type: 'reported', author: snag.created_by_user?.full_name || 'Admin',
            date: snag.created_at, note: snag.description
        });

        // Merged History from Notifications
        history.forEach(h => {
            let type: any = 'progress';
            if (h.type === 'snag_assigned') type = 'assigned';
            else if (h.type === 'snag_resolved') type = 'resolved';
            else if (h.type === 'snag_verified' || h.type === 'snag_closed') type = 'verified';
            else if (h.type === 'snag_comment') type = 'progress';

            // Extract author from message if possible (e.g. "Update on ... by Name:")
            const authorMatch = h.message.match(/by (.*?):/);
            const author = authorMatch ? authorMatch[1] : 'Team member';

            // Extract note from message (after the colon)
            const noteMatch = h.message.match(/:([\s\S]*)/);
            const note = noteMatch ? noteMatch[1].trim().replace(/^"/, '').replace(/"$/, '') : h.message;

            items.push({
                id: h.id,
                type,
                author,
                date: h.created_at,
                note
            });
        });

        // Filter out the "base" report if it's already in history (prevent double items)
        // Sort by date descending
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    return (
        <div className={`flex flex-col ${selectedSnag ? 'h-[calc(100vh-64px)]' : 'h-[calc(100vh-80px)]'} lg:h-[calc(100vh-100px)] overflow-hidden -mt-2`}>
            {/* 1. Stats Bar */}
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0 px-1 ${selectedSnag ? 'hidden lg:grid' : 'grid'}`}>
                {[
                    { label: 'Total Open', value: stats.total, icon: FiAlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { label: 'High Priority', value: stats.high, icon: FiClock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                    { label: 'Pending Verify', value: stats.pending, icon: FiCheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Closed Snags', value: stats.closed, icon: FiLayers, color: 'text-emerald-600', bg: 'bg-emerald-50' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{stat.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                    </div>
                ))}
            </div>

            {/* 2. Main Dashboard Area */}
            <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
                {/* Left Pane: List */}
                <div className={`w-full lg:w-96 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden shrink-0 ${selectedSnag ? 'hidden lg:flex' : 'flex'}`}>
                    {/* List Header/Filters */}
                    <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50/50">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search snags..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 outline-none"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="open">Open</option>
                                <option value="assigned">Assigned</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                            {canCreate && (
                                <button
                                    onClick={() => { fetchAllUsers(); setShowModal(true); }}
                                    className="p-1.5 flex items-center justify-center bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                                    title="Raise Snag"
                                >
                                    <FiPlus className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar divide-y divide-gray-100">
                        {loading ? (
                            <div className="p-10 text-center text-gray-400 text-sm">Loading snags...</div>
                        ) : filteredSnags.length === 0 ? (
                            <div className="p-10 text-center">
                                <FiAlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">No matching snags found</p>
                            </div>
                        ) : (
                            filteredSnags.map(snag => (
                                <div
                                    key={snag.id}
                                    onClick={() => setSelectedSnag(snag)}
                                    className={`p-4 cursor-pointer transition-all border-l-4 ${selectedSnag?.id === snag.id ? 'bg-yellow-50 border-yellow-500' : 'border-transparent hover:bg-gray-50'}`}
                                >
                                    <div className="flex justify-between items-start mb-1.5 gap-2">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-tighter truncate shrink-0">
                                            {snag.site_name || snag.project?.title || 'General'}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(snag.status)}`}>
                                            {snag.status}
                                        </span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 line-clamp-1 mb-2">{snag.description}</p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                            <FiUser className="w-3 h-3" />
                                            <span className="truncate max-w-[120px]">{snag.assigned_to_user?.full_name || 'Unassigned'}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${getPriorityColor(snag.priority)}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${snag.priority === 'high' ? 'bg-rose-500' : snag.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                                            {snag.priority}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Pane: Details Content */}
                <div className={`flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${selectedSnag ? 'flex' : 'hidden lg:flex'}`}>
                    {selectedSnag ? (
                        <>
                            {/* Detail Header */}
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setSelectedSnag(null)}
                                        className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-gray-600"
                                    >
                                        <FiX className="w-6 h-6" />
                                    </button>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getStatusColor(selectedSnag.status)} border shadow-sm`}>
                                        <FiAlertTriangle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 leading-tight">{selectedSnag.site_name || selectedSnag.project?.title || 'Snag Details'}</h2>
                                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                            <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                                <FiCalendar /> {new Date(selectedSnag.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                            {selectedSnag.location && (
                                                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                                    <FiMapPin /> {selectedSnag.location}
                                                </p>
                                            )}
                                            {selectedSnag.client_name && (
                                                <p className="text-xs font-semibold text-yellow-600 flex items-center gap-1.5">
                                                    <FiUser /> {selectedSnag.client_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedSnag.customer_phone && (
                                        <a href={`tel:${selectedSnag.customer_phone}`} className="p-2 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                                            <FiPhone className="w-5 h-5" />
                                        </a>
                                    )}
                                    {selectedSnag.status === 'closed' && (
                                        <button onClick={() => window.open(`/api/snags/${selectedSnag.id}/report`, '_blank')} className="btn-secondary flex items-center gap-2 text-yellow-600 border-yellow-200">
                                            <FiSend className="w-4 h-4" /> Report
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                                {/* Description Section */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Issue Description</h4>
                                    <p className="text-gray-700 leading-relaxed text-base font-medium bg-gray-50/50 p-4 rounded-xl border border-gray-100 italic">
                                        "{selectedSnag.description}"
                                    </p>
                                </div>

                                {/* Photos Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            Before Resolution <div className="h-px flex-1 bg-gray-100" />
                                        </h4>
                                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                            {selectedSnag.photos?.length > 0 ? selectedSnag.photos.map((url, i) => (
                                                <div key={i} onClick={() => setViewingImage(url)} className="w-32 h-32 relative rounded-2xl overflow-hidden border-2 border-white shadow-md cursor-zoom-in hover:scale-105 transition-transform shrink-0">
                                                    <Image src={url} alt="snag" fill className="object-cover" />
                                                </div>
                                            )) : (
                                                <div className="w-full h-32 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-300">
                                                    <FiCamera className="w-8 h-8 mb-1" />
                                                    <span className="text-[10px] font-bold uppercase tracking-tight">No Photos</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            Resolution Proof <div className="h-px flex-1 bg-gray-100" />
                                        </h4>
                                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                            {selectedSnag.resolved_photos?.length ? selectedSnag.resolved_photos.map((url, i) => (
                                                <div key={i} onClick={() => setViewingImage(url)} className="w-32 h-32 relative rounded-2xl overflow-hidden border-2 border-white shadow-md cursor-zoom-in hover:scale-105 transition-transform shrink-0">
                                                    <Image src={url} alt="resolved" fill className="object-cover" />
                                                </div>
                                            )) : (
                                                <div className="w-full h-32 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-300">
                                                    <FiCheckCircle className="w-8 h-8 mb-1" />
                                                    <span className="text-[10px] font-bold uppercase tracking-tight">Resolution Pending</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed History / Timeline */}
                                <div className="border-t border-gray-100 pt-8">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Follow-up Timeline</h4>
                                        <button onClick={() => setShowFollowUpModal(true)} className="text-[10px] font-bold uppercase text-yellow-600 hover:text-yellow-700">+ Add Update</button>
                                    </div>
                                    <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                                        <SnagTimeline items={generateTimeline(selectedSnag)} />
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Actions Bar */}
                            <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center shadow-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold text-sm">
                                        {selectedSnag.assigned_to_user?.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Assigned To</p>
                                        <p className="text-sm font-semibold text-gray-900">{selectedSnag.assigned_to_user?.full_name || 'Not assigned yet'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {['open', 'assigned'].includes(selectedSnag.status) && canResolve && (user?.id === selectedSnag.assigned_to_user?.id || isAdmin) && (
                                        <button onClick={() => { setResolveData({ description: '', photos: [] }); setShowResolveModal(true); }} className="px-6 py-2.5 bg-yellow-500 text-white font-bold rounded-xl shadow-lg hover:bg-yellow-600 active:scale-95 transition-all">
                                            Mark as Resolved
                                        </button>
                                    )}
                                    {selectedSnag.status === 'resolved' && canVerify && (
                                        <>
                                            <button onClick={() => handleUpdateStatus('reopen')} className="px-5 py-2.5 bg-rose-50 text-rose-600 font-bold rounded-xl border border-rose-100">Reopen</button>
                                            <button onClick={() => handleUpdateStatus('close')} className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg">Verify & Close</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="m-auto text-center p-12">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-gray-200">
                                <FiInfo className="w-10 h-10 text-gray-300" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Select a snag</h2>
                            <p className="text-sm text-gray-500">Pick an item from the left to view full details and history.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals & Popups */}
            {/* Raise Snag Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-900">Report New Site Issue</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><FiX className="w-6 h-6 text-gray-400" /></button>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Project / Site Name</label>
                                    <input type="text" value={formData.site_name} onChange={e => setFormData({ ...formData, site_name: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-yellow-500 transition-all outline-none" placeholder="e.g. Skyline 4B" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Priority Level</label>
                                    <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })} className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-yellow-500 transition-all outline-none capitalize">
                                        <option value="low">Low Priority</option>
                                        <option value="medium">Medium Priority</option>
                                        <option value="high">High Priority</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Client Name</label>
                                    <input type="text" value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-yellow-500 transition-all outline-none" placeholder="e.g. John Doe" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Customer Phone</label>
                                    <input type="text" value={formData.customer_phone} onChange={e => setFormData({ ...formData, customer_phone: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-yellow-500 transition-all outline-none" placeholder="e.g. +91 9876543210" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Issue Description</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-yellow-500 transition-all outline-none" rows={4} placeholder="Describe the problem in detail..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Assign To</label>
                                    <select value={formData.assigned_to_user_id} onChange={e => setFormData({ ...formData, assigned_to_user_id: e.target.value })} className="w-full px-3 py-3 bg-gray-50 border border-transparent rounded-2xl">
                                        <option value="">Unassigned</option>
                                        {projectUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Site Location</label>
                                    <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl" placeholder="e.g. Master Bedroom" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Site Photos</label>
                                <div className="flex gap-3 overflow-x-auto py-2">
                                    {formData.photos.map((url, i) => (
                                        <div key={i} className="relative w-20 h-20 shrink-0">
                                            <Image src={url} alt="preview" fill className="object-cover rounded-2xl" />
                                            <button onClick={() => setFormData(p => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }))} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-lg"><FiX className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:border-yellow-500 hover:bg-yellow-50 transition-all group">
                                        {uploadingPhotos ? <div className="animate-spin w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full" /> : <><FiCamera className="w-8 h-8 text-gray-300 group-hover:text-yellow-500" /></>}
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e)} />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-4">
                            <button onClick={() => setShowModal(false)} className="px-6 py-2.5 text-sm font-bold text-gray-500">Cancel</button>
                            <button onClick={handleSubmitNewSnag} disabled={!formData.description} className="px-8 py-2.5 bg-yellow-500 text-white font-bold rounded-2xl shadow-xl hover:bg-yellow-600 disabled:opacity-50">Create Snag</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resolve Modal */}
            {showResolveModal && selectedSnag && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center text-emerald-900">
                            <h3 className="text-xl font-bold flex items-center gap-2"><FiCheckCircle /> Resolve Snag</h3>
                            <button onClick={() => setShowResolveModal(false)} className="p-1 hover:bg-emerald-100 rounded-full transition-colors"><FiX /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Resolution Summary</label>
                                <textarea value={resolveData.description} onChange={e => setResolveData(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none" rows={3} placeholder="Tell us what was fixed..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Proof Photos (Required)</label>
                                <div className="flex gap-2 overflow-x-auto py-1">
                                    {resolveData.photos.map((url, i) => (
                                        <div key={i} className="relative w-20 h-20 shrink-0">
                                            <Image src={url} alt="proof" fill className="object-cover rounded-2xl" />
                                            <button onClick={() => setResolveData(p => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }))} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1"><FiX className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-emerald-50 hover:border-emerald-500 transition-all group">
                                        {uploadingPhotos ? <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full" /> : <FiCamera className="w-6 h-6 text-gray-300 group-hover:text-emerald-500" />}
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, true)} />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 font-bold">
                            <button onClick={() => setShowResolveModal(false)} className="px-5 py-2 text-gray-500">Cancel</button>
                            <button onClick={() => handleUpdateStatus('resolve')} disabled={resolving || !resolveData.description || resolveData.photos.length === 0} className="px-6 py-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg hover:bg-emerald-700 disabled:opacity-50">Submit Resolution</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Follow Up Modal */}
            {showFollowUpModal && selectedSnag && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <FiMessageSquare className="text-yellow-500" /> Progress Update
                            </h3>
                            <button onClick={() => setShowFollowUpModal(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                                <FiX className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Note for stakeholders</p>
                            <textarea
                                value={followUpNote}
                                onChange={e => setFollowUpNote(e.target.value)}
                                className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all text-sm font-medium"
                                rows={4}
                                placeholder="What's the current status? (e.g. Work in progress, materials ordered...)"
                            />
                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowFollowUpModal(false)} className="px-6 py-2 text-sm font-bold text-gray-400">Cancel</button>
                            <button
                                onClick={handlePostFollowUp}
                                disabled={resolving || !followUpNote}
                                className="px-8 py-2.5 bg-yellow-500 text-white font-bold rounded-2xl shadow-xl hover:bg-yellow-600 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {resolving ? 'Posting...' : 'Post Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Viewer */}
            {viewingImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
                    <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"><FiX className="w-10 h-10" /></button>
                    <div className="relative w-full max-w-5xl h-full max-h-[85vh]">
                        <Image src={viewingImage} alt="Full Size" fill className="object-contain" quality={100} />
                    </div>
                </div>
            )}
        </div>
    );
}
