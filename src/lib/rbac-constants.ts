/**
 * RBAC (Role-Based Access Control) Constants
 * 
 * This file contains the permission nodes that can be shared between
 * client and server components without pulling in server-side dependencies.
 */

export const PERMISSION_NODES = {
    // Project Permissions
    PROJECTS_VIEW: 'projects.view',
    PROJECTS_VIEW_ALL: 'projects.view_all',
    PROJECTS_CREATE: 'projects.create',
    PROJECTS_EDIT: 'projects.edit',
    PROJECTS_DELETE: 'projects.delete',
    PROJECTS_ASSIGN: 'projects.assign',
    PROJECTS_VIEW_BUDGET: 'projects.view_budget',

    // Design Permissions
    DESIGNS_VIEW: 'designs.view',
    DESIGNS_VIEW_ALL: 'designs.view_all',
    DESIGNS_DAILY_STATUS: 'designs.daily_status',
    DESIGNS_EXPORT: 'designs.export',
    DESIGNS_UPLOAD: 'designs.upload',
    DESIGNS_DELETE: 'designs.delete',
    DESIGNS_APPROVE: 'designs.approve',
    DESIGNS_FREEZE: 'designs.freeze',
    DESIGNS_COMMENT: 'designs.comment',

    // BOQ Permissions
    BOQ_VIEW: 'boq.view',
    BOQ_CREATE: 'boq.create',
    BOQ_EDIT: 'boq.edit',
    BOQ_DELETE: 'boq.delete',
    BOQ_IMPORT: 'boq.import',
    BOQ_DELIVERY: 'boq.delivery',
    BOQ_PROPOSALS: 'boq.proposals',

    // Supplier & Vendor Permissions
    SUPPLIERS_VIEW: 'suppliers.view',
    SUPPLIERS_CREATE: 'suppliers.create',
    VENDORS_VIEW: 'vendors.view',
    VENDORS_CREATE: 'vendors.create',
    VENDORS_EDIT: 'vendors.edit',
    VENDORS_DELETE: 'vendors.delete',

    // Contract Workers Permissions
    WORKERS_VIEW: 'workers.view',
    WORKERS_CREATE: 'workers.create',
    WORKERS_EDIT: 'workers.edit',
    WORKERS_DELETE: 'workers.delete',
    WORKERS_ASSIGN: 'workers.assign',

    // Inventory Permissions
    INVENTORY_VIEW: 'inventory.view',
    INVENTORY_ADD: 'inventory.add',
    INVENTORY_EDIT: 'inventory.edit',
    INVENTORY_DELETE: 'inventory.delete',
    INVENTORY_APPROVE: 'inventory.approve',
    INVENTORY_APPROVE_BILL: 'inventory.approve_bill',
    INVENTORY_REJECT_BILL: 'inventory.reject_bill',
    INVENTORY_RESUBMIT_BILL: 'inventory.resubmit_bill',
    INVENTORY_REMOVE: 'inventory.remove',

    // Update Permissions (Work Progress)
    UPDATES_VIEW: 'updates.view',
    UPDATES_CREATE: 'updates.create',
    UPDATES_EDIT: 'updates.edit',
    UPDATES_DELETE: 'updates.delete',

    // Site Logs Permissions
    SITE_LOGS_VIEW: 'site_logs.view',
    SITE_LOGS_CREATE: 'site_logs.create',
    SITE_LOGS_EDIT: 'site_logs.edit',
    SITE_LOGS_DELETE: 'site_logs.delete',

    // Snag Permissions
    SNAGS_VIEW: 'snags.view',
    SNAGS_VIEW_ALL: 'snags.view_all',
    SNAGS_CREATE: 'snags.create',
    SNAGS_UPDATE: 'snags.update',
    SNAGS_EDIT: 'snags.edit',
    SNAGS_RESOLVE: 'snags.resolve',
    SNAGS_VERIFY: 'snags.verify',

    // Holiday Permissions
    HOLIDAYS_VIEW: 'holidays.view',
    HOLIDAYS_MANAGE: 'holidays.manage',

    // Payroll Permissions
    PAYROLL_VIEW: 'payroll.view',
    PAYROLL_MANAGE: 'payroll.manage',

    // Finance Permissions
    FINANCE_VIEW: 'finance.view',
    FINANCE_MANAGE: 'finance.manage',

    // User Management
    USERS_VIEW: 'users.view',
    USERS_CREATE: 'users.create',
    USERS_EDIT: 'users.edit',
    USERS_DELETE: 'users.delete',
    USERS_MANAGE_ROLES: 'users.manage_roles',
    USERS_MANAGE_DOCUMENTS: 'users.manage_documents',

    // Settings Permissions
    SETTINGS_VIEW: 'settings.view',
    SETTINGS_EDIT: 'settings.edit',
    SETTINGS_WORKFLOWS: 'settings.workflows',

    // Telemetry Permissions
    TELEMETRY_VIEW: 'telemetry.view',

    // Task Permissions
    TASKS_VIEW: 'tasks.view',
    TASKS_CREATE: 'tasks.create',
    TASKS_EDIT: 'tasks.edit',
    TASKS_BULK: 'tasks.bulk',

    // Office Expenses Permissions
    OFFICE_EXPENSES_VIEW: 'office_expenses.view',
    OFFICE_EXPENSES_CREATE: 'office_expenses.create',
    OFFICE_EXPENSES_APPROVE: 'office_expenses.approve',
    OFFICE_EXPENSES_DELETE: 'office_expenses.delete',

    // Attendance & Leave Permissions
    ATTENDANCE_VIEW: 'attendance.view',
    ATTENDANCE_VIEW_ALL: 'attendance.view_all',
    ATTENDANCE_VIEW_APPEALS: 'attendance.view_appeals',
    ATTENDANCE_LOG: 'attendance.log',
    LEAVES_VIEW: 'leaves.view',
    LEAVES_APPLY: 'leaves.apply',
    LEAVES_APPROVE: 'leaves.approve',
    LEAVES_MANAGE: 'leaves.manage',

    // Attendance Approval
    ATTENDANCE_APPROVE: 'attendance.approve',

    PAYROLL_CONFIG: 'payroll.config',

    // CRM Permissions
    CRM_VIEW: 'crm.view',
    CRM_MANAGE: 'crm.manage',
    CRM_EDIT_APPROVED: 'crm.edit_approved',
    RATE_CARD_VIEW: 'rate_card.view',
    RATE_CARD_MANAGE: 'rate_card.manage',

    // In-App Popups & Announcements
    POPUPS_VIEW: 'popups.view',
    POPUPS_MANAGE: 'popups.manage',

} as const;

export type PermissionNode = typeof PERMISSION_NODES[keyof typeof PERMISSION_NODES];
