'use client';

import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useEffect, useState, useMemo } from 'react';
import {
    FiPlus, FiFilter, FiCheckCircle, FiClock, FiAlertTriangle, FiUser,
    FiMapPin, FiCamera, FiX, FiInfo, FiSend, FiSearch, FiChevronRight,
    FiCalendar, FiMessageSquare, FiPhone, FiLayers, FiArrowLeft
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
        <div className="flex flex-col h-full lg:h-[calc(100vh-64px)] bg-gray-50 p-4 lg:p-6 gap-4 lg:gap-6 overflow-x-hidden overflow-y-auto lg:overflow-hidden">
            {/* Top Stats Bar: Clean & Minimal */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 flex-shrink-0">
                {[
                    { label: 'Active Issues', value: stats.total, icon: FiLayers, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                    { label: 'High Priority', value: stats.high, icon: FiAlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { label: 'Pending Verification', value: stats.pending, icon: FiClock, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Resolved (Last 30d)', value: stats.closed, icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-3 lg:p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 lg:gap-4">
                        <div className={`p-2 lg:p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                            <stat.icon className="w-4 h-4 lg:w-5 lg:h-5" />
                        </div>
                        <div>
                            <p className="text-[9px] lg:text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{stat.label}</p>
                            <p className="text-lg lg:text-2xl font-bold text-gray-900">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-[500px] lg:min-h-0">
                {/* Left Sidebar: Filters & List */}
                <div className={`w-full lg:w-80 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${selectedSnag ? 'hidden lg:flex' : 'flex h-full'}`}>
                    {/* Sidebar Header & Filters */}
                    <div className="p-4 border-b border-gray-100 space-y-4 sticky top-0 bg-white z-10">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2 uppercase tracking-tight text-sm">
                                <FiLayers className="text-yellow-600" /> Issues List
                            </h2>
                            <button onClick={() => setShowModal(true)} className="p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 shadow-sm transition-all">
                                <FiPlus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search & Project Filter */}
                        <div className="space-y-3">
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search issues..."
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-yellow-500 transition-all outline-none font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    className="w-full px-2 lg:px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[10px] lg:text-xs font-bold text-gray-600 focus:bg-white focus:border-yellow-500 outline-none"
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                >
                                    <option value="all">ALL PROJECTS</option>
                                    {projectOptions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                                <select
                                    className="w-full px-2 lg:px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[10px] lg:text-xs font-bold text-gray-600 focus:bg-white focus:border-yellow-500 outline-none"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="all">STATUS</option>
                                    <option value="open">OPEN</option>
                                    <option value="assigned">ASSIGNED</option>
                                    <option value="resolved">RESOLVED</option>
                                    <option value="closed">CLOSED</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* List Content */}
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        {loading && snags.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">Loading snags...</div>
                        ) : filteredSnags.length === 0 ? (
                            <div className="p-8 text-center">
                                <FiInfo className="w-8 h-8 text-gray-100 mx-auto mb-2" />
                                <p className="text-xs font-bold text-gray-400 uppercase">No snags found</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {filteredSnags.map(snag => (
                                    <div
                                        key={snag.id}
                                        onClick={() => setSelectedSnag(snag)}
                                        className={`p-4 cursor-pointer transition-all hover:bg-gray-50 border-l-4 ${selectedSnag?.id === snag.id ? 'bg-yellow-50/50 border-yellow-500' : 'border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(snag.priority)}`}>
                                                {snag.priority} Priority
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-400">{new Date(snag.created_at).toLocaleDateString('en-GB')}</span>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900 mb-1 line-clamp-1">{snag.site_name || snag.project?.title}</p>
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">{snag.description}</p>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500 border border-white">
                                                    {snag.assigned_to_user?.full_name?.charAt(0) || <FiUser className="w-3 h-3" />}
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{snag.assigned_to_user?.full_name?.split(' ')[0] || 'Unassigned'}</span>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${getStatusColor(snag.status)}`}>
                                                {snag.status}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Pane: Clean Detail View */}
                <div className={`flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 ${!selectedSnag ? 'hidden lg:flex' : 'flex h-full'}`}>
                    {selectedSnag ? (
                        <>
                            {/* Detail Header */}
                            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/30">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            onClick={() => setSelectedSnag(null)}
                                            className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <FiArrowLeft className="w-5 h-5 text-gray-500" />
                                        </button>
                                        <h2 className="text-xl font-bold text-gray-900">{selectedSnag.site_name || selectedSnag.project?.title || 'General Site Issue'}</h2>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(selectedSnag.status)}`}>
                                            {selectedSnag.status}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 font-medium">
                                        <span className="flex items-center gap-1.5"><FiCalendar className="w-3.5 h-3.5 text-yellow-600" /> {new Date(selectedSnag.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        <span className="flex items-center gap-1.5"><FiMapPin className="w-3.5 h-3.5" /> {selectedSnag.location || 'Site Location'}</span>
                                        <span className="flex items-center gap-1.5"><FiUser className="w-3.5 h-3.5 text-yellow-600" /> CLIENT: {selectedSnag.client_name || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {selectedSnag.customer_phone && (
                                        <a href={`tel:${selectedSnag.customer_phone}`} className="p-2.5 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 transition-colors border border-yellow-100 shadow-sm">
                                            <FiPhone className="w-5 h-5" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Detail Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                                {/* Issue Description */}
                                <section>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Issue Description</h3>
                                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                        <p className="text-gray-700 leading-relaxed font-medium">
                                            {selectedSnag.description}
                                        </p>
                                    </div>
                                </section>

                                {/* Photo Gallery */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <section>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Before Resolution</h3>
                                        {selectedSnag.photos && selectedSnag.photos.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                {selectedSnag.photos.map((url, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => { setViewingImage(url); }}
                                                        className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in group relative"
                                                    >
                                                        <Image src={url} alt="Before" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                            <FiSearch className="text-white opacity-0 group-hover:opacity-100 w-6 h-6" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                                                <FiCamera className="w-8 h-8 mb-2 opacity-20" />
                                                <span className="text-xs font-bold uppercase tracking-wider">No photos attached</span>
                                            </div>
                                        )}
                                    </section>
                                    <section>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Resolution Proof</h3>
                                        {selectedSnag.resolved_photos && selectedSnag.resolved_photos.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                {selectedSnag.resolved_photos.map((url, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => { setViewingImage(url); }}
                                                        className="aspect-square rounded-xl overflow-hidden border border-emerald-100 cursor-zoom-in group relative"
                                                    >
                                                        <Image src={url} alt="Proof" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                                        <div className="absolute inset-0 bg-emerald-600/0 group-hover:bg-emerald-600/10 transition-colors flex items-center justify-center">
                                                            <FiCheckCircle className="text-white opacity-0 group-hover:opacity-100 w-6 h-6" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                                                <FiCheckCircle className="w-8 h-8 mb-2 opacity-20" />
                                                <span className="text-xs font-bold uppercase tracking-wider">Awaiting resolution</span>
                                            </div>
                                        )}
                                    </section>
                                </div>

                                {/* Timeline Section */}
                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Site Progress Timeline</h3>
                                        <button
                                            onClick={() => setShowFollowUpModal(true)}
                                            className="px-3 py-1.5 text-[10px] font-bold text-yellow-600 bg-yellow-50 rounded-lg border border-yellow-100 hover:bg-yellow-100 transition-colors uppercase tracking-wider"
                                        >
                                            Add Update
                                        </button>
                                    </div>
                                    <SnagTimeline items={selectedSnag ? generateTimeline(selectedSnag) : []} />
                                </section>
                            </div>

                            {/* Action Bar */}
                            <div className="p-4 bg-white border-t border-gray-100">
                                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center font-bold text-yellow-700 border border-yellow-200">
                                            {selectedSnag.assigned_to_user?.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">Current Assignee</p>
                                            <p className="text-sm font-bold text-gray-900">{selectedSnag.assigned_to_user?.full_name || 'Unassigned'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        {['open', 'assigned'].includes(selectedSnag.status) && canResolve && (user?.id === selectedSnag.assigned_to_user?.id || isAdmin) && (
                                            <button
                                                onClick={() => { setResolveData({ description: '', photos: [] }); setShowResolveModal(true); }}
                                                className="px-6 py-2.5 bg-yellow-500 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-yellow-600 transition-all flex items-center gap-2"
                                            >
                                                <FiCheckCircle className="w-4 h-4" />
                                                Mark as Resolved
                                            </button>
                                        )}
                                        {selectedSnag.status === 'resolved' && canVerify && (
                                            <>
                                                <button onClick={() => handleUpdateStatus('reopen')} className="px-6 py-2.5 bg-white text-rose-600 text-sm font-bold rounded-xl border-2 border-rose-100 hover:bg-rose-50 hover:border-rose-200 transition-all border-none">REOPEN ISSUE</button>
                                                <button onClick={() => handleUpdateStatus('close')} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-2">
                                                    <FiCheckCircle className="w-4 h-4" />
                                                    Verify & Close
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="m-auto text-center p-12">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                <FiInfo className="w-8 h-8 text-gray-300" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Select a snag</h2>
                            <p className="text-sm text-gray-500 max-w-xs mx-auto">Click on a snag from the list to view its details, photos, and progress history.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Raise Snag Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col relative border border-gray-100">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Report Site Issue</h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6 overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Site Name</label>
                                        <input type="text" value={formData.site_name} onChange={e => setFormData({ ...formData, site_name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-yellow-500 outline-none transition-all text-sm font-medium" placeholder="e.g. Skyline 4B" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Priority</label>
                                        <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-yellow-500 outline-none transition-all text-sm font-medium">
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-yellow-500 outline-none transition-all text-sm font-medium" rows={3} placeholder="Describe the problem..." />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assign Member</label>
                                        <select value={formData.assigned_to_user_id} onChange={e => setFormData({ ...formData, assigned_to_user_id: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-yellow-500 outline-none transition-all text-sm font-medium">
                                            <option value="">Unassigned</option>
                                            {projectUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location</label>
                                        <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-yellow-500 outline-none transition-all text-sm font-medium" placeholder="e.g. Master Bedroom" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Photos</label>
                                    <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar">
                                        {formData.photos.map((url, i) => (
                                            <div key={i} className="relative w-20 h-20 shrink-0">
                                                <Image src={url} alt="preview" fill className="object-cover rounded-lg border border-gray-100" />
                                                <button onClick={() => setFormData(p => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }))} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg"><FiX className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ))}
                                        <label className="w-20 h-20 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-yellow-500 hover:bg-yellow-50 transition-all shrink-0">
                                            {uploadingPhotos ? <div className="animate-spin w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full" /> : <FiCamera className="w-6 h-6 text-gray-300" />}
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e)} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
                                <button
                                    onClick={handleSubmitNewSnag}
                                    disabled={!formData.description || uploadingPhotos}
                                    className="px-6 py-2 bg-yellow-500 text-white rounded-lg font-bold text-sm shadow-sm hover:bg-yellow-600 disabled:opacity-50 transition-all"
                                >
                                    Create Snag
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Resolve Modal */}
            {
                showResolveModal && selectedSnag && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowResolveModal(false)} />
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 relative">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 uppercase">Resolve Snag</h3>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resolution Summary</label>
                                    <textarea value={resolveData.description} onChange={e => setResolveData(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-yellow-500 outline-none text-sm font-medium" rows={3} placeholder="Describe the resolution..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Proof Photos</label>
                                    <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar">
                                        {resolveData.photos.map((url, i) => (
                                            <div key={i} className="relative w-20 h-20 shrink-0">
                                                <Image src={url} alt="proof" fill className="object-cover rounded-lg border border-gray-100" />
                                                <button onClick={() => setResolveData(p => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }))} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center"><FiX className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ))}
                                        <label className="w-20 h-20 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-yellow-500 transition-all shrink-0">
                                            {uploadingPhotos ? <div className="animate-spin w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full" /> : <FiCamera className="w-6 h-6 text-gray-300" />}
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, true)} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-2">
                                <button
                                    onClick={() => handleUpdateStatus('resolve')}
                                    disabled={resolving || !resolveData.description || resolveData.photos.length === 0}
                                    className="w-full py-3 bg-yellow-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-yellow-700 disabled:opacity-50 transition-all"
                                >
                                    {resolving ? 'Submitting...' : 'Mark as Resolved'}
                                </button>
                                <button onClick={() => setShowResolveModal(false)} className="py-2 text-xs font-semibold text-gray-400">Cancel</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Follow Up Modal */}
            {
                showFollowUpModal && selectedSnag && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowFollowUpModal(false)} />
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 relative">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 uppercase">Add Update</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <textarea
                                    value={followUpNote}
                                    onChange={e => setFollowUpNote(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-yellow-500 outline-none text-sm font-medium"
                                    rows={4}
                                    placeholder="E.g. Materials ordered, work started..."
                                />
                            </div>
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-2">
                                <button
                                    onClick={handlePostFollowUp}
                                    disabled={resolving || !followUpNote}
                                    className="w-full py-3 bg-yellow-500 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-yellow-600 transition-all"
                                >
                                    {resolving ? 'Posting...' : 'Confirm Update'}
                                </button>
                                <button onClick={() => setShowFollowUpModal(false)} className="py-2 text-xs font-semibold text-gray-400">Cancel</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Photo Viewer */}
            {
                viewingImage && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setViewingImage(null)}>
                        <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
                            <FiX className="w-8 h-8" />
                        </button>
                        <div className="relative w-full max-w-5xl h-full max-h-[85vh]">
                            <Image src={viewingImage} alt="Full view" fill className="object-contain" quality={100} />
                        </div>
                    </div>
                )
            }
        </div>
    );
}
