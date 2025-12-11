'use client';

import { useEffect, useState } from 'react';
import { FiCheck, FiEdit, FiPlus, FiUser, FiAlertCircle, FiClock, FiFlag, FiMessageCircle } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';

type Activity = {
    id: string;
    activity_type: string;
    old_value: string | null;
    new_value: string | null;
    comment: string | null;
    created_at: string;
    user: {
        id: string;
        full_name: string;
        email: string;
    };
};

type ActivityTimelineProps = {
    taskId: string;
};

export function ActivityTimeline({ taskId }: ActivityTimelineProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActivities();
    }, [taskId]);

    const fetchActivities = async () => {
        try {
            const res = await fetch(`/api/tasks/${taskId}/activity`);
            if (res.ok) {
                const { activities } = await res.json();
                setActivities(activities || []);
            }
        } catch (error) {
            console.error('Failed to fetch activities:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'created':
                return <FiPlus className="w-4 h-4 text-green-600" />;
            case 'status_changed':
                return <FiCheck className="w-4 h-4 text-blue-600" />;
            case 'assigned':
                return <FiUser className="w-4 h-4 text-purple-600" />;
            case 'priority_changed':
                return <FiFlag className="w-4 h-4 text-orange-600" />;
            case 'due_date_changed':
                return <FiClock className="w-4 h-4 text-yellow-600" />;
            case 'commented':
                return <FiMessageCircle className="w-4 h-4 text-gray-600" />;
            case 'updated':
                return <FiEdit className="w-4 h-4 text-gray-600" />;
            default:
                return <FiAlertCircle className="w-4 h-4 text-gray-400" />;
        }
    };

    const getActivityText = (activity: Activity) => {
        switch (activity.activity_type) {
            case 'created':
                return 'created this task';
            case 'status_changed':
                return (
                    <>
                        changed status from{' '}
                        <span className="font-medium text-gray-700">{activity.old_value || 'none'}</span>
                        {' to '}
                        <span className="font-medium text-gray-900">{activity.new_value}</span>
                    </>
                );
            case 'assigned':
                return (
                    <>
                        assigned to <span className="font-medium text-gray-900">{activity.new_value}</span>
                    </>
                );
            case 'priority_changed':
                return (
                    <>
                        changed priority from{' '}
                        <span className="font-medium text-gray-700">{activity.old_value}</span>
                        {' to '}
                        <span className="font-medium text-gray-900">{activity.new_value}</span>
                    </>
                );
            case 'due_date_changed':
                return (
                    <>
                        changed due date to <span className="font-medium text-gray-900">{activity.new_value}</span>
                    </>
                );
            case 'commented':
                return activity.comment || 'added a comment';
            case 'updated':
                return 'updated the task';
            default:
                return 'made a change';
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="text-center py-8">
                <FiClock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No activity yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 px-4 md:px-0">Activity Timeline</h3>
            <div className="space-y-4 px-4 md:px-0">
                {activities.map((activity, index) => (
                    <div key={activity.id} className="flex gap-3 relative">
                        {/* Vertical line */}
                        {index < activities.length - 1 && (
                            <div className="absolute left-4 top-10 bottom-0 w-px bg-gray-200"></div>
                        )}

                        {/* Avatar */}
                        <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-gray-900 flex-shrink-0 shadow-sm z-10">
                            {getInitials(activity.user.full_name)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-start gap-2">
                                <div className="flex-1">
                                    <p className="text-sm leading-relaxed">
                                        <span className="font-semibold text-gray-900">{activity.user.full_name}</span>
                                        {' '}
                                        <span className="text-gray-600">{getActivityText(activity)}</span>
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex items-center gap-1">
                                            {getActivityIcon(activity.activity_type)}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
