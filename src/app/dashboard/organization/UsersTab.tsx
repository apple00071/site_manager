'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
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

    const handleDeleteUser = async (userId: string) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                const response = await fetch('/api/admin/users', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: userId }),
                });

                if (!response.ok) throw new Error('Failed to delete');
                setUsers(users.filter(u => u.id !== userId));
            } catch (error) {
                console.error('Error deleting user:', error);
            }
        }
    };

    const getRoleDisplay = (user: User) => {
        // First check if we have role_id and can look it up from fetched roles
        if (user.role_id && roles.length > 0) {
            const role = roles.find(r => r.id === user.role_id);
            if (role) return role.name;
        }
        // Fallback to joined roles data
        if (user.roles) {
            return user.roles.name;
        }
        // Final fallback to legacy role field
        return user.role || 'No Role';
    };

    const getRoleColor = (user: User) => {
        const roleName = getRoleDisplay(user);
        if (roleName.toLowerCase() === 'admin') {
            return 'bg-purple-100 text-purple-800';
        } else if (roleName.toLowerCase() === 'employee') {
            return 'bg-green-100 text-green-800';
        }
        return 'bg-blue-100 text-blue-800';
    };

    if (loading) {
        return <div className="p-8 text-center">Loading users...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Link
                    href="/dashboard/organization/new"
                    className="btn-primary flex items-center shadow-sm"
                >
                    <FiPlus className="mr-2 h-4 w-4" /> Add User
                </Link>
            </div>

            <div className="bg-white shadow overflow-hidden rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.full_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.designation || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user)}`}>
                                        {getRoleDisplay(user)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link href={`/dashboard/organization/${user.id}/edit`} className="text-indigo-600 hover:text-indigo-900 mr-3">
                                        <FiEdit2 className="inline h-4 w-4" />
                                    </Link>
                                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900">
                                        <FiTrash2 className="inline h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && <div className="p-8 text-center text-gray-500">No users found</div>}
            </div>
        </div>
    );
}
