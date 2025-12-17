'use client';

import { useEffect, useState, useRef } from 'react';
import { FiMoreVertical, FiEdit2, FiTrash2, FiX, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { DataTable } from '@/components/ui/DataTable';

interface Role {
    id: string;
    name: string;
    description: string;
    is_system: boolean;
    user_count: number;
}

interface ModulePermission {
    module: string;
    icon: string;
    permissions: PermissionLevel[];
    notifications: string[];
}

interface PermissionLevel {
    id: string;
    label: string;
}

// Module permissions based on actual codebase structure
const MODULE_PERMISSIONS: ModulePermission[] = [
    {
        module: 'Project Details',
        icon: '📋',
        permissions: [
            { id: 'view_basic', label: 'View only basic project details' },
            { id: 'view_all', label: 'View all project details including attachments and cost' },
            { id: 'edit_all', label: 'Edit all project details and project status' }
        ],
        notifications: ['Project updates', 'Project comments']
    },
    {
        module: 'Site Visit',
        icon: '🏗️',
        permissions: [
            { id: 'view_only', label: 'View only' },
            { id: 'view_edit', label: 'View, edit, upload and create' },
            { id: 'full_access', label: 'View, edit, upload, create and approve' }
        ],
        notifications: ['Site visit creation', 'Site visit start', 'Site visit update']
    },
    {
        module: 'Design',
        icon: '🎨',
        permissions: [
            { id: 'view_approved', label: 'View and download - approved files' },
            { id: 'view_all', label: 'View and download - all files' },
            { id: 'edit_upload', label: 'View, edit and upload - all files' },
            { id: 'approve', label: 'View, edit, upload and approve - all files' },
            { id: 'full', label: 'View, edit, upload, approve and freeze - all files' }
        ],
        notifications: ['Design approve', 'Design freeze', 'New version uploaded', 'New version external uploaded']
    },
    {
        module: 'BOQ',
        icon: '📊',
        permissions: [
            { id: 'view_only', label: 'View only' },
            { id: 'create_edit', label: 'View, create, edit and read' },
            { id: 'import', label: 'View, create, edit, import and approve' }
        ],
        notifications: ['BOQ created', 'BOQ updated', 'BOQ approved']
    },
    {
        module: 'Proposals for Client',
        icon: '📝',
        permissions: [
            { id: 'view_only', label: 'View only' },
            { id: 'create_edit', label: 'View, create, edit and send' },
            { id: 'approve', label: 'View, create, edit, send and approve' }
        ],
        notifications: ['Proposal rejected', 'Proposal sent', 'Proposal approved']
    },
    {
        module: 'Orders & Payments',
        icon: '💰',
        permissions: [
            { id: 'view_only', label: 'View only' },
            { id: 'create', label: 'Create orders and invoices' },
            { id: 'approve', label: 'Approve orders and payments' }
        ],
        notifications: ['Order created', 'Invoice created', 'Payment received']
    },
    {
        module: 'Inventory',
        icon: '📦',
        permissions: [
            { id: 'view_only', label: 'View only' },
            { id: 'add_remove', label: 'View, add and remove items' }
        ],
        notifications: ['Inventory low', 'Inventory added']
    },
    {
        module: 'Snag & Audit',
        icon: '🔍',
        permissions: [
            { id: 'view_only', label: 'View only' },
            { id: 'create', label: 'View and create snags' },
            { id: 'resolve', label: 'View, create and resolve snags' },
            { id: 'verify', label: 'View, create, resolve and verify snags' }
        ],
        notifications: ['Snag created', 'Snag resolved', 'Snag verified']
    }
];

export default function RolesTab() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPanel, setShowPanel] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

    // Form state
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [expandedModules, setExpandedModules] = useState<string[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string>>({});
    const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await fetch('/api/rbac/roles');
            const data = await res.json();
            if (data.roles) {
                setRoles(data.roles);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRole = () => {
        setEditingRole(null);
        setRoleName('');
        setRoleDescription('');
        setSelectedPermissions({});
        setSelectedNotifications([]);
        setExpandedModules([]);
        setShowPanel(true);
    };

    const handleEditRole = (role: Role) => {
        setEditingRole(role);
        setRoleName(role.name);
        setRoleDescription(role.description || '');
        // TODO: Load existing permissions
        setSelectedPermissions({});
        setSelectedNotifications([]);
        setExpandedModules([]);
        setShowPanel(true);
    };

    const handleSaveRole = async () => {
        if (!roleName.trim()) {
            alert('Role name is required');
            return;
        }

        try {
            if (editingRole) {
                // Update existing role
                const res = await fetch(`/api/rbac/roles?id=${editingRole.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: roleName,
                        description: roleDescription
                    })
                });
                if (!res.ok) throw new Error('Failed to update role');
            } else {
                // Create new role
                const res = await fetch('/api/rbac/roles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: roleName,
                        description: roleDescription,
                        permission_ids: [] // TODO: Map selected permissions to IDs
                    })
                });
                if (!res.ok) {
                    const data = await res.json();
                    alert(data.error || 'Failed to create role');
                    return;
                }
            }
            setShowPanel(false);
            fetchRoles();
        } catch (error) {
            console.error('Error saving role:', error);
            alert('Failed to save role');
        }
    };

    const handleDeleteRole = async (roleId: string, isSystem: boolean) => {
        if (isSystem) {
            alert('System roles cannot be deleted');
            return;
        }
        if (!confirm('Delete this role?')) return;

        try {
            const res = await fetch(`/api/rbac/roles?id=${roleId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchRoles();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete role');
            }
        } catch (error) {
            console.error('Error deleting role:', error);
        }
    };

    const toggleModule = (module: string) => {
        setExpandedModules(prev =>
            prev.includes(module)
                ? prev.filter(m => m !== module)
                : [...prev, module]
        );
    };

    const handlePermissionChange = (module: string, permissionId: string) => {
        setSelectedPermissions(prev => ({
            ...prev,
            [module]: permissionId
        }));
    };

    const handleNotificationToggle = (notification: string) => {
        setSelectedNotifications(prev =>
            prev.includes(notification)
                ? prev.filter(n => n !== notification)
                : [...prev, notification]
        );
    };

    const columns = [
        {
            key: 'si_no',
            label: 'SI No',
            width: 'w-16',
            render: (_value: any, _row: Role, index: number) => <span className="text-gray-600">{index + 1}</span>
        },
        {
            key: 'name',
            label: 'Project Level Role Name',
            render: (_value: any, role: Role) => (
                <span className="text-gray-900 font-medium">{role.name}</span>
            )
        },
        {
            key: 'type',
            label: 'Role Type',
            width: 'w-32',
            render: (_value: any, role: Role) => (
                <span className="text-gray-600">
                    {role.is_system ? 'System' : 'Custom'}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            width: 'w-24',
            render: () => (
                <span className="text-gray-600">Active</span>
            )
        },
        {
            key: 'actions',
            label: '',
            width: 'w-12',
            render: (_value: any, role: Role) => (
                <div className="relative flex items-center justify-end">
                    <button
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setDropdownPosition({
                                top: rect.bottom + 4,
                                left: rect.right - 160
                            });
                            setOpenDropdown(openDropdown === role.id ? null : role.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="More options"
                    >
                        <FiMoreVertical className="h-4 w-4 text-gray-400" />
                    </button>
                    {openDropdown === role.id && dropdownPosition && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => {
                                    setOpenDropdown(null);
                                    setDropdownPosition(null);
                                }}
                            />
                            <div
                                className="fixed z-20 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
                                style={{
                                    top: `${dropdownPosition.top}px`,
                                    left: `${dropdownPosition.left}px`
                                }}
                            >
                                <button
                                    onClick={() => {
                                        setOpenDropdown(null);
                                        setDropdownPosition(null);
                                        handleEditRole(role);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <FiEdit2 className="h-4 w-4" />
                                    Edit Role
                                </button>
                                <button
                                    onClick={() => {
                                        setOpenDropdown(null);
                                        setDropdownPosition(null);
                                        handleDeleteRole(role.id, role.is_system);
                                    }}
                                    disabled={role.is_system}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FiTrash2 className="h-4 w-4" />
                                    Delete Role
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )
        }
    ];

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading roles...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-lg shadow overflow-visible">
                <DataTable columns={columns} data={roles} keyField="id" className="min-w-full" />
            </div>

            <div className="flex justify-start">
                <button onClick={handleAddRole} className="text-sm text-red-600 hover:text-red-700 font-medium">
                    + Add New Role
                </button>
            </div>

            {/* Side Panel */}
            {showPanel && (
                <>
                    <div className="fixed inset-0 bg-gray-900 bg-opacity-20 z-40" onClick={() => setShowPanel(false)} />
                    <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-in-right">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">{editingRole ? 'Edit' : 'Add'} Project Level Role</h2>
                            <button onClick={() => setShowPanel(false)} className="p-1 hover:bg-gray-100 rounded">
                                <FiX className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Role Name & Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                                    <input
                                        type="text"
                                        value={roleName}
                                        onChange={(e) => setRoleName(e.target.value)}
                                        placeholder="Enter role name"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Type *</label>
                                    <input
                                        type="text"
                                        value="Custom"
                                        disabled
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                                    />
                                </div>
                            </div>

                            {/* Module Level Permissions */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-3">Role Permissions & Notification</h3>
                                <div className="border border-gray-200 rounded-lg">
                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                        <span className="text-sm font-medium text-gray-700">Module Level Permissions</span>
                                    </div>

                                    <div className="divide-y divide-gray-200">
                                        {MODULE_PERMISSIONS.map((module) => {
                                            const isExpanded = expandedModules.includes(module.module);
                                            const selected = selectedPermissions[module.module];

                                            return (
                                                <div key={module.module} className="border-b border-gray-200 last:border-0">
                                                    {/* Module Header */}
                                                    <button
                                                        onClick={() => toggleModule(module.module)}
                                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
                                                    >
                                                        {isExpanded ? (
                                                            <FiChevronDown className="h-4 w-4 text-gray-400" />
                                                        ) : (
                                                            <FiChevronRight className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className={`w-5 h-5 rounded flex items-center justify-center text-sm ${selected ? 'bg-red-100' : 'bg-gray-100'}`}>
                                                            {selected ? '✓' : module.icon}
                                                        </span>
                                                        <span className="text-sm font-medium text-gray-900">{module.module}</span>
                                                    </button>

                                                    {/* Module Content */}
                                                    {isExpanded && (
                                                        <div className="px-4 pb-4 grid grid-cols-2 gap-6">
                                                            {/* Permissions */}
                                                            <div className="space-y-2">
                                                                {module.permissions.map((perm) => (
                                                                    <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
                                                                        <input
                                                                            type="radio"
                                                                            name={`permission-${module.module}`}
                                                                            checked={selectedPermissions[module.module] === perm.id}
                                                                            onChange={() => handlePermissionChange(module.module, perm.id)}
                                                                            className="mt-0.5 h-4 w-4 text-red-600"
                                                                        />
                                                                        <span className="text-sm text-gray-700">{perm.label}</span>
                                                                    </label>
                                                                ))}
                                                            </div>

                                                            {/* Notifications */}
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-700 mb-2">Notifications</p>
                                                                <div className="space-y-2">
                                                                    {module.notifications.map((notif) => (
                                                                        <label key={notif} className="flex items-center gap-2 cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedNotifications.includes(notif)}
                                                                                onChange={() => handleNotificationToggle(notif)}
                                                                                className="h-4 w-4 text-red-600 rounded"
                                                                            />
                                                                            <span className="text-sm text-gray-700">{notif}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t px-6 py-4 flex justify-end gap-3">
                            <button onClick={() => setShowPanel(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveRole}
                                disabled={!roleName.trim()}
                                className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                            >
                                {editingRole ? 'Update' : 'Create'} Role
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
