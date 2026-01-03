'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { SidePanel } from '@/components/ui/SidePanel';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ImageModal } from '@/components/ui/ImageModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateReadable, getTodayDateString, formatDateTimeIST } from '@/lib/dateUtils';
import { FiPlus, FiCalendar, FiUsers, FiUser, FiPhone, FiImage, FiMoreVertical, FiEdit2, FiTrash2, FiCheckCircle, FiX, FiCheckSquare, FiLoader } from 'react-icons/fi';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface SiteLog {
    id: string;
    log_date: string;
    work_description: string;
    work_start_date?: string;
    estimated_completion_date?: string;
    actual_completion_date?: string;
    labor_count?: number;
    main_worker_name?: string;
    main_worker_phone?: string;
    photos?: string[];
    status?: 'in_progress' | 'completed';
    creator?: {
        full_name: string;
        email: string;
    };
    created_at: string;
}

export interface SiteLogTabHandle {
    openAddLog: () => void;
}

interface SiteLogTabProps {
    projectId: string;
}

export const SiteLogTab = forwardRef<SiteLogTabHandle, SiteLogTabProps>(({ projectId }, ref) => {
    const { user } = useAuth();
    const { hasPermission } = useUserPermissions();
    const [logs, setLogs] = useState<SiteLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPanelOpen, setIsPanelOpen] = useState(false); // Controls both SidePanel and BottomSheet
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Menu State
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Image Modal State
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [modalImages, setModalImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Edit Mode State
    const [editingLogId, setEditingLogId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        log_date: getTodayDateString(),
        work_description: '',
        work_start_date: '',
        estimated_completion_date: '',
        actual_completion_date: '',
        labor_count: 0,
        main_worker_name: '',
        main_worker_phone: '',
        photos: [] as string[],
        status: 'in_progress' as 'in_progress' | 'completed'
    });

    useImperativeHandle(ref, () => ({
        openAddLog: () => openNewLog()
    }));

    useEffect(() => {
        fetchLogs();
        checkMobile();
        window.addEventListener('resize', checkMobile);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('resize', checkMobile);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [projectId]);

    // Auto-set actual completion date when status changes to completed
    useEffect(() => {
        if (formData.status === 'completed' && !formData.actual_completion_date) {
            setFormData(prev => ({ ...prev, actual_completion_date: getTodayDateString() }));
        } else if (formData.status === 'in_progress') {
            setFormData(prev => ({ ...prev, actual_completion_date: '' }));
        }
    }, [formData.status]);

    const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setActiveMenuId(null);
        }
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/site-logs?project_id=${projectId}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            setIsUploading(true);
            const uploadPromises = Array.from(files).map(async (file, i) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `${user?.id}/${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('project-update-photos')
                    .upload(fileName, file);

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    return null;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('project-update-photos')
                    .getPublicUrl(fileName);
                return publicUrl;
            });

            const results = await Promise.all(uploadPromises);
            const successfulUploads = results.filter((url): url is string => url !== null);

            if (successfulUploads.length < files.length) {
                alert(`Successfully uploaded ${successfulUploads.length} of ${files.length} images.`);
            }

            setFormData(prev => ({ ...prev, photos: [...prev.photos, ...successfulUploads] }));
        } catch (error) {
            console.error('Error handling uploads:', error);
            alert('An error occurred while uploading images.');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleEdit = (log: SiteLog) => {
        setEditingLogId(log.id);
        setFormData({
            log_date: log.log_date,
            work_description: log.work_description,
            work_start_date: log.work_start_date || '',
            estimated_completion_date: log.estimated_completion_date || '',
            actual_completion_date: log.actual_completion_date || '',
            labor_count: log.labor_count || 0,
            main_worker_name: log.main_worker_name || '',
            main_worker_phone: log.main_worker_phone || '',
            photos: log.photos || [],
            status: log.status || 'in_progress'
        });
        setIsPanelOpen(true);
        setActiveMenuId(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this log?')) return;
        try {
            const res = await fetch(`/api/site-logs?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            setLogs(prev => prev.filter(l => l.id !== id));
        } catch (err) {
            alert('Failed to delete log');
        }
        setActiveMenuId(null);
    };

    const openNewLog = () => {
        setEditingLogId(null);
        setFormData({
            log_date: getTodayDateString(),
            work_description: '',
            work_start_date: '',
            estimated_completion_date: '',
            actual_completion_date: '',
            labor_count: 0,
            main_worker_name: '',
            main_worker_phone: '',
            photos: [],
            status: 'in_progress'
        });
        setIsPanelOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.work_description.trim()) {
            alert('Please enter a work description');
            return;
        }

        try {
            setIsSubmitting(true);
            const method = editingLogId ? 'PATCH' : 'POST';
            const body = {
                project_id: projectId,
                ...formData,
                ...(editingLogId ? { id: editingLogId } : {})
            };

            const res = await fetch('/api/site-logs', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save log');
            }

            const { log } = await res.json();

            if (editingLogId) {
                setLogs(prev => prev.map(l => l.id === log.id ? log : l));
            } else {
                setLogs(prev => [log, ...prev]);
            }

            if (!editingLogId) fetchLogs();

            setIsPanelOpen(false);

        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const openImageModal = (images: string[], index: number) => {
        setModalImages(images);
        setCurrentImageIndex(index);
        setIsImageModalOpen(true);
    };

    // Form Content reused for both Panel and BottomSheet
    const FormContent = (
        <div className="space-y-6 pb-20 md:pb-0">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                >
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                </select>
            </div>

            {formData.status === 'completed' && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-green-800 mb-1 flex items-center gap-2">
                        <FiCheckSquare /> Actual Completion Date
                    </label>
                    <input
                        type="date"
                        value={formData.actual_completion_date}
                        onChange={(e) => setFormData({ ...formData, actual_completion_date: e.target.value })}
                        className="w-full border border-green-200 rounded-lg p-2 focus:ring-2 focus:ring-green-500 outline-none bg-white"
                    />
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Description <span className="text-red-500">*</span></label>
                <textarea
                    value={formData.work_description}
                    onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                    rows={4}
                    placeholder="Describe what happened on site today..."
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Start Date</label>
                    <input
                        type="date"
                        value={formData.work_start_date}
                        onChange={(e) => setFormData({ ...formData, work_start_date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Est. Completion</label>
                    <input
                        type="date"
                        value={formData.estimated_completion_date}
                        onChange={(e) => setFormData({ ...formData, estimated_completion_date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                    />
                </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiUsers className="text-gray-500" /> Labor Details
                </h4>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Workers (Count)</label>
                        <input
                            type="number"
                            min="0"
                            value={formData.labor_count}
                            onChange={(e) => setFormData({ ...formData, labor_count: parseInt(e.target.value) || 0 })}
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Main Worker Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Ramesh"
                                value={formData.main_worker_name}
                                onChange={(e) => setFormData({ ...formData, main_worker_name: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Worker Phone</label>
                            <input
                                type="tel"
                                placeholder="e.g. 9876543210"
                                value={formData.main_worker_phone}
                                onChange={(e) => setFormData({ ...formData, main_worker_phone: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {formData.photos.map((p, i) => (
                        <div key={i} className="relative group">
                            <img src={p} className="w-16 h-16 object-cover rounded border border-gray-300" />
                            <button
                                onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) }))}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <FiX className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
                <label className={`flex items-center gap-2 text-yellow-600 hover:text-yellow-700 text-sm font-medium ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    {isUploading ? <FiLoader className="animate-spin" /> : <FiImage />}
                    {isUploading ? 'Uploading...' : 'Attach Photos'}
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handlePhotoUpload} 
                        disabled={isUploading}
                    />
                </label>
            </div>
        </div>
    );

    const FormFooter = (
        <div className="flex justify-end gap-3 w-full">
            <button
                onClick={() => setIsPanelOpen(false)}
                className="btn-secondary"
            >
                Cancel
            </button>
            <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary disabled:opacity-50"
            >
                {isSubmitting ? 'Saving...' : 'Save Log'}
            </button>
        </div>
    );

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading daily logs...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header / Toolbar */}


            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
                {logs.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-400">
                        <p>No daily logs yet. Click "Add Daily Log" to start.</p>
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow relative h-full flex flex-col">
                            {/* Action Kebab Menu */}
                            {(hasPermission('site_logs.edit') || hasPermission('site_logs.delete')) && (
                                <div className="absolute top-4 right-4">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuId(activeMenuId === log.id ? null : log.id);
                                        }}
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <FiMoreVertical className="w-5 h-5" />
                                    </button>

                                    {activeMenuId === log.id && (
                                        <div
                                            ref={menuRef}
                                            className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100"
                                        >
                                            {hasPermission('site_logs.edit') && (
                                                <button
                                                    onClick={() => handleEdit(log)}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                >
                                                    <FiEdit2 className="w-4 h-4" /> Edit
                                                </button>
                                            )}
                                            {hasPermission('site_logs.delete') && (
                                                <button
                                                    onClick={() => handleDelete(log.id)}
                                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <FiTrash2 className="w-4 h-4" /> Delete
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-3 pr-8">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className={`w-2 h-2 rounded-full ${log.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'} flex-shrink-0`}></div>
                                    <h4 className="font-bold text-gray-800 text-lg">
                                        {formatDateTimeIST(log.created_at)}
                                    </h4>
                                    <span className="text-xs text-gray-400 ml-1">
                                        by {log.creator?.full_name || 'Unknown'}
                                    </span>
                                    {log.status === 'completed' && (
                                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium flex items-center gap-1">
                                            <FiCheckCircle className="w-3 h-3" /> Done
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Mobile only completion date line to avoid cramming */}
                            {log.status === 'completed' && log.actual_completion_date && (
                                <div className="text-xs text-green-700 mb-2 sm:hidden font-medium">
                                    Completed on: {formatDateReadable(log.actual_completion_date)}
                                </div>
                            )}

                            <p className="text-gray-700 whitespace-pre-wrap mb-4 text-sm leading-relaxed flex-1">
                                {log.work_description}
                            </p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-gray-50 p-3 rounded-lg text-sm border border-gray-100 mt-auto">
                                <div>
                                    <span className="block text-gray-400 text-xs mb-1">Workers</span>
                                    <div className="font-medium text-gray-900 flex items-center gap-1">
                                        <FiUsers className="text-gray-400" /> {log.labor_count || 0}
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-gray-400 text-xs mb-1">Main Worker</span>
                                    <div className="font-medium text-gray-900 flex items-center gap-1">
                                        <FiUser className="text-gray-400" /> {log.main_worker_name || '-'}
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-gray-400 text-xs mb-1">Start Date</span>
                                    <div className="font-medium text-gray-900 flex items-center gap-1">
                                        <FiCalendar className="text-gray-400" /> {log.work_start_date ? formatDateReadable(log.work_start_date) : '-'}
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-gray-400 text-xs mb-1">Target Date</span>
                                    <div className="font-medium text-gray-900 flex items-center gap-1">
                                        <FiCalendar className="text-gray-400" /> {log.estimated_completion_date ? formatDateReadable(log.estimated_completion_date) : '-'}
                                    </div>
                                </div>
                                {log.status === 'completed' && (
                                    <div>
                                        <span className="block text-green-600 text-xs mb-1 font-medium">Actual Date</span>
                                        <div className="font-medium text-green-700 flex items-center gap-1">
                                            <FiCheckSquare className="text-green-500" /> {log.actual_completion_date ? formatDateReadable(log.actual_completion_date) : '-'}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {log.photos && log.photos.length > 0 && (
                                <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                                    {log.photos.map((url, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => openImageModal(log.photos || [], idx)}
                                            className="block w-20 h-20 flex-shrink-0 cursor-zoom-in"
                                        >
                                            <img src={url} alt="Log attachment" className="w-full h-full object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Side Panel */}
            {!isMobile && (
                <SidePanel
                    isOpen={isPanelOpen}
                    onClose={() => setIsPanelOpen(false)}
                    title={editingLogId ? "Edit Daily Log" : "Add Daily Site Log"}
                    width="lg"
                    footer={FormFooter}
                >
                    {FormContent}
                </SidePanel>
            )}

            {/* Mobile Bottom Sheet */}
            {isMobile && (
                <BottomSheet
                    isOpen={isPanelOpen}
                    onClose={() => setIsPanelOpen(false)}
                    title={editingLogId ? "Edit Daily Log" : "Add Daily Site Log"}
                    footer={FormFooter}
                    maxHeight="90vh"
                >
                    {FormContent}
                </BottomSheet>
            )}

            <ImageModal
                images={modalImages}
                currentIndex={currentImageIndex}
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
            />
        </div>
    );
});

SiteLogTab.displayName = 'SiteLogTab';
