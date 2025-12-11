'use client';

import { FiAlertTriangle, FiCalendar, FiCheck, FiClock, FiEdit, FiFlag, FiFolder, FiUser, FiX } from 'react-icons/fi';
import { ActivityTimeline } from './ActivityTimeline';
import { formatDistanceToNow } from 'date-fns';

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
                    <label className="block text-xs font-medium text-gray-500 mb-2">Description</label>
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{task.description}</p>
                </div>
            )}

            {/* Activity Timeline */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                <ActivityTimeline taskId={task.id} />
            </div>

            {/* Action Buttons */}
            <div className="border-t border-gray-200 p-4 bg-white">
                <div className="flex gap-2">
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-gray-900 font-medium rounded-lg hover:bg-yellow-600 transition-colors"
                        >
                            <FiEdit className="w-4 h-4" />
                            <span>Edit Task</span>
                        </button>
                    )}
                    {onClose && isMobile && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
