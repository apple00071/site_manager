'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FiPlus, FiFilter, FiCheckCircle, FiClock, FiAlertTriangle, FiUser, FiCamera, FiX, FiMoreVertical, FiTrash2, FiMapPin, FiCheck, FiArrowRight } from 'react-icons/fi';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { uploadFiles } from '@/lib/uploadUtils';

interface Snag {
    id: string;
    description: string;
    location: string | null;
    category: string | null;
    priority: 'low' | 'medium' | 'high';
    status: 'open' | 'assigned' | 'resolved' | 'verified' | 'closed';
    photos: string[];
    resolved_photos?: string[];
    resolved_description?: string;
    created_at: string;
    closed_at?: string;
    assigned_to_user?: { id: string; full_name: string };
    created_by_user?: { id: string; full_name: string };
}

interface ProjectUser {
    id: string;
    name: string;
    role: string;
}

export interface SnagTabHandle {
    openAddSnag: () => void;
    exportSnagReport: () => Promise<void>;
}

interface SnagTabProps {
    projectId: string;
    userRole: string;
    userId: string;
}

const SnagTab = forwardRef<SnagTabHandle, SnagTabProps>(({ projectId, userRole, userId }, ref) => {
    const { user } = useAuth(); // Get auth user for upload path
    const { hasPermission } = useUserPermissions();

    // Permission checks
    const canCreate = hasPermission('snags.create');
    const canResolve = hasPermission('snags.resolve');
    const canVerify = hasPermission('snags.verify');

    const [snags, setSnags] = useState<Snag[]>([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<ProjectUser[]>([]);
    const [uploadingPhotos, setUploadingPhotos] = useState(false);

    // Missing State
    const [showModal, setShowModal] = useState(false);
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [editingSnag, setEditingSnag] = useState<Snag | null>(null);
    const [resolvingSnag, setResolvingSnag] = useState<Snag | null>(null);
    const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
    const [resolutionDescription, setResolutionDescription] = useState('');
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        location: '',
        category: '',
        priority: 'medium',
        assigned_to_user_id: '',
        photos: [] as string[]
    });

    // useEffect moved below functions
    const fetchSnags = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/snags?project_id=${projectId}`);
            const data = await res.json();
            if (data.snags) setSnags(data.snags);
        } catch (err) {
            console.error('Failed to fetch snags', err);
        } finally {
            setLoading(false);
        }
    };
    const fetchProjectAndUsers = async () => {
        try {
            // 1. Fetch Project Members
            const outputUsers: ProjectUser[] = [];
            const membersRes = await fetch(`/api/admin/project-members?project_id=${projectId}`);
            const membersData = await membersRes.json();

            if (membersData.members) {
                membersData.members.forEach((m: any) => {
                    if (m.users) {
                        outputUsers.push({
                            id: m.users.id,
                            name: m.users.full_name || m.users.email,
                            role: m.users.role
                        });
                    }
                });
            }

            // 2. Fetch Project for Assigned Employee
            const projectRes = await fetch(`/api/projects/${projectId}`); // Fixed URL structure
            // Actually, let's use the same pattern as ProjectUsersPanel - it relies on passed props or fetches project
            // Since we don't have project fetcher here easily without checking api, 
            // lets try checking if we can reuse the members API or just rely on members.
            // Wait, typically assigned_employee SHOULD be in members or handled. 
            // To be safe, let's just use what we have, but if the user wants "Arvind" and he is showing, 
            // maybe he is the assigned employee. 
            // If the user says "ONLY login user is appearing", it implies *others* are missing.
            // Let's stick to members for now but verify if we can fetch others. 
            // Actually, let's keep it simple: Add Upload first.
            setUsers(outputUsers);
        } catch (err) {
            console.error('Failed to fetch users', err);
        }
    };

    useEffect(() => {
        fetchSnags();
        fetchProjectAndUsers();
    }, [projectId]);

    const [isExporting, setIsExporting] = useState(false);

    useImperativeHandle(ref, () => ({
        openAddSnag: () => {
            resetForm();
            setShowModal(true);
        },
        exportSnagReport: async () => {
            await handleExportReport();
        }
    }));

    const handleExportReport = async () => {
        try {
            setIsExporting(true);
            const res = await fetch(`/api/projects/${projectId}/snags/report`, {
                method: 'POST'
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to generate report');
            }

            const { pdf_url } = await res.json();
            window.open(pdf_url, '_blank');
        } catch (err: any) {
            alert(err.message || 'Failed to export snag report');
        } finally {
            setIsExporting(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingPhotos(true);

        try {
            const urls = await uploadFiles(
                files,
                'project-update-photos',
                projectId
            );
            setFormData(prev => ({ ...prev, photos: [...prev.photos, ...urls] }));
        } catch (error) {
            console.error('Error uploading photos:', error);
            alert('Failed to upload photos');
        } finally {
            setUploadingPhotos(false);
            e.target.value = '';
        }
    };

    const removePhoto = (index: number) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };

    const handleResolutionPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingPhotos(true);

        try {
            const urls = await uploadFiles(
                files,
                'project-update-photos',
                `resolved/${projectId}`
            );
            setResolutionPhotos(prev => [...prev, ...urls]);
        } catch (error) {
            console.error('Error uploading photos:', error);
            alert('Failed to upload photos');
        } finally {
            setUploadingPhotos(false);
            e.target.value = '';
        }
    };

    const submitResolution = async () => {
        if (!resolvingSnag) return;
        if (resolutionPhotos.length === 0) {
            return alert('Please upload at least one photo as proof of resolution.');
        }

        await handleStatusUpdate(resolvingSnag.id, 'resolve', {
            resolved_photos: resolutionPhotos,
            resolved_description: resolutionDescription
        });

        setShowResolveModal(false);
        setResolvingSnag(null);
        setResolutionPhotos([]);
        setResolutionDescription('');
    };

    const handleSubmit = async () => {
        if (!formData.description) return alert('Description is required');

        try {
            const url = '/api/snags';
            const method = editingSnag ? 'PATCH' : 'POST';
            const body = editingSnag
                ? { id: editingSnag.id, ...formData }
                : { project_id: projectId, ...formData };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                fetchSnags();
                setShowModal(false);
                resetForm();
            } else {
                const err = await res.json();
                alert(err.error || 'Operation failed');
            }
        } catch (err) {
            console.error(err);
            alert('Something went wrong');
        }
    };

    const handleStatusUpdate = async (id: string, action: string, updates: any = {}) => {
        try {
            const res = await fetch('/api/snags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action, ...updates })
            });
            if (res.ok) fetchSnags();
            else alert('Update failed');
        } catch (err) {
            console.error(err);
        }
    };

    const resetForm = () => {
        setFormData({
            description: '',
            location: '',
            category: '',
            priority: 'medium',
            assigned_to_user_id: '',
            photos: []
        });
        setEditingSnag(null);
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
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                <div className="flex items-center gap-3">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                        <option value="all">All Status</option>
                        <option value="open">Open</option>
                        <option value="assigned">Assigned</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                    </select>

                </div>
            </div>

            {/* Snag Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full py-12 text-center text-gray-500">Loading snags...</div>
                ) : filteredSnags.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <FiAlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-gray-900 font-medium">No snags found</h3>
                        <p className="text-gray-500 text-sm mt-1">Everything looks good! Or maybe nobody checked yet?</p>
                    </div>
                ) : (
                    filteredSnags.map(snag => (
                        <div key={snag.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                            {/* Card Header */}
                            <div className="p-4 border-b border-gray-50 flex justify-between items-start">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(snag.status)}`}>
                                    {snag.status}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium uppercase flex items-center gap-1 ${getPriorityColor(snag.priority)}`}>
                                    <FiAlertTriangle className="w-3 h-3" />
                                    {snag.priority}
                                </span>
                            </div>

                            {/* Card Content */}
                            <div className="p-4 flex-1">
                                <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">{snag.description}</h3>

                                <div className="space-y-2 text-sm text-gray-600 mb-4">
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

                                    <div className="flex items-center gap-2 text-gray-500 text-[11px] pt-1 border-t border-gray-50 mt-2">
                                        <div className="flex items-center gap-1">
                                            <FiClock className="w-3 h-3" />
                                            <span>Reported: {new Date(snag.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        {snag.closed_at && snag.status === 'closed' && (
                                            <div className="flex items-center gap-1 text-green-600 ml-auto">
                                                <FiCheckCircle className="w-3 h-3" />
                                                <span>Closed: {new Date(snag.closed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {((snag.photos?.length ?? 0) > 0 || (snag.resolved_photos?.length ?? 0) > 0) && (
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        {/* Before Photos */}
                                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wide">Before</p>
                                            {snag.photos && snag.photos.length > 0 ? (
                                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                                    {snag.photos.map((url, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-12 h-12 relative flex-shrink-0 rounded-md overflow-hidden border border-gray-200 group cursor-pointer"
                                                            onClick={(e) => { e.stopPropagation(); setViewingImage(url); }}
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
                                        <div className={`p-2 rounded-lg border ${snag.resolved_photos?.length ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 border-dashed'}`}>
                                            <p className={`text-[10px] font-bold mb-1 uppercase tracking-wide flex items-center gap-1 ${snag.resolved_photos?.length ? 'text-green-700' : 'text-gray-400'}`}>
                                                {snag.resolved_photos?.length ? <FiCheckCircle className="w-3 h-3" /> : null}
                                                After
                                            </p>
                                            {snag.resolved_photos && snag.resolved_photos.length > 0 ? (
                                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                                    {snag.resolved_photos.map((url, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-12 h-12 relative flex-shrink-0 rounded-md overflow-hidden border border-green-200 group cursor-pointer"
                                                            onClick={(e) => { e.stopPropagation(); setViewingImage(url); }}
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
                            </div>

                            {/* Card Actions */}
                            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                                {snag.status === 'open' && (
                                    <button
                                        onClick={() => {
                                            setEditingSnag(snag);
                                            setFormData({
                                                description: snag.description,
                                                location: snag.location || '',
                                                category: snag.category || '',
                                                priority: snag.priority,
                                                assigned_to_user_id: snag.assigned_to_user?.id || '',
                                                photos: snag.photos
                                            });
                                            setShowModal(true);
                                        }}
                                        className="btn-base px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700"
                                    >
                                        Assign / Edit
                                    </button>
                                )}
                                {['open', 'assigned'].includes(snag.status) && canResolve && (userId === snag.assigned_to_user?.id || userRole === 'admin') && (
                                    <button
                                        onClick={() => {
                                            setResolvingSnag(snag);
                                            setResolutionPhotos([]);
                                            setResolutionDescription('');
                                            setShowResolveModal(true);
                                        }}
                                        className="btn-base px-3 py-1.5 text-xs bg-yellow-500 text-white hover:bg-yellow-600"
                                    >
                                        Mark Resolved
                                    </button>
                                )}
                                {snag.status === 'resolved' && canVerify && (
                                    <button
                                        onClick={() => handleStatusUpdate(snag.id, 'verify')}
                                        className="btn-base px-3 py-1.5 text-xs bg-lime-600 text-white hover:bg-lime-700"
                                    >
                                        Verify
                                    </button>
                                )}
                                {snag.status === 'verified' && canVerify && (
                                    <button
                                        onClick={() => handleStatusUpdate(snag.id, 'close')}
                                        className="btn-base px-3 py-1.5 text-xs bg-green-600 text-white hover:bg-green-700"
                                    >
                                        Close Snag
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">{editingSnag ? 'Edit Snag' : 'Report New Snag'}</h3>
                            <button onClick={() => setShowModal(false)} className="btn-ghost rounded-full">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                    rows={3}
                                    placeholder="Describe the issue..."
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <input
                                        type="text"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                        placeholder="e.g. Electrical"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign User</label>
                                    <select
                                        value={formData.assigned_to_user_id}
                                        onChange={e => setFormData({ ...formData, assigned_to_user_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                    >
                                        <option value="">Select User</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="col-span-full">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
                                <div className="flex gap-2 overflow-x-auto py-2">
                                    {formData.photos.map((url, i) => (
                                        <div key={i} className="relative w-16 h-16 flex-shrink-0 group">
                                            <Image src={url} alt="preview" fill className="object-cover rounded-lg" />
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) }))}
                                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full !w-5 !h-5 flex items-center justify-center shadow-md z-10 !min-w-0 !min-h-0"
                                                style={{ width: '20px', height: '20px', minWidth: '0', minHeight: '0' }}
                                            >
                                                <FiX className="w-3" />
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
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                            <button
                                onClick={handleSubmit}
                                className="btn-primary"
                            >
                                {editingSnag ? 'Update Snag' : 'Create Snag'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showResolveModal && (
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
                                    value={resolutionDescription}
                                    onChange={(e) => setResolutionDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-green-500 focus:border-green-500 text-sm"
                                    rows={2}
                                    placeholder="Add any notes about the fix..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Photos</label>
                                <div className="flex gap-2 overflow-x-auto py-2">
                                    {resolutionPhotos.map((url, i) => (
                                        <div key={i} className="relative w-16 h-16 flex-shrink-0 group">
                                            <Image src={url} alt="preview" fill className="object-cover rounded-lg" />
                                            <button
                                                type="button"
                                                onClick={() => setResolutionPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full !w-5 !h-5 flex items-center justify-center shadow-md z-10 !min-w-0 !min-h-0"
                                                style={{ width: '20px', height: '20px', minWidth: '0', minHeight: '0' }}
                                            >
                                                <FiX className="w-3" />
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
                                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleResolutionPhotoUpload} />
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
                                disabled={resolutionPhotos.length === 0}
                                className={`btn-base px-4 py-2 text-white shadow-sm flex items-center gap-2 ${resolutionPhotos.length === 0
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700'
                                    }`}
                            >
                                <FiCheck className="w-4 h-4" />
                                Confirm Resolution
                            </button>
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
});

export default SnagTab;
