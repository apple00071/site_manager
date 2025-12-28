'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FiUser, FiPhone, FiPlus, FiX, FiCheck, FiSearch, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface ProjectUser {
    id: string;
    name: string;
    email: string;
    phone_number: string | null;
    designation: string | null;
    role?: string | null;
    permissions: {
        view: boolean;
        edit: boolean;
        upload: boolean;
        mark_done: boolean;
    };
}

interface SystemUser {
    id: string;
    full_name: string;
    email: string;
    designation: string | null;
}

interface ProjectUsersPanelProps {
    projectId: string;
    assignedEmployee?: {
        id: string;
        name: string;
        email: string;
        designation?: string;
    } | null;
    createdBy?: string;
}

export function ProjectUsersPanel({ projectId, assignedEmployee, createdBy }: ProjectUsersPanelProps) {
    const [users, setUsers] = useState<ProjectUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<SystemUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Check if user has permission to manage project users
    const { hasPermission } = useUserPermissions();
    const canManageUsers = hasPermission('projects.edit');

    useEffect(() => {
        fetchProjectUsers();
    }, [projectId]);

    const fetchProjectUsers = async () => {
        try {
            setIsLoading(true);

            // Use the API route to fetch project members (bypasses RLS)
            const response = await fetch(`/api/admin/project-members?project_id=${projectId}`);
            const result = await response.json();

            if (!response.ok || result.error) {
                console.error('Error fetching project members:', result.error);
                return;
            }

            // Map the data to our format
            const mappedUsers: ProjectUser[] = (result.members || [])
                .filter((m: any) => m.users) // Filter out any null user references
                .map((m: any) => ({
                    id: m.users.id,
                    name: m.users.full_name || m.users.email?.split('@')[0] || 'Unknown',
                    email: m.users.email,
                    phone_number: m.users.phone_number,
                    designation: m.users.designation,
                    role: m.users.role,
                    permissions: m.permissions || { view: true, edit: false, upload: false, mark_done: false }
                }));

            setUsers(mappedUsers);
        } catch (err) {
            console.error('Error fetching project users:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAvailableUsers = async () => {
        try {
            // Fetch all users from the system
            const { data: allUsers, error } = await supabase
                .from('users')
                .select('id, full_name, email, designation')
                .order('full_name', { ascending: true });

            if (error) {
                console.error('Error fetching users:', error);
                return;
            }

            // Filter out users already in the project
            const existingIds = new Set(users.map(u => u.id));
            if (assignedEmployee) {
                existingIds.add(assignedEmployee.id);
            }

            const available = (allUsers || []).filter((u: SystemUser) => !existingIds.has(u.id));
            setAvailableUsers(available);
        } catch (err) {
            console.error('Error fetching available users:', err);
        }
    };

    const handleOpenModal = () => {
        setShowAddModal(true);
        setSelectedUser('');
        setSearchQuery('');
        setError(null);
        fetchAvailableUsers();
    };

    const handleAddUser = async () => {
        if (!selectedUser) {
            setError('Please select a user');
            return;
        }

        try {
            setIsSaving(true);
            setError(null);

            // Use the API route to add project member (bypasses RLS)
            const response = await fetch('/api/admin/project-members', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    project_id: projectId,
                    user_id: selectedUser,
                    permissions: { view: true, edit: true, upload: true, mark_done: true }
                }),
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                console.error('Error adding user:', result.error);
                setError(result.error || 'Failed to add user');
                return;
            }

            // Refresh the users list
            await fetchProjectUsers();
            setShowAddModal(false);
        } catch (err) {
            console.error('Error adding user:', err);
            setError('Failed to add user. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };



    const handleRemoveUser = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this user from the project?')) {
            return;
        }

        try {
            setIsDeleting(true);

            const response = await fetch(`/api/admin/project-members?project_id=${projectId}&user_id=${userId}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                console.error('Error removing user:', result.error);
                alert(result.error || 'Failed to remove user');
                return;
            }

            await fetchProjectUsers();
        } catch (err) {
            console.error('Error removing user:', err);
            alert('Failed to remove user. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Filter available users based on search
    const filteredAvailableUsers = availableUsers.filter(u => {
        const query = searchQuery.toLowerCase();
        return (
            u.full_name?.toLowerCase().includes(query) ||
            u.email?.toLowerCase().includes(query) ||
            u.designation?.toLowerCase().includes(query)
        );
    });

    // Generate avatar color based on name
    const getAvatarColor = (name: string) => {
        const colors = [
            'bg-red-500',
            'bg-orange-500',
            'bg-yellow-500',
            'bg-yellow-500',
            'bg-lime-500',
            'bg-green-500',
            'bg-emerald-500',
            'bg-teal-500',
            'bg-cyan-500',
            'bg-sky-500',
            'bg-blue-500',
            'bg-indigo-500',
            'bg-violet-500',
            'bg-purple-500',
            'bg-fuchsia-500',
            'bg-pink-500',
            'bg-rose-500',
        ];
        const index = name.charCodeAt(0) % colors.length;
        return colors[index];
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Combine assigned employee with project members, avoiding duplicates
    const allUsers = React.useMemo(() => {
        const combined: ProjectUser[] = [];

        // Add assigned employee first if exists
        if (assignedEmployee) {
            combined.push({
                id: assignedEmployee.id,
                name: assignedEmployee.name,
                email: assignedEmployee.email,
                phone_number: null,
                designation: assignedEmployee.designation || 'Assigned Employee',
                permissions: { view: true, edit: true, upload: true, mark_done: true }
            });
        }

        // Add other project members, avoiding duplicates
        users.forEach(user => {
            if (!combined.find(u => u.id === user.id)) {
                combined.push(user);
            }
        });

        return combined;
    }, [users, assignedEmployee]);

    return (
        <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit sticky top-4">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Project Users</h3>
                    {canManageUsers && (
                        <button
                            className="text-yellow-600 hover:text-yellow-700 text-sm font-medium flex items-center gap-1"
                            onClick={handleOpenModal}
                        >
                            <FiPlus className="w-4 h-4" />
                            Add Users
                        </button>
                    )}
                </div>

                {/* User List */}
                <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                    {isLoading ? (
                        <div className="px-4 py-6 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500 mx-auto"></div>
                            <p className="text-sm text-gray-500 mt-2">Loading users...</p>
                        </div>
                    ) : allUsers.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                            <FiUser className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No users assigned yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {allUsers.map((user) => (
                                <div
                                    key={user.id}
                                    className="px-4 py-3 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div
                                            className={`w-9 h-9 rounded-full ${getAvatarColor(user.name)} flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}
                                        >
                                            {getInitials(user.name)}
                                        </div>

                                        {/* User Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {user.name}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {user.designation || 'Team Member'}
                                            </p>
                                        </div>

                                        {/* Delete button - inline, hide for assigned employee and admin users */}
                                        {canManageUsers && assignedEmployee?.id !== user.id && user.role !== 'admin' && (
                                            <button
                                                onClick={() => handleRemoveUser(user.id)}
                                                disabled={isDeleting}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                                                title="Remove user from project"
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setShowAddModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Add User to Project
                            </h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                            {/* Search */}
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                />
                            </div>

                            {/* User Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select User
                                </label>
                                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                                    {filteredAvailableUsers.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">
                                            {availableUsers.length === 0
                                                ? 'No users available to add'
                                                : 'No users match your search'}
                                        </p>
                                    ) : (
                                        filteredAvailableUsers.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => setSelectedUser(user.id)}
                                                className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${selectedUser === user.id
                                                    ? 'bg-yellow-50 border-yellow-200 border'
                                                    : 'hover:bg-gray-50 border border-transparent'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-full ${getAvatarColor(user.full_name || user.email)} flex items-center justify-center text-white text-xs font-medium`}>
                                                    {getInitials(user.full_name || user.email)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {user.full_name || user.email.split('@')[0]}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {user.email}
                                                    </p>
                                                </div>
                                                {selectedUser === user.id && (
                                                    <FiCheck className="w-5 h-5 text-yellow-600" />
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">User permissions are controlled by their assigned role in User Management.</p>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddUser}
                                disabled={!selectedUser || isSaving}
                                className="px-4 py-2 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <FiPlus className="w-4 h-4" />
                                        Add User
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div >
            )
            }
        </>
    );
}

