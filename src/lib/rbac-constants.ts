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

    // Proposal Permissions
    PROPOSALS_VIEW: 'proposals.view',
    PROPOSALS_CREATE: 'proposals.create',
    PROPOSALS_SEND: 'proposals.send',
    PROPOSALS_APPROVE: 'proposals.approve',
    PROPOSALS_REJECT: 'proposals.reject',
    PROPOSALS_DELETE: 'proposals.delete',

    // Order Permissions (Purchase Orders)
    ORDERS_VIEW: 'orders.view',
    ORDERS_CREATE: 'orders.create',
    ORDERS_EDIT: 'orders.edit',
    ORDERS_DELETE: 'orders.delete',

    // Invoice Permissions
    INVOICES_VIEW: 'invoices.view',
    INVOICES_CREATE: 'invoices.create',
    INVOICES_EDIT: 'invoices.edit',
    INVOICES_APPROVE: 'invoices.approve',
    INVOICES_DELETE: 'invoices.delete',

    // Payment Permissions
    PAYMENTS_VIEW: 'payments.view',
    PAYMENTS_CREATE: 'payments.create',
    PAYMENTS_EDIT: 'payments.edit',
    PAYMENTS_DELETE: 'payments.delete',

    // Supplier Permissions
    SUPPLIERS_VIEW: 'suppliers.view',
    SUPPLIERS_CREATE: 'suppliers.create',

    // Inventory Permissions
    INVENTORY_VIEW: 'inventory.view',
    INVENTORY_ADD: 'inventory.add',
    INVENTORY_APPROVE: 'inventory.approve',
    INVENTORY_APPROVE_BILL: 'inventory.approve_bill',
    INVENTORY_REJECT_BILL: 'inventory.reject_bill',
    INVENTORY_RESUBMIT_BILL: 'inventory.resubmit_bill',

    // Update Permissions (Work Progress)
    UPDATES_VIEW: 'updates.view',
    UPDATES_CREATE: 'updates.create',

    // Site Logs Permissions
    SITE_LOGS_VIEW: 'site_logs.view',
    SITE_LOGS_CREATE: 'site_logs.create',
    SITE_LOGS_EDIT: 'site_logs.edit',
    SITE_LOGS_DELETE: 'site_logs.delete',

    // Snag Permissions
    SNAGS_VIEW: 'snags.view',
    SNAGS_CREATE: 'snags.create',
    SNAGS_RESOLVE: 'snags.resolve',
    SNAGS_VERIFY: 'snags.verify',

    // Finance Permissions
    FINANCE_VIEW: 'finance.view',

    // User Management
    USERS_VIEW: 'users.view',
    USERS_CREATE: 'users.create',
    USERS_EDIT: 'users.edit',
    USERS_DELETE: 'users.delete',
    USERS_MANAGE_ROLES: 'users.manage_roles',

    // Settings Permissions
    SETTINGS_VIEW: 'settings.view',
    SETTINGS_EDIT: 'settings.edit',
    SETTINGS_WORKFLOWS: 'settings.workflows',

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

    // Attendance Approval
    ATTENDANCE_APPROVE: 'attendance.approve',

    // Payroll Permissions
    PAYROLL_VIEW: 'payroll.view',
    PAYROLL_MANAGE: 'payroll.manage',
    PAYROLL_CONFIG: 'payroll.config',
} as const;

export type PermissionNode = typeof PERMISSION_NODES[keyof typeof PERMISSION_NODES];
