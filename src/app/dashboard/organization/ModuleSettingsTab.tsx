'use client';

import { useState, useMemo } from 'react';
import { FiPlus, FiSettings, FiEye, FiEyeOff, FiMapPin, FiFile, FiList, FiPackage, FiTool, FiCheckSquare, FiDollarSign } from 'react-icons/fi';

// Actual stages and sub-tabs from SubTabNav.tsx
const PROJECT_STAGES = [
    {
        id: 'visit',
        name: 'Site Visit',
        icon: FiMapPin,
        subTabs: [
            { id: 'details', label: 'Project Details' },
            { id: 'workers', label: 'Worker Details' },
        ]
    },
    {
        id: 'design',
        name: 'Design',
        icon: FiFile,
        subTabs: []
    },
    {
        id: 'boq',
        name: 'BOQ',
        icon: FiList,
        subTabs: [
            { id: 'boq', label: 'BOQ Items' },
        ]
    },
    {
        id: 'orders',
        name: 'Orders',
        icon: FiPackage,
        subTabs: [
            { id: 'proposals', label: 'Proposals For Client' },
            { id: 'client_orders', label: 'Client Orders' },
            { id: 'client_invoices', label: 'Client Invoices' },
            { id: 'payments_from_client', label: 'Payments From Client' },
            { id: 'my_scope', label: 'My Scope' },
        ]
    },
    {
        id: 'work_progress',
        name: 'Work Progress',
        icon: FiTool,
        subTabs: [
            { id: 'inventory', label: 'Inventory' },
            { id: 'updates', label: 'Updates' },
        ]
    },
    {
        id: 'snag',
        name: 'Snag / Audit',
        icon: FiCheckSquare,
        subTabs: [
            { id: 'snag_list', label: 'Snag List' },
        ]
    },
    {
        id: 'finance',
        name: 'Finance',
        icon: FiDollarSign,
        subTabs: [
            { id: 'finance_overview', label: 'Finance Overview' },
        ]
    },
];

export default function ModuleSettingsTab() {
    // Use stage ID instead of full object to avoid reference issues
    const [selectedStageId, setSelectedStageId] = useState('orders');
    const [enabledSubTabs, setEnabledSubTabs] = useState<Record<string, string[]>>({
        visit: ['details', 'workers'],
        design: [],
        boq: ['boq'],
        orders: ['proposals', 'client_orders', 'client_invoices', 'payments_from_client', 'my_scope'],
        work_progress: ['inventory', 'updates'],
        snag: ['snag_list'],
        finance: ['finance_overview'],
    });
    const [stageEnabled, setStageEnabled] = useState<Record<string, boolean>>({
        visit: true,
        design: true,
        boq: true,
        orders: true,
        work_progress: true,
        snag: true,
        finance: true,
    });

    // Derive selectedStage from ID
    const selectedStage = useMemo(() => {
        return PROJECT_STAGES.find(s => s.id === selectedStageId) || PROJECT_STAGES[0];
    }, [selectedStageId]);

    const toggleSubTab = (subTabId: string) => {
        setEnabledSubTabs(prev => {
            const current = prev[selectedStageId] || [];
            const updated = current.includes(subTabId)
                ? current.filter(s => s !== subTabId)
                : [...current, subTabId];
            return { ...prev, [selectedStageId]: updated };
        });
    };

    const toggleStage = (stageId: string) => {
        setStageEnabled(prev => ({
            ...prev,
            [stageId]: !prev[stageId]
        }));
    };

    const isSubTabEnabled = (subTabId: string) => {
        return (enabledSubTabs[selectedStageId] || []).includes(subTabId);
    };

    return (
        <div className="flex h-[calc(100vh-220px)] min-h-[400px] bg-white rounded-lg shadow overflow-hidden">
            {/* Left Column: Project Stages (Tabs) */}
            <div className="w-56 border-r border-gray-200 bg-gray-50 overflow-y-auto flex flex-col">
                <div className="p-3 border-b border-gray-200 bg-white">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Project Stages (Tabs)</h4>
                </div>
                <nav className="p-2 space-y-1 flex-1">
                    {PROJECT_STAGES.map((stage) => {
                        const Icon = stage.icon;
                        const isActive = selectedStageId === stage.id;
                        const isEnabled = stageEnabled[stage.id];
                        return (
                            <div
                                key={stage.id}
                                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm cursor-pointer
                  ${isActive
                                        ? 'bg-white text-gray-900 shadow-sm font-medium border border-gray-200'
                                        : 'text-gray-600 hover:bg-white hover:text-gray-900'
                                    }
                  ${!isEnabled ? 'opacity-50' : ''}
                `}
                                onClick={() => setSelectedStageId(stage.id)}
                            >
                                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-amber-600' : 'text-gray-400'}`} />
                                <span className="truncate flex-1">{stage.name}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleStage(stage.id); }}
                                    className={`p-1 rounded ${isEnabled ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                    title={isEnabled ? 'Disable Stage' : 'Enable Stage'}
                                >
                                    {isEnabled ? <FiEye className="h-3.5 w-3.5" /> : <FiEyeOff className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* Middle Column: Stage Configuration */}
            <div className="flex-1 border-r border-gray-200 p-6 overflow-y-auto">
                <div className="mb-6">
                    <h3 className="text-base font-semibold text-gray-900">
                        {selectedStage.name} Configuration
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Configure options for this project stage
                    </p>
                </div>

                <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">Stage Visibility</span>
                            <button
                                onClick={() => toggleStage(selectedStageId)}
                                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${stageEnabled[selectedStageId]
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                    }`}
                            >
                                {stageEnabled[selectedStageId] ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            {stageEnabled[selectedStageId]
                                ? 'This stage is visible to all users in project view'
                                : 'This stage is hidden from project view'}
                        </p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100">
                        <span className="text-sm text-gray-700">Default Fields</span>
                        <FiSettings className="h-4 w-4 text-gray-400" />
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100">
                        <span className="text-sm text-gray-700">Permissions</span>
                        <FiSettings className="h-4 w-4 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Right Column: Sub-Tabs */}
            <div className="w-72 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-900">Sub-Tabs</h3>
                    <button className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                        <FiPlus className="h-4 w-4" />
                        Add Sub-Tab
                    </button>
                </div>

                <p className="text-sm text-gray-500 mb-4">
                    Select which sub-tabs to show in this stage
                </p>

                {selectedStage.subTabs.length === 0 ? (
                    <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
                        No sub-tabs for this stage
                    </div>
                ) : (
                    <div className="space-y-3">
                        {selectedStage.subTabs.map((subTab) => {
                            const checked = isSubTabEnabled(subTab.id);
                            return (
                                <label
                                    key={subTab.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked
                                            ? 'border-amber-300 bg-amber-50'
                                            : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSubTab(subTab.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className={`text-sm ${checked ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                                        {subTab.label}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
