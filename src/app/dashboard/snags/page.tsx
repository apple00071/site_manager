'use client';

import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import { useEffect, useState } from 'react';
import { FiPlus, FiFilter, FiCheckCircle, FiAlertTriangle, FiUser, FiMapPin, FiCamera, FiX, FiInfo } from 'react-icons/fi';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';

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
    customer_phone?: string | null;
    project?: { id: string; title: string };
    assigned_to_user?: { id: string; full_name: string };
    created_at: string;
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
    const { hasPermission } = useUserPermissions();

    // Permission checks
    const canResolve = hasPermission('snags.resolve');
    const canVerify = hasPermission('snags.verify');

    const [snags, setSnags] = useState<Snag[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Detail Modal State
    const [selectedSnag, setSelectedSnag] = useState<Snag | null>(null);
    const [resolveData, setResolveData] = useState({ description: '', photos: [] as string[] });
    const [resolving, setResolving] = useState(false);

    // Resolve Modal State (separate from details modal)
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [resolvingSnag, setResolvingSnag] = useState<Snag | null>(null);

    // Raise Snag Modal State
    const [showModal, setShowModal] = useState(false);
    const [projects, setProjects] = useState<ProjectOption[]>([]);
    const [projectUsers, setProjectUsers] = useState<UserOption[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);

    // Raise Snag Form State
    const [formData, setFormData] = useState({
        project_id: '',
        site_name: '',
        customer_phone: '',
        description: '',
        location: '',
        category: '',
        priority: 'medium',
        assigned_to_user_id: '',
        photos: [] as string[]
    });
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    const searchParams = useSearchParams();
    const snagIdParam = searchParams?.get('snagId');

    useEffect(() => {
        setTitle('Snag List');
        setSubtitle('');
        fetchGlobalSnags();
    }, []);

    useEffect(() => {
        if (snagIdParam && snags.length > 0) {
            const snag = snags.find(s => s.id === snagIdParam);
            if (snag) {
                console.log('🎯 Deep linking to snag:', snag.id);
                handleSnagClick(snag);
            }
        }
    }, [snagIdParam, snags]);

    const handleSnagClick = (snag: Snag) => {
        if (snag.project_id && snag.project_id !== 'null') {
            router.push(`/dashboard/projects/${snag.project_id}?stage=snag`);
        } else {
            setSelectedSnag(snag);
            setResolveData({ description: '', photos: [] });
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedSnag) return;
        setResolving(true);
        try {
            const payload: any = { id: selectedSnag.id, action: status };
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
                fetchGlobalSnags();
                setSelectedSnag(null);
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to update status');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to update status');
        } finally {
            setResolving(false);
        }
    };

    const handleResolvePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingPhotos(true); // Reuse same loading state
        const uploadedUrls: string[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `resolved/${Date.now()}_${i}.${fileExt}`;

                const { error } = await supabase.storage
                    .from('project-update-photos')
                    .upload(fileName, file);

                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage
                    .from('project-update-photos')
                    .getPublicUrl(fileName);

                uploadedUrls.push(publicUrl);
            }
            setResolveData(prev => ({ ...prev, photos: [...prev.photos, ...uploadedUrls] }));
        } catch (error) {
            console.error('Error uploading photos:', error);
            alert('Failed to upload photos');
        } finally {
            setUploadingPhotos(false);
        }
    };

    const handleQuickStatusUpdate = async (snagId: string, action: string) => {
        try {
            const res = await fetch('/api/snags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: snagId, action })
            });
            if (res.ok) {
                fetchGlobalSnags();
            } else {
                const err = await res.json();
                alert(err.error || 'Update failed');
            }
        } catch (err) {
            console.error(err);
            alert('Update failed');
        }
    };

    const submitResolution = async () => {
        if (!resolvingSnag) return;
        if (resolveData.photos.length === 0) {
            return alert('Please upload at least one photo as proof of resolution.');
        }

        setResolving(true);
        try {
            const res = await fetch('/api/snags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: resolvingSnag.id,
                    action: 'resolve',
                    resolved_photos: resolveData.photos,
                    resolved_description: resolveData.description
                })
            });

            if (res.ok) {
                fetchGlobalSnags();
                setShowResolveModal(false);
                setResolvingSnag(null);
                setResolveData({ description: '', photos: [] });
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to resolve snag');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to resolve snag');
        } finally {
            setResolving(false);
        }
    };

    // ... existing handlers ...

    const fetchGlobalSnags = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/snags?all=true');
            const data = await res.json();
            if (data.snags) {
                setSnags(data.snags);
            }
        } catch (err) {
            console.error('Failed to fetch snags', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            setLoadingProjects(true);
            const res = await fetch('/api/admin/projects');
            const data = await res.json();
            if (Array.isArray(data)) {
                setProjects(data.map((p: any) => ({ id: p.id, title: p.title })));
            } else if (data.projects) {
                setProjects(data.projects.map((p: any) => ({ id: p.id, title: p.title })));
            }
        } catch (err) {
            console.error('Failed to fetch projects', err);
        } finally {
            setLoadingProjects(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await fetch(`/api/admin/users`);
            const data = await res.json();

            if (Array.isArray(data)) {
                const users = data.map((u: any) => ({
                    id: u.id,
                    name: u.full_name || u.email
                }));
                setProjectUsers(users);
            }
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    };

    // fetchProjectUsers is now obsolete in this global view since we use fetchAllUsers
    // but we can keep it for now if other parts of the system need it.

    const handleOpenModal = () => {
        // fetchProjects(); // No longer needed for global snag unless we want a hidden fallback
        fetchAllUsers();
        setShowModal(true);
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const basePath = formData.project_id || 'general';

        setUploadingPhotos(true);
        const uploadedUrls: string[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${basePath}/${Date.now()}_${i}.${fileExt}`;

                const { error } = await supabase.storage
                    .from('project-update-photos')
                    .upload(fileName, file);

                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage
                    .from('project-update-photos')
                    .getPublicUrl(fileName);

                uploadedUrls.push(publicUrl);
            }
            setFormData(prev => ({ ...prev, photos: [...prev.photos, ...uploadedUrls] }));
        } catch (error) {
            console.error('Error uploading photos:', error);
            alert('Failed to upload photos');
        } finally {
            setUploadingPhotos(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.description) return alert('Description is required');

        try {
            const payload = {
                ...formData,
                project_id: formData.project_id || null,
                assigned_to_user_id: formData.assigned_to_user_id || null
            };

            const res = await fetch('/api/snags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchGlobalSnags();
                setShowModal(false);
                setFormData({
                    project_id: '',
                    site_name: '',
                    customer_phone: '',
                    description: '',
                    location: '',
                    category: '',
                    priority: 'medium',
                    assigned_to_user_id: '',
                    photos: []
                });
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to create snag');
            }
        } catch (err) {
            console.error(err);
            alert('Something went wrong');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-red-100 text-red-700';
            case 'assigned': return 'bg-blue-100 text-blue-700';
            case 'resolved': return 'bg-yellow-100 text-yellow-700';
            case 'verified': return 'bg-lime-100 text-lime-700';
            case 'closed': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'text-red-500 bg-red-50';
            case 'medium': return 'text-orange-500 bg-orange-50';
            case 'low': return 'text-blue-500 bg-blue-50';
            default: return 'text-gray-500 bg-gray-50';
        }
    };

    const filteredSnags = snags.filter(s => filterStatus === 'all' || s.status === filterStatus);

    return (
        <div className="space-y-6 pb-10">
            {/* ... controls ... */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2">
                    <FiFilter className="text-gray-400" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer"
                    >
                        <option value="all">All Status</option>
                        <option value="open">Open</option>
                        <option value="assigned">Assigned</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
                <button
                    onClick={handleOpenModal}
                    className="btn-primary flex items-center gap-2"
                >
                    <FiPlus className="w-4 h-4" />
                    Raise Snag
                </button>
            </div>

            {/* Snag List */}
            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : filteredSnags.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                    <FiAlertTriangle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No snags found</h3>
                    <p className="text-gray-500">Good job! Or get to work...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSnags.map(snag => (
                        <div
                            key={snag.id}
                            onClick={() => handleSnagClick(snag)}
                            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col h-full overflow-hidden"
                        >
                            {/* Card Header */}
                            <div className="p-4 border-b border-gray-50 flex justify-between items-start">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(snag.status)}`}>
                                    {snag.status}
                                </span>
                                <div className="flex gap-2">
                                    {snag.site_name && (
                                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded truncate max-w-[120px]" title={snag.site_name}>
                                            {snag.site_name}
                                        </span>
                                    )}
                                    {snag.project && !snag.site_name && (
                                        <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded truncate max-w-[100px]" title={snag.project.title}>
                                            {snag.project.title}
                                        </span>
                                    )}
                                    <span className={`px-2 py-1 rounded text-xs font-medium uppercase flex items-center gap-1 ${getPriorityColor(snag.priority)}`}>
                                        <FiAlertTriangle className="w-3 h-3" />
                                        {snag.priority}
                                    </span>
                                </div>
                            </div>

                            {/* Card Content */}
                            <div className="p-4 flex-1">
                                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">{snag.description}</h3>

                                <div className="space-y-2 text-sm text-gray-600 mb-4">
                                    {snag.customer_phone && (
                                        <div className="flex items-center gap-2">
                                            <FiInfo className="w-4 h-4 text-blue-400" />
                                            <span>Client: <span className="font-medium text-gray-900">{snag.customer_phone}</span></span>
                                        </div>
                                    )}
                                    {snag.location && (
                                        <div className="flex items-center gap-2">
                                            <FiMapPin className="w-4 h-4 text-gray-400" />
                                            <span>{snag.location}</span>
                                        </div>
                                    )}
                                    {snag.assigned_to_user ? (
                                        <div className="flex items-center gap-2">
                                            <FiUser className="w-4 h-4 text-gray-400" />
                                            <span>Assigned to: <span className="font-medium text-gray-900">{snag.assigned_to_user.full_name}</span></span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-red-500">
                                            <FiUser className="w-4 h-4" />
                                            <span className="italic">Unassigned</span>
                                        </div>
                                    )}
                                </div>

                                {((snag.photos?.length ?? 0) > 0 || (snag.resolved_photos?.length ?? 0) > 0) && (
                                    <div className="grid grid-cols-2 gap-3 mt-auto">
                                        {/* Before Photos */}
                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Before</p>
                                            {snag.photos && snag.photos.length > 0 ? (
                                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                                    {snag.photos.slice(0, 3).map((url, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-10 h-10 relative flex-shrink-0 rounded overflow-hidden border border-gray-200"
                                                        >
                                                            <Image src={url} alt="snag" fill className="object-cover" />
                                                        </div>
                                                    ))}
                                                    {snag.photos.length > 3 && (
                                                        <div className="w-10 h-10 flex items-center justify-center bg-gray-200 text-xs font-medium text-gray-600 rounded">
                                                            +{snag.photos.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="h-10 flex items-center justify-center text-[10px] text-gray-400 italic">No photos</div>
                                            )}
                                        </div>

                                        {/* After Photos */}
                                        <div className={`p-2 rounded-lg border ${snag.resolved_photos?.length ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 border-dashed'}`}>
                                            <p className={`text-[10px] font-bold mb-1 uppercase tracking-wide flex items-center gap-1 ${snag.resolved_photos?.length ? 'text-green-700' : 'text-gray-400'}`}>
                                                {snag.resolved_photos?.length ? <FiCheckCircle className="w-3 h-3" /> : null}
                                                After
                                            </p>
                                            {snag.resolved_photos && snag.resolved_photos.length > 0 ? (
                                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                                    {snag.resolved_photos.slice(0, 3).map((url, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-10 h-10 relative flex-shrink-0 rounded overflow-hidden border border-green-200"
                                                        >
                                                            <Image src={url} alt="resolved" fill className="object-cover" />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="h-10 flex items-center justify-center text-[10px] text-gray-400 italic">Pending</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Card Actions */}
                            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                                {snag.status === 'assigned' && canResolve && user?.id === snag.assigned_to_user?.id && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setResolvingSnag(snag);
                                            setResolveData({ description: '', photos: [] });
                                            setShowResolveModal(true);
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                                    >
                                        Mark Resolved
                                    </button>
                                )}
                                {snag.status === 'resolved' && canVerify && (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickStatusUpdate(snag.id, 'reopen');
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                        >
                                            Reopen
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickStatusUpdate(snag.id, 'close');
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                        >
                                            Verify & Close
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Raise Snag Modal - Existing ... */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-lg font-bold text-gray-900">Raise New Snag</h3>
                            <button onClick={() => setShowModal(false)} className="btn-ghost rounded-full">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Site Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.site_name}
                                        onChange={e => setFormData({ ...formData, site_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                        placeholder="e.g. Skyline Apartments"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                                    <input
                                        type="text"
                                        value={formData.customer_phone}
                                        onChange={e => setFormData({ ...formData, customer_phone: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                        placeholder="e.g. 9876543210"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                        rows={3}
                                        placeholder="What's the issue?"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                        <input
                                            type="text"
                                            value={formData.location}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                            placeholder="e.g. Master Bedroom"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                        <select
                                            value={formData.priority}
                                            onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                                    <select
                                        value={formData.assigned_to_user_id}
                                        onChange={e => setFormData({ ...formData, assigned_to_user_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                    >
                                        <option value="">Unassigned</option>
                                        {projectUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
                                    <div className="flex gap-2 overflow-x-auto py-2">
                                        {formData.photos.map((url, i) => (
                                            <div key={i} className="relative w-16 h-16 flex-shrink-0 group">
                                                <Image src={url} alt="preview" fill className="object-cover rounded-lg" />
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(p => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }))}
                                                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full !w-5 !h-5 flex items-center justify-center shadow-md z-10 !min-w-0 !min-h-0"
                                                    style={{ width: '20px', height: '20px', minWidth: '0', minHeight: '0' }}
                                                >
                                                    <FiX className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-yellow-500 hover:bg-yellow-50 transition-colors">
                                            {uploadingPhotos ? (
                                                <div className="animate-spin w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full" />
                                            ) : (
                                                <>
                                                    <FiCamera className="w-6 h-6 text-gray-400" />
                                                    <span className="text-[10px] text-gray-500 mt-1">Add</span>
                                                </>
                                            )}
                                            <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 z-10">
                            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                            <button
                                onClick={handleSubmit}
                                disabled={!formData.description}
                                className="btn-primary"
                            >
                                Create Snag
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dedicated Resolve Snag Modal */}
            {showResolveModal && resolvingSnag && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Resolve Snag</h3>
                            <button onClick={() => setShowResolveModal(false)} className="btn-ghost rounded-full">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex items-start gap-2">
                                <FiCheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">Proof of Resolution Required</p>
                                    <p className="mt-1 opacity-90">Please upload photos showing the completed work before marking this snag as resolved.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Note (Optional)</label>
                                <textarea
                                    value={resolveData.description}
                                    onChange={(e) => setResolveData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-green-500 focus:border-green-500 text-sm"
                                    rows={2}
                                    placeholder="Add any notes about the fix..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Photos</label>
                                <div className="flex gap-2 overflow-x-auto py-2">
                                    {resolveData.photos.map((url, i) => (
                                        <div key={i} className="relative w-16 h-16 flex-shrink-0 group">
                                            <Image src={url} alt="preview" fill className="object-cover rounded-lg" />
                                            <button
                                                type="button"
                                                onClick={() => setResolveData(prev => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) }))}
                                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full !w-5 !h-5 flex items-center justify-center shadow-md z-10 !min-w-0 !min-h-0"
                                                style={{ width: '20px', height: '20px', minWidth: '0', minHeight: '0' }}
                                            >
                                                <FiX className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                                        {uploadingPhotos ? (
                                            <div className="animate-spin w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full" />
                                        ) : (
                                            <>
                                                <FiCamera className="w-6 h-6 text-gray-400" />
                                                <span className="text-[10px] text-gray-500 mt-1">Add</span>
                                            </>
                                        )}
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleResolvePhotoUpload} />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowResolveModal(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitResolution}
                                disabled={resolveData.photos.length === 0 || resolving}
                                className={`px-4 py-2 text-white shadow-sm rounded-lg flex items-center gap-2 ${resolveData.photos.length === 0 || resolving
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700'
                                    }`}
                            >
                                <FiCheckCircle className="w-4 h-4" />
                                {resolving ? 'Resolving...' : 'Confirm Resolution'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View/Resolve Snag Modal */}
            {selectedSnag && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getStatusColor(selectedSnag.status)}`}>
                                    {selectedSnag.status}
                                </span>
                                <h3 className="text-lg font-bold text-gray-900 mt-1">Snag Details</h3>
                            </div>
                            <button onClick={() => setSelectedSnag(null)} className="btn-ghost rounded-full">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500 mb-1">Description</h4>
                                    <p className="text-gray-900">{selectedSnag.description}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500 mb-1">Location</h4>
                                    <p className="text-gray-900">{selectedSnag.location || 'N/A'}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500 mb-1">Assigned To</h4>
                                    <p className="text-gray-900">{selectedSnag.assigned_to_user?.full_name || 'Unassigned'}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500 mb-1">Priority</h4>
                                    <p className="text-gray-900 capitalize">{selectedSnag.priority}</p>
                                </div>
                            </div>

                            {/* Photos */}
                            {((selectedSnag.photos?.length ?? 0) > 0 || (selectedSnag.resolved_photos?.length ?? 0) > 0) && (
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    {/* Before Photos */}
                                    <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Before</p>
                                        {selectedSnag.photos && selectedSnag.photos.length > 0 ? (
                                            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                                {selectedSnag.photos.map((url, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-16 h-16 relative flex-shrink-0 rounded-md overflow-hidden border border-gray-200 group cursor-pointer"
                                                        onClick={() => setViewingImage(url)}
                                                    >
                                                        <Image src={url} alt="snag" fill className="object-cover transition-transform group-hover:scale-110" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="h-12 flex items-center justify-center text-xs text-gray-400 italic">No photos</div>
                                        )}
                                    </div>

                                    {/* After Photos */}
                                    <div className={`p-2 rounded-lg border ${selectedSnag.resolved_photos?.length ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 border-dashed'}`}>
                                        <p className={`text-[10px] font-bold mb-1 uppercase tracking-wide flex items-center gap-1 ${selectedSnag.resolved_photos?.length ? 'text-green-700' : 'text-gray-400'}`}>
                                            {selectedSnag.resolved_photos?.length ? <FiCheckCircle className="w-3 h-3" /> : null}
                                            After
                                        </p>
                                        {selectedSnag.resolved_photos && selectedSnag.resolved_photos.length > 0 ? (
                                            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                                {selectedSnag.resolved_photos.map((url, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-16 h-16 relative flex-shrink-0 rounded-md overflow-hidden border border-green-200 group cursor-pointer"
                                                        onClick={() => setViewingImage(url)}
                                                    >
                                                        <Image src={url} alt="resolved" fill className="object-cover transition-transform group-hover:scale-110" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="h-12 flex items-center justify-center text-xs text-gray-400 italic">Pending</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Resolution Form (if open/assigned) */}
                            {['open', 'assigned'].includes(selectedSnag.status) && (
                                <div className="border-t border-gray-100 pt-6 mt-6">
                                    <h4 className="font-bold text-gray-900 mb-4">Resolve Snag</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
                                            <textarea
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                                rows={3}
                                                placeholder="Describe how the snag was fixed..."
                                                value={resolveData.description}
                                                onChange={e => setResolveData(prev => ({ ...prev, description: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">After Photos</label>
                                            <div className="flex gap-2 overflow-x-auto py-2">
                                                {resolveData.photos.map((url, i) => (
                                                    <div key={i} className="relative w-16 h-16 flex-shrink-0 group">
                                                        <Image src={url} alt="preview" fill className="object-cover rounded-lg" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setResolveData(p => ({ ...p, photos: p.photos.filter((_, idx) => idx !== i) }))}
                                                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full !w-5 !h-5 flex items-center justify-center shadow-md z-10 !min-w-0 !min-h-0"
                                                            style={{ width: '20px', height: '20px', minWidth: '0', minHeight: '0' }}
                                                        >
                                                            <FiX className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-yellow-500 hover:bg-yellow-50 transition-colors">
                                                    {uploadingPhotos ? (
                                                        <div className="animate-spin w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full" />
                                                    ) : (
                                                        <>
                                                            <FiCamera className="w-6 h-6 text-gray-400" />
                                                            <span className="text-[10px] text-gray-500 mt-1">Add</span>
                                                        </>
                                                    )}
                                                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleResolvePhotoUpload} />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => handleUpdateStatus('resolve')}
                                                disabled={resolving || !resolveData.description}
                                                className="btn-primary"
                                            >
                                                {resolving ? 'Resolving...' : 'Mark as Resolved'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Verify/Close Actions (if resolved) */}
                            {selectedSnag.status === 'resolved' && (
                                <div className="border-t border-gray-100 pt-6 mt-6 flex justify-end gap-3">
                                    <button
                                        onClick={() => handleUpdateStatus('reopen')}
                                        disabled={resolving}
                                        className="btn-secondary text-red-600 hover:bg-red-50 border-red-200"
                                    >
                                        Reopen
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus('close')}
                                        disabled={resolving}
                                        className="btn-primary bg-green-600 hover:bg-green-700 border-green-600"
                                    >
                                        Verify & Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {viewingImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <button
                        onClick={() => setViewingImage(null)}
                        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                    >
                        <FiX className="w-8 h-8" />
                    </button>
                    <div className="relative w-full max-w-4xl h-full max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <Image
                            src={viewingImage}
                            alt="Full size"
                            fill
                            className="object-contain"
                            quality={100}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
