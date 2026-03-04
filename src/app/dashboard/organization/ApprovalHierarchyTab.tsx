'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { CustomDropdown } from '@/components/ui/CustomControls';

export default function ApprovalHierarchyTab() {
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newRule, setNewRule] = useState({
        entity_type: 'purchase_order',
        min_amount: 0,
        approver_role: 'admin',
        sequence_order: 1
    });

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/org/workflows');
            const data = await res.json();
            if (data.workflows) {
                setWorkflows(data.workflows);
            }
        } catch (error) {
            console.error('Error fetching workflows:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRule = async () => {
        try {
            const res = await fetch('/api/org/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRule)
            });
            if (res.ok) {
                setShowAddModal(false);
                fetchWorkflows();
            }
        } catch (error) {
            console.error('Error adding rule:', error);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Delete this rule?')) return;
        try {
            const res = await fetch(`/api/org/workflows?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchWorkflows();
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Approval Workflows</h3>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary flex items-center shadow-sm"
                >
                    <FiPlus className="mr-2 h-4 w-4" /> Add Rule
                </button>
            </div>

            <div className="bg-white shadow overflow-hidden rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approver</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {workflows.map((wf) => (
                            <tr key={wf.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{wf.entity_type.replace('_', ' ')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {`> ₹${wf.min_amount}`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{wf.approver_role}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleDeleteRule(wf.id)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <FiTrash2 className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {workflows.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No active workflows defined.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white p-6 rounded-lg w-96 space-y-4">
                        <h3 className="text-lg font-bold">Add Approval Rule</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Entity</label>
                            <CustomDropdown
                                value={newRule.entity_type}
                                onChange={(val) => setNewRule({ ...newRule, entity_type: val })}
                                options={[
                                    { id: 'purchase_order', title: 'Purchase Order' },
                                    { id: 'payment', title: 'Payment' }
                                ]}
                                placeholder="Select Entity"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Min Amount (₹)</label>
                            <input
                                type="number"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                                value={newRule.min_amount}
                                onChange={(e) => setNewRule({ ...newRule, min_amount: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Approver Role</label>
                            <CustomDropdown
                                value={newRule.approver_role}
                                onChange={(val) => setNewRule({ ...newRule, approver_role: val })}
                                options={[
                                    { id: 'admin', title: 'Admin' },
                                    { id: 'manager', title: 'Manager (N/A)' }
                                ]}
                                placeholder="Select Role"
                            />
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddRule}
                                className="btn-primary"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
