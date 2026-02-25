'use client';

import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiClock, FiPlus, FiTrash2, FiMessageSquare, FiCamera, FiImage, FiX, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { uploadFiles } from '@/lib/uploadUtils';

interface HandoverTabProps {
    projectId: string;
}

interface ChecklistItem {
    id: string;
    project_id: string;
    room_name: string;
    item_name: string;
    status: boolean;
    notes: string | null;
    photos?: string[];
}

export function HandoverTab({ projectId }: HandoverTabProps) {
    const { user } = useAuth();
    const { isAdmin, hasPermission } = useUserPermissions();
    const canEdit = isAdmin || hasPermission('projects.edit'); // Adjust permission as needed

    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // New item form state
    const [isAdding, setIsAdding] = useState(false);
    const [newRoom, setNewRoom] = useState('');
    const [newItemName, setNewItemName] = useState('');

    // Editing notes state
    const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
    const [tempNotes, setTempNotes] = useState('');

    const [isLoadingDefault, setIsLoadingDefault] = useState(false);
    const [uploadingPhotosId, setUploadingPhotosId] = useState<string | null>(null);

    // Accordion state
    const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchItems();
    }, [projectId]);

    // Initialize first room as expanded when items are loaded
    useEffect(() => {
        if (items.length > 0 && Object.keys(expandedRooms).length === 0) {
            const firstRoom = items[0]?.room_name;
            if (firstRoom) {
                setExpandedRooms({ [firstRoom]: true });
            }
        }
    }, [items, expandedRooms]);

    const toggleRoom = (room: string) => {
        setExpandedRooms(prev => ({
            ...prev,
            [room]: !prev[room]
        }));
    };

    const fetchItems = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/projects/handover-checklists?project_id=${projectId}`);
            if (!res.ok) throw new Error('Failed to fetch checklists');
            const data = await res.json();
            setItems(data.checklists || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoom.trim() || !newItemName.trim() || !canEdit) return;

        try {
            const res = await fetch('/api/projects/handover-checklists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: projectId,
                    room_name: newRoom.trim(),
                    item_name: newItemName.trim(),
                }),
            });

            if (!res.ok) throw new Error('Failed to add item');
            const data = await res.json();
            setItems([...items, data.checklist]);
            setNewItemName('');
            // Keep newRoom so user can quickly add multiple items to the same room
            setIsAdding(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to add item');
        }
    };

    const handleLoadDefault = async () => {
        if (!canEdit || !confirm('Load standard handover checklist? This will add predefined items to your list.')) return;
        try {
            setIsLoadingDefault(true);
            const res = await fetch('/api/projects/handover-checklists/default', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId }),
            });
            if (!res.ok) throw new Error('Failed to load default checklist');
            const data = await res.json();
            setItems([...items, ...(data.items || [])]);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error loading defaults');
        } finally {
            setIsLoadingDefault(false);
        }
    };

    const handlePhotoUpload = async (id: string, files: FileList | null) => {
        if (!canEdit || !files || files.length === 0) return;
        const item = items.find(i => i.id === id);
        if (!item) return;

        try {
            setUploadingPhotosId(id);
            const urls = await uploadFiles(files, 'project-documents', `handovers/${projectId}/${id}`);
            if (urls.length === 0) throw new Error('Failed to upload photos');

            const newPhotos = [...(item.photos || []), ...urls];

            const res = await fetch('/api/projects/handover-checklists', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, photos: newPhotos }),
            });
            if (!res.ok) throw new Error('Failed to save photo metadata');

            setItems(items.map(i => i.id === id ? { ...i, photos: newPhotos } : i));
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to upload photos');
        } finally {
            setUploadingPhotosId(null);
        }
    };

    const handleToggleStatus = async (item: ChecklistItem) => {
        if (!canEdit) return;

        // Optimistic update
        const updatedItems = items.map(i => i.id === item.id ? { ...i, status: !i.status } : i);
        setItems(updatedItems);

        try {
            const res = await fetch('/api/projects/handover-checklists', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: item.id,
                    status: !item.status,
                }),
            });
            if (!res.ok) throw new Error('Failed to update status');
        } catch (err) {
            // Revert on error
            setItems(items);
            alert('Failed to update status');
        }
    };

    const handleSaveNotes = async (id: string) => {
        if (!canEdit) return;

        try {
            const res = await fetch('/api/projects/handover-checklists', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    notes: tempNotes,
                }),
            });

            if (!res.ok) throw new Error('Failed to save notes');

            setItems(items.map(i => i.id === id ? { ...i, notes: tempNotes } : i));
            setEditingNotesId(null);
        } catch (err) {
            alert('Failed to save notes');
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (!canEdit || !confirm('Delete this checklist item?')) return;

        try {
            const res = await fetch(`/api/projects/handover-checklists?id=${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete item');
            setItems(items.filter(i => i.id !== id));
        } catch (err) {
            alert('Failed to delete item');
        }
    };

    // Group items by room
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.room_name]) acc[item.room_name] = [];
        acc[item.room_name].push(item);
        return acc;
    }, {} as Record<string, ChecklistItem[]>);

    const completionStats = items.reduce(
        (acc, item) => {
            acc.total++;
            if (item.status) acc.completed++;
            return acc;
        },
        { total: 0, completed: 0 }
    );
    const progressPercentage = completionStats.total === 0 ? 0 : Math.round((completionStats.completed / completionStats.total) * 100);


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm">{error}</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-0 sm:p-6">
                <div className="w-full pb-20 sm:pb-10">
                    {/* Welcome/Status Card - Sticky Header */}
                    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b sm:border border-gray-200 p-4 sm:p-6 shadow-sm mb-4 sm:mb-6 sm:rounded-2xl transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <FiCheckCircle className="w-6 h-6 text-yellow-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">Handover Phase</h3>
                                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                                        Verify all items before final sign-off.
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-0.5 bg-yellow-400/10 text-yellow-700 text-[10px] font-bold rounded uppercase tracking-wider border border-yellow-400/20">
                                            Handover
                                        </span>
                                        <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
                                            <FiClock className="w-3 h-3" />
                                            {progressPercentage === 100 ? 'Ready' : 'In Progress'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-4 sm:pt-0 mt-1 sm:mt-0 border-gray-100">
                                {/* Circular Progress - Better Mobile Size */}
                                <div className="flex items-center gap-3">
                                    <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-gray-50 rounded-full border border-gray-100 flex-shrink-0">
                                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                            <path
                                                className="text-gray-200 stroke-current"
                                                strokeWidth="3"
                                                strokeDasharray="100, 100"
                                                fill="none"
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            />
                                            <path
                                                className={`${progressPercentage === 100 ? 'text-green-500' : 'text-yellow-500'} stroke-current transition-all duration-500`}
                                                strokeWidth="3"
                                                strokeDasharray={`${progressPercentage}, 100`}
                                                fill="none"
                                                strokeLinecap="round"
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-[11px] sm:text-sm font-bold text-gray-900">{progressPercentage}%</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Progress</span>
                                        <span className="text-[13px] sm:text-sm font-bold text-gray-800 leading-tight mt-0.5">{completionStats.completed}/{completionStats.total}</span>
                                    </div>
                                </div>
                                {/* Actions & New Item Form */}
                                {canEdit && (
                                    <div className="flex-shrink-0">
                                        <button
                                            onClick={() => setIsAdding(true)}
                                            className="h-11 inline-flex items-center gap-2 px-4 text-sm font-bold text-yellow-800 bg-yellow-100 hover:bg-yellow-200 rounded-xl transition-colors shadow-sm"
                                        >
                                            <FiPlus className="w-4 h-4" />
                                            Add Item
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Add Item Modal */}
                        {isAdding && canEdit && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-gray-900">Add New Checklist Item</h3>
                                        <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                            <FiX className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <form onSubmit={handleAddItem} className="p-6 space-y-5">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Room / Area</label>
                                            <input
                                                type="text"
                                                value={newRoom}
                                                onChange={(e) => setNewRoom(e.target.value)}
                                                placeholder="e.g. Master Bedroom"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all shadow-sm"
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Item to Verify</label>
                                            <input
                                                type="text"
                                                value={newItemName}
                                                onChange={(e) => setNewItemName(e.target.value)}
                                                placeholder="e.g. Wardrobe hinges operate smoothly"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all shadow-sm"
                                                required
                                            />
                                        </div>
                                        <div className="pt-2 flex justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setIsAdding(false)}
                                                className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-5 py-2.5 text-sm font-bold text-white bg-yellow-500 hover:bg-yellow-600 rounded-xl shadow-sm transition-colors"
                                            >
                                                Add Item
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Checklist Content */}
                        <div className="px-4 sm:px-0 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
                            {Object.entries(groupedItems).length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                                    <FiCheckCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                    <h3 className="text-sm font-medium text-gray-900">No Checklist Items</h3>
                                    <p className="text-xs text-gray-500 mt-1 mb-4">Start adding items to verify before handover.</p>
                                    {canEdit && (
                                        <button
                                            onClick={handleLoadDefault}
                                            disabled={isLoadingDefault}
                                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                                        >
                                            {isLoadingDefault ? (
                                                <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                                            ) : (
                                                <FiPlus className="w-4 h-4" />
                                            )}
                                            Load Standard Checklist
                                        </button>
                                    )}
                                </div>
                            ) : (
                                Object.entries(groupedItems).map(([room, roomItems]) => {
                                    const roomCompleted = roomItems.filter(i => i.status).length;
                                    const roomTotal = roomItems.length;
                                    const roomProgress = Math.round((roomCompleted / roomTotal) * 100);
                                    const isExpanded = expandedRooms[room];

                                    return (
                                        <div key={room} className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200">
                                            {/* Room Header - Clickable Accordion Trigger */}
                                            <button
                                                onClick={() => toggleRoom(room)}
                                                className="w-full px-4 py-4 sm:px-6 sm:py-5 bg-white hover:bg-gray-50 border-b border-gray-100 flex items-center justify-between transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    <div className={`p-1.5 sm:p-2 rounded-lg transition-colors ${isExpanded ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'}`}>
                                                        {isExpanded ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
                                                    </div>
                                                    <h4 className="text-[13px] sm:text-base font-bold text-gray-900 uppercase tracking-tight">{room}</h4>
                                                </div>
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    <div className="hidden sm:block w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-500 ${roomProgress === 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                                            style={{ width: `${roomProgress}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-[11px] sm:text-sm font-bold px-3 py-1.5 rounded-lg border ${roomProgress === 100 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {roomCompleted}/{roomTotal} <span className="hidden sm:inline">Completed</span>
                                                    </span>
                                                </div>
                                            </button>

                                            {/* Items Container - Accordion Body */}
                                            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                                <div className="overflow-hidden bg-gray-50/50">
                                                    <div className="p-3 sm:p-5">
                                                        <ul className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-5">
                                                            {roomItems.map((item) => (
                                                                <li
                                                                    key={item.id}
                                                                    className="p-3 sm:p-4 bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all rounded-xl shadow-sm flex flex-col h-full group"
                                                                >
                                                                    <div className="flex items-start gap-2 sm:gap-3">
                                                                        {/* Checkbox - 44x44 Touch Target */}
                                                                        <div className="-ml-3 -my-2 flex-shrink-0">
                                                                            <button
                                                                                onClick={() => handleToggleStatus(item)}
                                                                                disabled={!canEdit}
                                                                                className={`w-11 h-11 flex items-center justify-center rounded-full group/btn ${!canEdit ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                                                                aria-label="Toggle status"
                                                                            >
                                                                                <div
                                                                                    className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${item.status
                                                                                        ? 'bg-green-500 border-green-500 text-white shadow-sm'
                                                                                        : 'bg-white border-gray-300 text-transparent group-hover/btn:border-green-500'
                                                                                        }`}
                                                                                >
                                                                                    <FiCheckCircle className={`w-3.5 h-3.5 ${item.status ? 'text-white' : 'text-transparent'}`} />
                                                                                </div>
                                                                            </button>
                                                                        </div>

                                                                        {/* Content */}
                                                                        <div className="flex-1 min-w-0 pt-0.5">
                                                                            <div className="flex justify-between items-start gap-1">
                                                                                <p className={`text-[12px] sm:text-sm font-medium leading-tight ${item.status ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                                                    {item.item_name}
                                                                                </p>

                                                                                {/* Actions - 44x44 Touch Targets */}
                                                                                {canEdit && (
                                                                                    <div className="flex items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 -mr-3 -my-2">
                                                                                        <label className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-yellow-600 rounded-full cursor-pointer transition-colors" title="Upload Photos">
                                                                                            {uploadingPhotosId === item.id ? (
                                                                                                <div className="w-4 h-4 border-2 border-yellow-500 rounded-full border-t-transparent animate-spin"></div>
                                                                                            ) : (
                                                                                                <FiCamera className="w-4 h-4" />
                                                                                            )}
                                                                                            <input
                                                                                                type="file"
                                                                                                multiple
                                                                                                accept="image/*"
                                                                                                className="hidden"
                                                                                                onChange={(e) => {
                                                                                                    handlePhotoUpload(item.id, e.target.files);
                                                                                                    e.target.value = '';
                                                                                                }}
                                                                                                disabled={uploadingPhotosId === item.id}
                                                                                            />
                                                                                        </label>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setEditingNotesId(item.id);
                                                                                                setTempNotes(item.notes || '');
                                                                                            }}
                                                                                            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-yellow-600 rounded-full transition-colors"
                                                                                            title="Add Notes"
                                                                                        >
                                                                                            <FiMessageSquare className="w-4 h-4" />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleDeleteItem(item.id)}
                                                                                            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-red-600 rounded-full transition-colors"
                                                                                            title="Delete"
                                                                                        >
                                                                                            <FiTrash2 className="w-4 h-4" />
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Notes Display / Edit */}
                                                                            {editingNotesId === item.id ? (
                                                                                <div className="mt-2 flex gap-2 w-full animate-in fade-in slide-in-from-top-1">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={tempNotes}
                                                                                        onChange={(e) => setTempNotes(e.target.value)}
                                                                                        className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all shadow-sm"
                                                                                        placeholder="Add a note..."
                                                                                        autoFocus
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') handleSaveNotes(item.id);
                                                                                            if (e.key === 'Escape') setEditingNotesId(null);
                                                                                        }}
                                                                                    />
                                                                                    <button
                                                                                        onClick={() => handleSaveNotes(item.id)}
                                                                                        className="px-4 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-xl hover:bg-yellow-200 transition-colors shadow-sm whitespace-nowrap"
                                                                                    >
                                                                                        Save
                                                                                    </button>
                                                                                </div>
                                                                            ) : item.notes ? (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        if (canEdit) {
                                                                                            setEditingNotesId(item.id);
                                                                                            setTempNotes(item.notes || '');
                                                                                        }
                                                                                    }}
                                                                                    className={`mt-2 flex items-start gap-2 bg-gray-50/80 rounded-xl p-2.5 sm:p-3 border border-gray-100 ${canEdit ? 'cursor-pointer hover:bg-gray-100 hover:border-gray-200 transition-all' : 'cursor-default'} text-left w-full group/note`}
                                                                                >
                                                                                    <FiMessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                                                    <p className="text-xs text-gray-600 leading-relaxed">{item.notes}</p>
                                                                                    {canEdit && (
                                                                                        <span className="ml-auto text-[10px] font-medium text-gray-400 opacity-0 group-hover/note:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">Edit note</span>
                                                                                    )}
                                                                                </button>
                                                                            ) : null}

                                                                            {/* Photos Display */}
                                                                            {item.photos && item.photos.length > 0 && (
                                                                                <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x w-full">
                                                                                    {item.photos.map((url, i) => (
                                                                                        <a
                                                                                            key={i}
                                                                                            href={url}
                                                                                            target="_blank"
                                                                                            rel="noreferrer"
                                                                                            className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 hover:border-yellow-500 shadow-sm transition-all group block snap-start"
                                                                                        >
                                                                                            <img src={url} alt="Verification" className="w-full h-full object-cover" />
                                                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                                                                <FiImage className="text-white w-5 h-5" />
                                                                                            </div>
                                                                                        </a>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
