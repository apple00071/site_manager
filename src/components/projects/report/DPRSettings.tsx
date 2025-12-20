'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiUsers, FiCamera, FiCheck, FiX, FiMail, FiPhone, FiUser } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';

interface DPRSettingsProps {
    projectId: string;
    onClose: () => void;
}

export function DPRSettings({ projectId, onClose }: DPRSettingsProps) {
    const [activeTab, setActiveTab] = useState<'subscribers' | 'viewpoints'>('subscribers');
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [viewpoints, setViewpoints] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { showToast } = useToast();

    // New item forms
    const [newSub, setNewSub] = useState({ name: '', email: '', phone_number: '' });
    const [newVP, setNewVP] = useState({ name: '', description: '' });

    const fetchData = async () => {
        setIsLoading(true);
        const [subRes, vpRes] = await Promise.all([
            fetch(`/api/reports/subscribers?project_id=${projectId}`),
            fetch(`/api/reports/viewpoints?project_id=${projectId}`)
        ]);
        const subData = await subRes.json();
        const vpData = await vpRes.json();
        setSubscribers(subData.subscribers);
        setViewpoints(vpData.viewpoints);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const addSubscriber = async () => {
        if (!newSub.name || (!newSub.email && !newSub.phone_number)) {
            showToast('error', 'Name and at least one contact method required');
            return;
        }
        const res = await fetch('/api/reports/subscribers', {
            method: 'POST',
            body: JSON.stringify({ ...newSub, project_id: projectId })
        });
        if (res.ok) {
            showToast('success', 'Subscriber added');
            setNewSub({ name: '', email: '', phone_number: '' });
            fetchData();
        }
    };

    const addViewpoint = async () => {
        if (!newVP.name) return;
        const res = await fetch('/api/reports/viewpoints', {
            method: 'POST',
            body: JSON.stringify({ ...newVP, project_id: projectId })
        });
        if (res.ok) {
            showToast('success', 'Viewpoint defined');
            setNewVP({ name: '', description: '' });
            fetchData();
        }
    };

    const deleteItem = async (type: 'subscribers' | 'viewpoints', id: string) => {
        const res = await fetch(`/api/reports/${type}?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('success', 'Deleted');
            fetchData();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-20">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">DPR Settings</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Configure report automation</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                    <FiX className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
            </div>

            <div className="flex border-b border-gray-100">
                <button
                    onClick={() => setActiveTab('subscribers')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'subscribers' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-400'}`}
                >
                    Subscribers
                </button>
                <button
                    onClick={() => setActiveTab('viewpoints')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'viewpoints' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-400'}`}
                >
                    Camera Viewpoints
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {activeTab === 'subscribers' ? (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase">Add Subscriber</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                    placeholder="Name"
                                    value={newSub.name}
                                    onChange={e => setNewSub({ ...newSub, name: e.target.value })}
                                    className="p-2 text-sm border border-gray-200 rounded-lg outline-none"
                                />
                                <input
                                    placeholder="Email"
                                    value={newSub.email}
                                    onChange={e => setNewSub({ ...newSub, email: e.target.value })}
                                    className="p-2 text-sm border border-gray-200 rounded-lg outline-none"
                                />
                                <input
                                    placeholder="Phone (WhatsApp)"
                                    value={newSub.phone_number}
                                    onChange={e => setNewSub({ ...newSub, phone_number: e.target.value })}
                                    className="p-2 text-sm border border-gray-200 rounded-lg outline-none"
                                />
                            </div>
                            <button
                                onClick={addSubscriber}
                                className="w-full py-2 bg-gray-900 text-white text-sm font-bold rounded-lg"
                            >
                                Add to List
                            </button>
                        </div>

                        <div className="space-y-3">
                            {subscribers.map(sub => (
                                <div key={sub.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                                            {sub.name[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{sub.name}</p>
                                            <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                                {sub.email && <span className="flex items-center gap-1"><FiMail /> {sub.email}</span>}
                                                {sub.phone_number && <span className="flex items-center gap-1"><FiPhone /> {sub.phone_number}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => deleteItem('subscribers', sub.id)} className="p-2 text-gray-400 hover:text-red-500">
                                        <FiTrash2 />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase">Define Camera Viewpoint</h4>
                            <input
                                placeholder="Viewpoint Name (e.g. Master Bedroom Corner)"
                                value={newVP.name}
                                onChange={e => setNewVP({ ...newVP, name: e.target.value })}
                                className="w-full p-2 text-sm border border-gray-200 rounded-lg outline-none"
                            />
                            <textarea
                                placeholder="Instructions (e.g. Stand at the door, zoom 1x)"
                                value={newVP.description}
                                onChange={e => setNewVP({ ...newVP, description: e.target.value })}
                                className="w-full p-2 text-sm border border-gray-200 rounded-lg outline-none"
                            />
                            <button
                                onClick={addViewpoint}
                                className="w-full py-2 bg-gray-900 text-white text-sm font-bold rounded-lg"
                            >
                                Save Viewpoint
                            </button>
                        </div>

                        <div className="space-y-3">
                            {viewpoints.map(vp => (
                                <div key={vp.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                                            <FiCamera />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{vp.name}</p>
                                            <p className="text-xs text-gray-500">{vp.description}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => deleteItem('viewpoints', vp.id)} className="p-2 text-gray-400 hover:text-red-500">
                                        <FiTrash2 />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-50 bg-gray-50 sticky bottom-0 z-20">
                <button onClick={onClose} className="w-full py-2.5 bg-gray-200 text-gray-700 font-bold rounded-xl active:scale-95 transition-transform">
                    Close Settings
                </button>
            </div>
        </div>
    );
}
