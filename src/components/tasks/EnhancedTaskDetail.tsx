'use client';

import { FiAlertTriangle, FiCalendar, FiCheck, FiClock, FiEdit, FiFlag, FiFolder, FiUser, FiX, FiCamera, FiCheckCircle } from 'react-icons/fi';
import { ActivityTimeline } from './ActivityTimeline';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import Image from 'next/image';
import { uploadFiles } from '@/lib/uploadUtils';

type CalendarTask = {
    id: string;
    title: string;
    description?: string | null;
    start_at: string;
    end_at: string;
    status: 'todo' | 'in_progress' | 'blocked' | 'done';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assigned_to?: string | null;
    assigned_to_id?: string | null;
    project_id?: string | null;
    created_at?: string;
    created_by?: string;
    updated_at?: string;
    completion_description?: string | null;
    completion_photos?: string[] | null;
};

type EnhancedTaskDetailProps = {
    task: CalendarTask;
    projectName?: string;
    assigneeName?: string;
    creatorName?: string;
    onClose?: () => void;
    onEdit?: () => void;
    isMobile?: boolean;
};

export function EnhancedTaskDetail({
    task,
    projectName,
    assigneeName,
    creatorName,
    onClose,
    onEdit,
    isMobile = false,
}: EnhancedTaskDetailProps) {
    const [completionDescription, setCompletionDescription] = useState(task.completion_description || '');
    const [completionPhotos, setCompletionPhotos] = useState<string[]>(task.completion_photos || []);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showCompletionForm, setShowCompletionForm] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    const isOverdue = task.status !== 'done' && new Date(task.end_at).getTime() < Date.now();

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    const statusConfig = {
        todo: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'To Do', icon: FiClock },
        in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress', icon: FiClock },
        blocked: { bg: 'bg-red-100', text: 'text-red-700', label: 'Blocked', icon: FiAlertTriangle },
        done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Done', icon: FiCheck },
    };

    const priorityConfig = {
        low: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Low' },
        medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' },
        high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
        urgent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
    };

    const status = statusConfig[task.status];
    const priority = priorityConfig[task.priority];
    const StatusIcon = status.icon;

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        };
    };

    const startDateTime = formatDateTime(task.start_at);
    const endDateTime = formatDateTime(task.end_at);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const urls = await uploadFiles(files, 'project-update-photos', task.id);
            setCompletionPhotos(prev => [...prev, ...urls]);
        } catch (error) {
            console.error('Error uploading photos:', error);
            alert('Failed to upload photos');
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleSaveCompletion = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: task.id,
                    completion_description: completionDescription,
                    completion_photos: completionPhotos,
                    status: 'done' // Automatically mark as done when completion info is added? Or maybe just save.
                    // User said "what happened in the task and give the option to add the images"
                    // Usually this implies the task is being finished.
                })
            });

            if (res.ok) {
                setShowCompletionForm(false);
                // In a real app we might want to refresh the task data via a parent callback
                // For now, let's assume the state update is enough for local feedback
                window.location.reload(); // Simple way to refresh for now
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to save task completion');
            }
        } catch (error) {
            console.error('Error saving completion:', error);
            alert('Something went wrong');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex-1 min-w-0 pr-4">
                    {/* Breadcrumb */}
                    {projectName && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                            <FiFolder className="w-3 h-3" />
                            <span>{projectName}</span>
                            <span>→</span>
                            <span>Task</span>
                        </div>
                    )}

                    {/* Title */}
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">{task.title}</h2>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${status.bg} ${status.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                        </span>

                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${priority.bg} ${priority.text}`}>
                            <FiFlag className="w-3 h-3" />
                            {priority.label}
                        </span>

                        {isOverdue && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700">
                                <FiAlertTriangle className="w-3 h-3" />
                                Overdue
                            </span>
                        )}
                    </div>
                </div>

                {/* Close button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Metadata Grid */}
            <div className="p-4 border-b border-gray-200 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Assigned To */}
                    <div>
                        <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
                            <FiUser className="w-3 h-3" />
                            Assigned To
                        </label>
                        {assigneeName ? (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-gray-900 shadow-sm">
                                    {getInitials(assigneeName)}
                                </div>
                                <span className="font-medium text-gray-900">{assigneeName}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-500">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                    <FiUser className="w-4 h-4 text-gray-400" />
                                </div>
                                <span className="text-sm">Unassigned</span>
                            </div>
                        )}
                    </div>

                    {/* Created By */}
                    <div>
                        <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
                            <FiUser className="w-3 h-3" />
                            Created By
                        </label>
                        {creatorName ? (
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-700">
                                    {getInitials(creatorName)}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{creatorName}</p>
                                    {task.created_at && (
                                        <p className="text-xs text-gray-500">
                                            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <span className="text-sm text-gray-500">Unknown</span>
                        )}
                    </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
                            <FiCalendar className="w-3 h-3" />
                            Start Date
                        </label>
                        <p className="text-sm font-medium text-gray-900">
                            {startDateTime.date} • {startDateTime.time}
                        </p>
                    </div>

                    <div>
                        <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
                            <FiClock className="w-3 h-3" />
                            Due Date
                        </label>
                        <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                            {endDateTime.date} • {endDateTime.time}
                        </p>
                    </div>
                </div>
            </div>

            {/* Description */}
            {task.description && (
                <div className="p-4 border-b border-gray-200">
                    <label className="block text-xs font-medium text-gray-500 mb-2">Original Description</label>
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{task.description}</p>
                </div>
            )}

            {/* Task Outcome / Completion Info */}
            <div className="p-4 border-b border-gray-200 bg-yellow-50/30">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Task Outcome</label>
                    {!showCompletionForm && task.status !== 'done' && (
                        <button
                            onClick={() => setShowCompletionForm(true)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            <FiEdit className="w-3 h-3" />
                            {task.completion_description ? 'Edit Outcome' : 'Add Outcome'}
                        </button>
                    )}
                </div>

                {showCompletionForm ? (
                    <div className="space-y-4 bg-white p-3 rounded-lg border border-yellow-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                        <div>
                            <textarea
                                value={completionDescription}
                                onChange={(e) => setCompletionDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                rows={3}
                                placeholder="What happened? Any notes on the outcome..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2">Photos / Proof of Work</label>
                            <div className="flex gap-2 overflow-x-auto py-1">
                                {completionPhotos.map((url, i) => (
                                    <div key={i} className="relative w-16 h-16 flex-shrink-0 group">
                                        <Image src={url} alt="preview" fill className="object-cover rounded-lg border border-gray-200" />
                                        <button
                                            type="button"
                                            onClick={() => setCompletionPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md z-10 p-0 !min-w-0 !min-h-0"
                                        >
                                            <FiX className="w-3" />
                                        </button>
                                    </div>
                                ))}
                                <label className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-yellow-500 hover:bg-yellow-50 transition-colors">
                                    {isUploading ? (
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

                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
                            <button
                                onClick={() => setShowCompletionForm(false)}
                                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCompletion}
                                disabled={isSaving || isUploading}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium shadow-sm flex items-center gap-2"
                            >
                                {isSaving ? 'Saving...' : 'Save & Mark Done'}
                                <FiCheckCircle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {task.completion_description ? (
                            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed mb-3">{task.completion_description}</p>
                        ) : (
                            <p className="text-sm text-gray-400 italic mb-3">No outcome documented yet.</p>
                        )}

                        {completionPhotos.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {completionPhotos.map((url, i) => (
                                    <div
                                        key={i}
                                        className="relative w-20 h-20 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => setViewingImage(url)}
                                    >
                                        <Image src={url} alt="outcome" fill className="object-cover rounded-lg border border-gray-100 shadow-sm" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Activity Timeline */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                <ActivityTimeline taskId={task.id} />
            </div>

            {/* Action Buttons */}
            <div className="border-t border-gray-200 p-4 bg-white">
                <div className="flex gap-2">
                    {task.status !== 'done' && (
                        <button
                            onClick={() => setShowCompletionForm(true)}
                            className="flex-1 btn-primary bg-green-600 hover:bg-green-700"
                        >
                            <FiCheckCircle className="w-4 h-4" />
                            <span>Mark as Done</span>
                        </button>
                    )}
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className={`${task.status === 'done' ? 'flex-1' : ''} btn-secondary`}
                        >
                            <FiEdit className="w-4 h-4" />
                            <span>Edit task</span>
                        </button>
                    )}
                    {onClose && isMobile && (
                        <button
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>

            {/* Image Viewer Overlay */}
            {viewingImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <button className="absolute top-4 right-4 text-white p-2">
                        <FiX className="w-8 h-8" />
                    </button>
                    <div className="relative w-full max-w-4xl h-full max-h-[80vh]">
                        <Image
                            src={viewingImage}
                            alt="Preview"
                            fill
                            className="object-contain"
                            unoptimized
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
