'use client';

import { useEffect, useState, useRef } from 'react';
import { FiMoreVertical, FiEdit2, FiTrash2, FiX, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { DataTable } from '@/components/ui/DataTable';

interface Permission {
    id: string;
    name: string;
    code: string;
    module: string;
}

interface Role {
    id: string;
    name: string;
    description: string;
    is_system: boolean;
    user_count: number;
    permissions?: Permission[];
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

// Module permissions based on granular RBAC system
// Permission IDs map to PERMISSION_NODES in src/lib/rbac.ts
// NOTE: prefixes array includes both singular and plural forms to match DB permissions
const MODULE_PERMISSIONS: ModulePermission[] = [
    {
        module: 'Project Management',
        icon: '📋',
        permissions: [
            { id: 'project.view', label: 'View project details' },
            { id: 'project.view_budget', label: 'View project budget and financials' },
            { id: 'project.edit', label: 'Edit project details' },
            { id: 'project.create', label: 'Create new projects' },
            { id: 'project.delete', label: 'Delete projects' }
        ],
        notifications: ['Project updates', 'Project comments']
    },
    {
        module: 'Site Visit',
        icon: '🏗️',
        permissions: [
            { id: 'site_visit.view', label: 'View site visit reports' },
            { id: 'site_visit.create', label: 'Create and upload site visits' },
            { id: 'site_visit.approve', label: 'Approve site visit reports (without create)' }
        ],
        notifications: ['Site visit creation', 'Site visit start', 'Site visit update']
    },
    {
        module: 'Design',
        icon: '🎨',
        permissions: [
            { id: 'design.view_approved', label: 'View approved designs only' },
            { id: 'design.view_all', label: 'View all designs' },
            { id: 'design.upload', label: 'Upload design files' },
            { id: 'design.approve', label: 'Approve/Reject designs (without upload)' },
            { id: 'design.freeze', label: 'Freeze/Unfreeze designs' }
        ],
        notifications: ['Design approve', 'Design freeze', 'New version uploaded', 'New version external uploaded']
    },
    {
        module: 'BOQ',
        icon: '📊',
        permissions: [
            { id: 'boq.view', label: 'View BOQ items' },
            { id: 'boq.create', label: 'Create and edit BOQ items' },
            { id: 'boq.import', label: 'Import BOQ from Excel' },
            { id: 'boq.approve', label: 'Approve BOQ items (without create)' }
        ],
        notifications: ['BOQ created', 'BOQ updated', 'BOQ approved']
    },
    {
        module: 'Proposals',
        icon: '📝',
        permissions: [
            { id: 'proposal.view', label: 'View proposals' },
            { id: 'proposal.create', label: 'Create and send proposals' },
            { id: 'proposal.approve', label: 'Approve/Reject proposals (without create)' }
        ],
        notifications: ['Proposal rejected', 'Proposal sent', 'Proposal approved']
    },
    {
        module: 'Orders',
        icon: '🛒',
        permissions: [
            { id: 'order.view', label: 'View orders' },
            { id: 'order.create', label: 'Create purchase orders' },
            { id: 'order.edit', label: 'Edit orders' },
            { id: 'order.delete', label: 'Delete orders' },
            { id: 'order.approve', label: 'Approve purchase orders' }
        ],
        notifications: ['Order created', 'Order approved']
    },
    {
        module: 'Invoices',
        icon: '🧾',
        permissions: [
            { id: 'invoice.view', label: 'View invoices' },
            { id: 'invoice.create', label: 'Create invoices' },
            { id: 'invoice.edit', label: 'Edit invoices' },
            { id: 'invoice.approve', label: 'Approve invoices' },
            { id: 'invoice.delete', label: 'Delete invoices' }
        ],
        notifications: ['Invoice created', 'Invoice approved']
    },
    {
        module: 'Payments',
        icon: '💰',
        permissions: [
            { id: 'payment.view', label: 'View payments' },
            { id: 'payment.create', label: 'Record payments' },
            { id: 'payment.edit', label: 'Edit payments' },
            { id: 'payment.delete', label: 'Delete payments' },
            { id: 'payment.approve', label: 'Approve payments' }
        ],
        notifications: ['Payment received', 'Payment approved']
    },
    {
        module: 'Suppliers',
        icon: '🏭',
        permissions: [
            { id: 'supplier.view', label: 'View suppliers' },
            { id: 'supplier.create', label: 'Create suppliers' }
        ],
        notifications: []
    },
    {
        module: 'Inventory',
        icon: '📦',
        permissions: [
            { id: 'inventory.view', label: 'View inventory' },
            { id: 'inventory.add', label: 'Add inventory items' },
            { id: 'inventory.remove', label: 'Remove/Adjust inventory' },
            { id: 'inventory.approve', label: 'Approve inventory bills' }
        ],
        notifications: ['Inventory low', 'Inventory added']
    },
    {
        module: 'Snag & Audit',
        icon: '🔍',
        permissions: [
            { id: 'snag.view', label: 'View snags' },
            { id: 'snag.create', label: 'Create snags' },
            { id: 'snag.resolve', label: 'Resolve snags (without create)' },
            { id: 'snag.verify', label: 'Verify resolved snags' }
        ],
        notifications: ['Snag created', 'Snag resolved', 'Snag verified']
    },
    {
        module: 'Daily Site Logs',
        icon: '📋',
        permissions: [
            { id: 'site_logs.view', label: 'View daily logs' },
            { id: 'site_logs.create', label: 'Create daily logs' },
            { id: 'site_logs.edit', label: 'Edit daily logs' },
            { id: 'site_logs.delete', label: 'Delete daily logs' }
        ],
        notifications: ['New daily log']
    },
    {
        module: 'Updates',
        icon: '📣',
        permissions: [
            { id: 'update.view', label: 'View updates' },
            { id: 'update.create', label: 'Create updates' }
        ],
        notifications: ['New update posted']
    },
    {
        module: 'Tasks',
        icon: '✅',
        permissions: [
            { id: 'task.view', label: 'View tasks' },
            { id: 'task.create', label: 'Create tasks' },
            { id: 'task.edit', label: 'Edit tasks' },
            { id: 'task.bulk', label: 'Bulk task operations' }
        ],
        notifications: ['Task assigned', 'Task completed']
    },
    {
        module: 'Finance',
        icon: '💵',
        permissions: [
            { id: 'finance.view', label: 'View finance overview' }
        ],
        notifications: []
    },
    {
        module: 'User & Role Management',
        icon: '👥',
        permissions: [
            { id: 'user.view', label: 'View team members' },
            { id: 'user.create', label: 'Add new users' },
            { id: 'user.edit', label: 'Edit user details' },
            { id: 'user.delete', label: 'Remove users' },
            { id: 'role.manage', label: 'Manage roles and permissions' }
        ],
        notifications: ['New user added', 'User role changed']
    },
    {
        module: 'Settings',
        icon: '⚙️',
        permissions: [
            { id: 'settings.view', label: 'View settings' },
            { id: 'settings.edit', label: 'Edit settings' },
            { id: 'settings.workflows', label: 'Manage workflows' }
        ],
        notifications: []
    }
];

// Helper to get permission code prefix for matching
const getPermissionPrefix = (code: string): string => {
    const parts = code.split('.');
    return parts[0] + '.';
};

// Map of module names to their permission prefixes (including plural forms from DB)
const MODULE_PREFIX_MAP: Record<string, string[]> = {
    'Project Management': ['project.', 'projects.'],
    'Site Visit': ['site_visit.'],
    'Design': ['design.', 'designs.'],
    'BOQ': ['boq.'],
    'Proposals': ['proposal.', 'proposals.'],
    'Orders': ['order.', 'orders.'],
    'Invoices': ['invoice.', 'invoices.'],
    'Payments': ['payment.', 'payments.'],
    'Suppliers': ['supplier.', 'suppliers.'],
    'Inventory': ['inventory.'],
    'Snag & Audit': ['snag.', 'snags.'],
    'Daily Site Logs': ['site_logs.'],
    'Updates': ['update.', 'updates.'],
    'Tasks': ['task.', 'tasks.'],
    'Finance': ['finance.'],
    'User & Role Management': ['user.', 'users.', 'role.'],
    'Settings': ['settings.']
};

export default function RolesTab() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [allPermissions, setAllPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPanel, setShowPanel] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

    // Form state
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [expandedModules, setExpandedModules] = useState<string[]>([]);
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
    const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);

    useEffect(() => {
        fetchRoles();
        fetchAllPermissions();
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

    const fetchAllPermissions = async () => {
        try {
            const res = await fetch('/api/rbac/permissions');
            const data = await res.json();
            if (data.permissions) {
                setAllPermissions(data.permissions);
            }
        } catch (error) {
            console.error('Error fetching permissions:', error);
        }
    };

    const handleAddRole = () => {
        setEditingRole(null);
        setRoleName('');
        setRoleDescription('');
        setSelectedPermissionIds(new Set());
        setSelectedNotifications([]);
        setExpandedModules([]);
        setShowPanel(true);
    };

    const handleEditRole = (role: Role) => {
        setEditingRole(role);
        setRoleName(role.name);
        setRoleDescription(role.description || '');

        // Load existing permission IDs directly
        const existingPermIds = new Set<string>();
        const existingNotifications: string[] = [];
        const modulesToExpand: string[] = [];

        if (role.permissions && role.permissions.length > 0) {
            role.permissions.forEach(permission => {
                existingPermIds.add(permission.id);
                // Find which module to expand
                const module = permission.module;
                if (module && !modulesToExpand.includes(module)) {
                    modulesToExpand.push(module);
                }
            });
        }

        setSelectedPermissionIds(existingPermIds);
        setSelectedNotifications(existingNotifications);
        setExpandedModules(modulesToExpand);
        setShowPanel(true);
    };

    const handleSaveRole = async () => {
        if (!roleName.trim()) {
            alert('Role name is required');
            return;
        }

        try {
            // Get permission IDs directly from the selected set
            const permissionIds = Array.from(selectedPermissionIds);

            let roleId = editingRole?.id;

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
                        permission_ids: permissionIds
                    })
                });
                if (!res.ok) {
                    const data = await res.json();
                    alert(data.error || 'Failed to create role');
                    return;
                }
                const data = await res.json();
                roleId = data.role?.id;
            }

            // Save permissions for the role (both create and update)
            if (roleId && permissionIds.length > 0) {
                const permRes = await fetch(`/api/rbac/roles/${roleId}/permissions`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ permission_ids: permissionIds })
                });
                if (!permRes.ok) {
                    console.error('Failed to save permissions');
                }
            } else if (roleId && editingRole) {
                // Clear permissions if none selected during update
                await fetch(`/api/rbac/roles/${roleId}/permissions`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ permission_ids: [] })
                });
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

    const handlePermissionChange = (permissionId: string) => {
        setSelectedPermissionIds(prev => {
            const next = new Set(prev);
            if (next.has(permissionId)) {
                next.delete(permissionId);
            } else {
                next.add(permissionId);
            }
            return next;
        });
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
                <button onClick={handleAddRole} className="btn-primary">
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
                            <button onClick={() => setShowPanel(false)} className="btn-ghost rounded-full">
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
                                        disabled={editingRole?.is_system}
                                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${editingRole?.is_system ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Type *</label>
                                    <input
                                        type="text"
                                        value={editingRole?.is_system ? 'System' : 'Custom'}
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
                                        {/* Group permissions by module from API */}
                                        {(() => {
                                            // 1. Group permissions from API by their code prefix using MODULE_PREFIX_MAP
                                            const groupedByConstant: Record<string, typeof allPermissions> = {};
                                            const otherPermissions: typeof allPermissions = [];

                                            allPermissions.forEach(perm => {
                                                // Find matching module by checking permission code prefix
                                                let foundModule: string | null = null;

                                                for (const [moduleName, prefixes] of Object.entries(MODULE_PREFIX_MAP)) {
                                                    if (prefixes.some(prefix => perm.code.startsWith(prefix))) {
                                                        foundModule = moduleName;
                                                        break;
                                                    }
                                                }

                                                if (foundModule) {
                                                    if (!groupedByConstant[foundModule]) groupedByConstant[foundModule] = [];
                                                    groupedByConstant[foundModule].push(perm);
                                                } else {
                                                    otherPermissions.push(perm);
                                                }
                                            });

                                            // 2. Render modules in defined order
                                            return (
                                                <>
                                                    {MODULE_PERMISSIONS.map(def => {
                                                        const perms = groupedByConstant[def.module] || [];
                                                        if (perms.length === 0) return null; // Hide empty modules

                                                        const isExpanded = expandedModules.includes(def.module);
                                                        const hasSelectedPerm = perms.some(p => selectedPermissionIds.has(p.id));

                                                        return (
                                                            <div key={def.module} className="border-b border-gray-200 last:border-0">
                                                                <button
                                                                    onClick={() => toggleModule(def.module)}
                                                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
                                                                >
                                                                    {isExpanded ? (
                                                                        <FiChevronDown className="h-4 w-4 text-gray-400" />
                                                                    ) : (
                                                                        <FiChevronRight className="h-4 w-4 text-gray-400" />
                                                                    )}
                                                                    <span className={`w-5 h-5 rounded flex items-center justify-center text-sm ${hasSelectedPerm ? 'bg-amber-100 text-amber-600' : 'bg-gray-100'}`}>
                                                                        {def.icon}
                                                                    </span>
                                                                    <span className="text-sm font-medium text-gray-900">{def.module}</span>
                                                                </button>

                                                                {isExpanded && (
                                                                    <div className="px-4 pb-4">
                                                                        <div className="space-y-2">
                                                                            {perms.map((perm) => (
                                                                                <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={selectedPermissionIds.has(perm.id)}
                                                                                        onChange={() => handlePermissionChange(perm.id)}
                                                                                        className="mt-0.5 h-4 w-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                                                                                    />
                                                                                    <span className="text-sm text-gray-700">{perm.description || perm.code}</span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Render "Other" permissions if any */}
                                                    {otherPermissions.length > 0 && (
                                                        <div className="border-b border-gray-200 last:border-0">
                                                            <button
                                                                onClick={() => toggleModule('Other')}
                                                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
                                                            >
                                                                {expandedModules.includes('Other') ? <FiChevronDown /> : <FiChevronRight />}
                                                                <span className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-sm">?</span>
                                                                <span className="text-sm font-medium text-gray-900">Other</span>
                                                            </button>
                                                            {expandedModules.includes('Other') && (
                                                                <div className="px-4 pb-4 space-y-2">
                                                                    {otherPermissions.map(perm => (
                                                                        <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedPermissionIds.has(perm.id)}
                                                                                onChange={() => handlePermissionChange(perm.id)}
                                                                                className="mt-0.5 h-4 w-4 text-amber-600 rounded"
                                                                            />
                                                                            <span className="text-sm text-gray-700">{perm.description || perm.code}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t px-6 py-4 flex justify-end gap-3">
                            <button onClick={() => setShowPanel(false)} className="btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveRole}
                                disabled={!roleName.trim()}
                                className="btn-primary disabled:opacity-50"
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
