'use client';

import React, { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiActivity, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import Link from 'next/link';

interface Role {
    id: string;
    name: string;
}

interface User {
    id: string;
    full_name: string;
    email: string;
    designation: string | null;
    role: string; // Legacy field
    role_id: string | null;
    roles?: Role; // Joined role data
}

export default function UsersTab() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch roles first
                const rolesRes = await fetch('/api/rbac/roles');
                const rolesData = await rolesRes.json();
                const allRoles = rolesData.roles || [];
                setRoles(allRoles);

                // Fetch users via API
                const usersRes = await fetch('/api/admin/users');
                const usersData = await usersRes.json();
                setUsers(usersData || []);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const toggleGroup = (designation: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [designation]: !prev[designation]
        }));
    };

    const filteredUsers = users.filter((user: User) =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.designation?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const handleDeleteUser = async (userId: string) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                const response = await fetch('/api/admin/users', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: userId }),
                });

                if (!response.ok) throw new Error('Failed to delete');
                setUsers(users.filter((u: User) => u.id !== userId));
            } catch (error) {
                console.error('Error deleting user:', error);
            }
        }
    };

    const getRoleDisplay = (user: User) => {
        if (user.role_id && roles.length > 0) {
            const role = roles.find((r: Role) => r.id === user.role_id);
            if (role) return role.name;
        }
        if (user.roles) return user.roles.name;
        return user.role || 'No Role';
    };

    const getRoleColor = (user: User) => {
        const roleName = getRoleDisplay(user).toLowerCase();
        if (roleName === 'admin') return 'bg-purple-100 text-purple-700';
        if (roleName === 'employee') return 'bg-green-100 text-green-700';
        if (roleName.includes('supervisor')) return 'bg-blue-100 text-blue-700';
        return 'bg-gray-100 text-gray-700';
    };

    const groupedUsers = filteredUsers.reduce((groups: { [key: string]: User[] }, user: User) => {
        const designation = user.designation || 'Other';
        if (!groups[designation]) {
            groups[designation] = [];
        }
        groups[designation].push(user);
        return groups;
    }, {});

    const sortedDesignations = Object.keys(groupedUsers).sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                <p className="text-gray-500 text-sm">Loading team members...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="relative w-full sm:w-64">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search team..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
                    />
                </div>
                <Link
                    href="/dashboard/organization/new"
                    className="w-full sm:w-auto btn-primary flex items-center justify-center gap-2 px-6 shadow-sm"
                >
                    <FiPlus className="h-4 w-4" /> <span>Add User</span>
                </Link>
            </div>

            {/* Desktop View: Table */}
            <div className="hidden lg:block bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Member</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Designation</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Role</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {sortedDesignations.map(designation => (
                            <React.Fragment key={designation}>
                                <tr
                                    className="bg-gray-50/50 cursor-pointer hover:bg-gray-100/50 transition-colors"
                                    onClick={() => toggleGroup(designation)}
                                >
                                    <td colSpan={4} className="px-6 py-2 border-y border-gray-100/50">
                                        <div className="flex items-center gap-2">
                                            {collapsedGroups[designation] ? (
                                                <FiChevronRight className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <FiChevronDown className="w-4 h-4 text-gray-400" />
                                            )}
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                {designation} — {groupedUsers[designation].length} {groupedUsers[designation].length === 1 ? 'Member' : 'Members'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                {!collapsedGroups[designation] && groupedUsers[designation].map((user: User) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-700 font-bold border border-yellow-100 text-xs">
                                                    {user.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">{user.full_name}</div>
                                                    <div className="text-xs text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.designation || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user)}`}>
                                                {getRoleDisplay(user)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    href={`/dashboard/organization/${user.id}`}
                                                    className="flex items-center justify-center p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                                    title="View Profile (360)"
                                                >
                                                    <FiActivity className="h-4 w-4" />
                                                </Link>
                                                <Link
                                                    href={`/dashboard/organization/${user.id}/edit`}
                                                    className="flex items-center justify-center p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Edit user"
                                                >
                                                    <FiEdit2 className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="flex items-center justify-center p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete user"
                                                >
                                                    <FiTrash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile View: Cards */}
            <div className="lg:hidden space-y-4">
                {sortedDesignations.map(designation => (
                    <div key={designation} className="space-y-4">
                        <div
                            className="px-4 py-2 bg-gray-100/50 rounded-lg flex items-center justify-between cursor-pointer"
                            onClick={() => toggleGroup(designation)}
                        >
                            <div className="flex items-center gap-2">
                                {collapsedGroups[designation] ? (
                                    <FiChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                ) : (
                                    <FiChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                )}
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mt-0.5">
                                    {designation}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded-full border border-gray-200">
                                    {groupedUsers[designation].length}
                                </span>
                            </div>
                        </div>
                        {!collapsedGroups[designation] && (
                            <div className="space-y-4">
                                {groupedUsers[designation].map((user: User) => (
                                    <div key={user.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-700 font-bold border border-yellow-100">
                                                    {user.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</div>
                                                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${getRoleColor(user)}`}>
                                                {getRoleDisplay(user)}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                            <div className="text-xs text-gray-500">
                                                <span className="font-medium text-gray-400">Designation:</span> {user.designation || '-'}
                                            </div>
                                            <div className="flex gap-2">
                                                <Link
                                                    href={`/dashboard/organization/${user.id}`}
                                                    className="flex items-center justify-center p-2 text-yellow-600 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
                                                    title="View Profile"
                                                >
                                                    <FiActivity className="h-4 w-4" />
                                                </Link>
                                                <Link
                                                    href={`/dashboard/organization/${user.id}/edit`}
                                                    className="flex items-center justify-center p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                                >
                                                    <FiEdit2 className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="flex items-center justify-center p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                                >
                                                    <FiTrash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {filteredUsers.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500 text-sm">No team members found.</p>
                </div>
            )}
        </div>
    );
}
