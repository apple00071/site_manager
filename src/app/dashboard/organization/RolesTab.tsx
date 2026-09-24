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

import { PERMISSION_NODES } from '@/lib/rbac-constants';
import { clearPermissionsCache } from '@/hooks/useUserPermissions';

// Module permissions based on granular RBAC system
// Permission IDs map to actual database permission codes (projects.*, designs.*, etc.)
const MODULE_PERMISSIONS: ModulePermission[] = [
    {
        module: 'Project Management',
        icon: '📋',
        permissions: [
            { id: 'projects.view', label: 'View projects' },
            { id: 'projects.view_all', label: 'View all projects (not just assigned)' },
            { id: 'projects.view_budget', label: 'View project budget and financials' },
            { id: 'projects.create', label: 'Create new projects' },
            { id: 'projects.edit', label: 'Edit project details' },
            { id: 'projects.delete', label: 'Delete projects' },
            { id: 'projects.assign', label: 'Assign projects to team members' }
        ],
        notifications: ['Project updates', 'Project comments']
    },
    {
        module: 'Design Status',
        icon: '📑',
        permissions: [
            { id: 'designs.daily_status', label: 'View & update daily design status tracker' }
        ],
        notifications: ['Design status updated']
    },
    {
        module: 'Design',
        icon: '🎨',
        permissions: [
            { id: 'designs.view', label: 'View design files' },
            { id: 'designs.upload', label: 'Upload design files' },
            { id: 'designs.approve', label: 'Approve/Reject designs' },
            { id: 'designs.freeze', label: 'Freeze/Unfreeze designs' },
            { id: 'designs.comment', label: 'Comment on designs' },
            { id: 'designs.delete', label: 'Delete design files' }
        ],
        notifications: ['Design approve', 'Design freeze', 'New version uploaded', 'New version external uploaded']
    },
    {
        module: 'BOQ',
        icon: '📊',
        permissions: [
            { id: 'boq.view', label: 'View BOQ items' },
            { id: 'boq.create', label: 'Create BOQ items' },
            { id: 'boq.edit', label: 'Edit BOQ items' },
            { id: 'boq.delete', label: 'Delete BOQ items' },
            { id: 'boq.import', label: 'Import BOQ from Excel' },
            { id: 'boq.delivery', label: 'Manage deliveries & upload bills/challans' },
            { id: 'boq.proposals', label: 'Create & view client proposals' }
        ],
        notifications: ['BOQ created', 'BOQ updated', 'BOQ approved']
    },
    {
        module: 'Vendors & Contract Workers',
        icon: '👷',
        permissions: [
            { id: 'vendors.view', label: 'View vendors and contract workers' },
            { id: 'vendors.create', label: 'Register new vendors/subcontractors' },
            { id: 'vendors.edit', label: 'Edit vendor details' },
            { id: 'vendors.delete', label: 'Delete vendors' },
            { id: 'workers.view', label: 'View contract workers' },
            { id: 'workers.create', label: 'Register contract workers' },
            { id: 'workers.edit', label: 'Edit worker details & wages' },
            { id: 'workers.delete', label: 'Delete contract workers' },
            { id: 'workers.assign', label: 'Assign workers to project sites' },
            { id: 'suppliers.view', label: 'View material suppliers' },
            { id: 'suppliers.create', label: 'Register material suppliers' }
        ],
        notifications: ['Worker assigned', 'Vendor registered']
    },
    {
        module: 'Snag & Audit',
        icon: '🔍',
        permissions: [
            { id: 'snags.view', label: 'View assigned snags' },
            { id: 'snags.view_all', label: 'View all snags across sites (not just assigned)' },
            { id: 'snags.create', label: 'Create snags' },
            { id: 'snags.update', label: 'Update snag details' },
            { id: 'snags.edit', label: 'Edit snags' },
            { id: 'snags.resolve', label: 'Resolve snags' },
            { id: 'snags.verify', label: 'Verify resolved snags' }
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
            { id: 'updates.view', label: 'View project updates' },
            { id: 'updates.create', label: 'Post project updates' }
        ],
        notifications: ['New update posted']
    },
    {
        module: 'Tasks',
        icon: '✅',
        permissions: [
            { id: 'tasks.view', label: 'View tasks' },
            { id: 'tasks.create', label: 'Create tasks' },
            { id: 'tasks.edit', label: 'Edit tasks' },
            { id: 'tasks.bulk', label: 'Bulk task operations' }
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
        module: 'Project Expenses & Inventory',
        icon: '📦',
        permissions: [
            { id: 'inventory.view', label: 'View project expenses' },
            { id: 'inventory.add', label: 'Add project expense items' },
            { id: 'inventory.edit', label: 'Edit expense items' },
            { id: 'inventory.delete', label: 'Delete expense items' },
            { id: 'inventory.remove', label: 'Remove inventory items' },
            { id: 'inventory.approve', label: 'Approve expenses' },
            { id: 'inventory.approve_bill', label: 'Approve expense bills' },
            { id: 'inventory.reject_bill', label: 'Reject expense bills' },
            { id: 'inventory.resubmit_bill', label: 'Resubmit expense bills' }
        ],
        notifications: ['Expense added', 'Expense approved']
    },
    {
        module: 'Office Expenses',
        icon: '🏢',
        permissions: [
            { id: 'office_expenses.view', label: 'View office expenses' },
            { id: 'office_expenses.create', label: 'Add office expenses' },
            { id: 'office_expenses.approve', label: 'Approve office expenses' },
            { id: 'office_expenses.delete', label: 'Delete office expenses' }
        ],
        notifications: ['Office expense added', 'Office expense approved']
    },
    {
        module: 'Attendance & Leaves',
        icon: '⏱️',
        permissions: [
            { id: 'attendance.view', label: 'View own attendance logs' },
            { id: 'attendance.view_all', label: 'View all employees attendance logs' },
            { id: 'attendance.view_appeals', label: 'View attendance appeal remarks' },
            { id: 'attendance.log', label: 'Punch in/out' },
            { id: 'attendance.approve', label: 'Approve attendance appeals' },
            { id: 'leaves.view', label: 'View leave requests' },
            { id: 'leaves.apply', label: 'Apply for leaves' },
            { id: 'leaves.approve', label: 'Approve/Reject leaves' },
            { id: 'leaves.manage', label: 'Manage all leave requests' }
        ],
        notifications: ['Leave applied', 'Leave approved', 'Leave rejected']
    },
    {
        module: 'Payroll',
        icon: '💳',
        permissions: [
            { id: 'payroll.view', label: 'View payroll history' },
            { id: 'payroll.manage', label: 'Manage/Process payrolls' },
            { id: 'payroll.config', label: 'Configure employee salaries' }
        ],
        notifications: ['Payroll processed', 'Salary paid']
    },
    {
        module: 'CRM & Leads',
        icon: '💼',
        permissions: [
            { id: 'crm.view', label: 'View CRM leads & quotations' },
            { id: 'crm.manage', label: 'Manage CRM leads, stages & quotations' },
            { id: 'crm.edit_approved', label: 'Modify approved quotations & leads' },
            { id: 'rate_card.view', label: 'View quotation rate card' },
            { id: 'rate_card.manage', label: 'Manage rate card items & standard pricing' }
        ],
        notifications: ['New lead created', 'Quotation approved']
    },
    {
        module: 'Holidays',
        icon: '🏖️',
        permissions: [
            { id: 'holidays.view', label: 'View organization holidays' },
            { id: 'holidays.manage', label: 'Manage holiday calendar' }
        ],
        notifications: []
    },
    {
        module: 'User & Role Management',
        icon: '👥',
        permissions: [
            { id: 'users.view', label: 'View team members' },
            { id: 'users.create', label: 'Add new users' },
            { id: 'users.edit', label: 'Edit user details' },
            { id: 'users.delete', label: 'Remove users' },
            { id: 'users.manage_roles', label: 'Manage roles and permissions' },
            { id: 'users.manage_documents', label: 'Upload and manage employee documents' }
        ],
        notifications: ['New user added', 'User role changed']
    },
    {
        module: 'In-App Popups & Announcements',
        icon: '📢',
        permissions: [
            { id: 'popups.view', label: 'View popups and recipient history' },
            { id: 'popups.manage', label: 'Create, toggle, and delete in-app popups' }
        ],
        notifications: ['Popup published']
    },
    {
        module: 'Settings & System',
        icon: '⚙️',
        permissions: [
            { id: 'settings.view', label: 'View organization settings' },
            { id: 'settings.edit', label: 'Edit organization settings' },
            { id: 'settings.workflows', label: 'Manage approval workflows' },
            { id: 'telemetry.view', label: 'View App Telemetry' }
        ],
        notifications: []
    }
];

// Map of module names to their permission prefixes (including plural and singular forms)
const MODULE_PREFIX_MAP: Record<string, string[]> = {
    'Project Management': ['project.', 'projects.'],
    'Design Status': ['designs.daily_status', 'daily_status.'],
    'Design': ['design.', 'designs.'],
    'BOQ': ['boq.'],
    'Proposals': ['proposal.', 'proposals.'],
    'Orders': ['order.', 'orders.'],
    'Invoices': ['invoice.', 'invoices.'],
    'Payments': ['payment.', 'payments.'],
    'Procurement (Legacy)': ['procurement.'],
    'Vendors & Contract Workers': ['vendor.', 'vendors.', 'worker.', 'workers.', 'supplier.', 'suppliers.'],
    'Snag & Audit': ['snag.', 'snags.'],
    'Daily Site Logs': ['site_logs.', 'site_visit.'],
    'Updates': ['update.', 'updates.'],
    'Tasks': ['task.', 'tasks.'],
    'Finance': ['finance.'],
    'Project Expenses & Inventory': ['inventory.'],
    'Office Expenses': ['office_expenses.'],
    'Attendance & Leaves': ['attendance.', 'leaves.'],
    'Payroll': ['payroll.'],
    'CRM & Leads': ['crm.'],
    'Holidays': ['holidays.', 'holiday.'],
    'User & Role Management': ['user.', 'users.', 'role.'],
    'In-App Popups & Announcements': ['popup.', 'popups.'],
    'Settings & System': ['settings.', 'telemetry.']
};

export default function RolesTab() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [allPermissions, setAllPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPanel, setShowPanel] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
    const [saving, setSaving] = useState(false);

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
            setSaving(true);
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
                    const permError = await permRes.json();
                    console.error('Failed to save permissions:', permError);
                    alert(`Failed to save permissions: ${permError.error || 'Unknown error'}`);
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
            clearPermissionsCache();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('permissions-updated'));
            }
        } finally {
            setSaving(false);
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
                clearPermissionsCache();
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('permissions-updated'));
                }
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
                        className="flex items-center justify-center p-1 hover:bg-gray-100 rounded"
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
                    <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowPanel(false)} />
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
                                                                    <span className={`w-5 h-5 rounded flex items-center justify-center text-sm ${hasSelectedPerm ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100'}`}>
                                                                        {def.icon}
                                                                    </span>
                                                                    <span className="text-sm font-medium text-gray-900">{def.module}</span>
                                                                </button>

                                                                {isExpanded && (
                                                                    <div className="px-4 pb-4">
                                                                        <div className="space-y-2">
                                                                            {[...perms]
                                                                                .sort((a, b) => {
                                                                                    const idxA = def.permissions.findIndex(p => p.id === a.code);
                                                                                    const idxB = def.permissions.findIndex(p => p.id === b.code);
                                                                                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                                                                    if (idxA !== -1) return -1;
                                                                                    if (idxB !== -1) return 1;
                                                                                    return a.code.localeCompare(b.code);
                                                                                })
                                                                                .map((perm) => {
                                                                                    const friendlyLabel = def.permissions.find(p => p.id === perm.code || p.id.replace(/s\./, '.') === perm.code.replace(/s\./, '.'))?.label;
                                                                                    return (
                                                                                        <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={selectedPermissionIds.has(perm.id)}
                                                                                                onChange={() => handlePermissionChange(perm.id)}
                                                                                                className="mt-0.5 h-4 w-4 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
                                                                                            />
                                                                                            <span className="text-sm text-gray-700">{friendlyLabel || perm.description || perm.code}</span>
                                                                                        </label>
                                                                                    );
                                                                                })}
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
                                                                                className="mt-0.5 h-4 w-4 text-yellow-600 rounded"
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
                                disabled={!roleName.trim() || saving}
                                className="btn-primary disabled:opacity-50 flex items-center justify-center gap-2 min-w-[120px]"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <span>{editingRole ? 'Update' : 'Create'} Role</span>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
