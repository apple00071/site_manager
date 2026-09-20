'use client';

import React, { useState, useEffect } from 'react';
import { FiEdit2, FiPhone, FiPlus, FiUsers, FiMessageSquare } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';
import { ProjectUsersPanel } from '../ProjectUsersPanel';
import type { Project } from '../ProjectDetailsClient';

const TRADES = [
  { id: 'carpenter', title: 'Carpenter' },
  { id: 'electrician', title: 'Electrician' },
  { id: 'plumber', title: 'Plumber' },
  { id: 'painter', title: 'Painter' },
  { id: 'granite_worker', title: 'Granite & Marble' },
  { id: 'glass_worker', title: 'Glass & Aluminum' }
];

interface VisitTabProps {
  project: Project;
  canEditProject: boolean;
  isAdmin: boolean;
  onEdit: (section: 'info' | 'customer' | 'property' | 'workers' | null) => void;
  onEditWorker?: (worker: string) => void;
  activeSubTab: string;
  onProjectUpdated?: () => void;
}

const formatProjectCode = (project: any): string => {
  if (!project) return '-';
  if (project.project_code) return project.project_code;
  if (project.ref_no) return project.ref_no;

  const dateStr = project.created_at || project.start_date;
  const dateObj = dateStr ? new Date(dateStr) : new Date();
  const yearShort = !isNaN(dateObj.getTime()) ? dateObj.getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);

  // ponytail: Fallback for unassigned project codes without random hashing
  return `AI/${yearShort}/01`;
};

export const VisitTab: React.FC<VisitTabProps> = ({ 
  project, 
  canEditProject, 
  isAdmin, 
  onEdit,
  onEditWorker,
  activeSubTab,
  onProjectUpdated
}) => {
  const [siteWorkers, setSiteWorkers] = useState<any[]>([]);

  useEffect(() => {
    if (activeSubTab === 'workers' && project.id) {
      fetch(`/api/contract-workers?project_id=${project.id}`)
        .then(res => res.ok ? res.json() : { workers: [] })
        .then(data => setSiteWorkers(data.workers || []))
        .catch(() => setSiteWorkers([]));
    }
  }, [activeSubTab, project.id]);

  const assignedTrades = TRADES.filter(t => !!(project[`${t.id}_name` as keyof Project] as string)?.trim());
  const unassignedTrades = TRADES.filter(t => !(project[`${t.id}_name` as keyof Project] as string)?.trim());
  return (
    <div className="p-2 sm:p-4 md:p-6 w-full">
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 max-w-7xl mx-auto">
        <div className="flex-1 min-w-0 space-y-4 md:space-y-6">
          {activeSubTab === 'details' && (
            <>
              {/* Project Information */}
              <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Project Information</h3>
                  {canEditProject && (
                    <button 
                      onClick={() => onEdit('info')} 
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-full transition-colors"
                      aria-label="Edit Project Information"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Project ID</dt>
                    <dd className="text-xs font-mono font-bold text-gray-800 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200 inline-flex items-center gap-2 select-all break-all" title={`Full UUID: ${project.id}`}>
                      {formatProjectCode(project)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Description</dt>
                    <dd className="text-sm text-gray-900">{project.description || 'No description provided.'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Status</dt>
                    <dd className="text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        project.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 
                        project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' : 
                        project.status === 'handover' ? 'bg-purple-100 text-purple-800' : 
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status === 'pending' ? 'DESIGN PHASE' : 
                         project.status === 'in_progress' ? 'EXECUTION PHASE' : 
                         project.status === 'handover' ? 'HANDOVER PHASE' : 
                         project.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Start Date</dt>
                    <dd className="text-sm text-gray-900">{formatDateIST(project.start_date)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Expected Completion</dt>
                    <dd className="text-sm text-gray-900">{formatDateIST(project.estimated_completion_date)}</dd>
                  </div>
                  {project.project_budget && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Project Budget</dt>
                      <dd className="text-sm text-gray-900 font-medium">₹{project.project_budget.toLocaleString('en-IN')}</dd>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Details */}
              <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Customer & Contact Details</h3>
                  {canEditProject && (
                    <button 
                      onClick={() => onEdit('customer')} 
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-full transition-colors"
                      aria-label="Edit Customer Details"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Customer Name</dt>
                    <dd className="text-sm text-gray-900">{project.customer_name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Phone Number</dt>
                    <dd className="text-sm text-gray-900">
                      <a href={`tel:${project.phone_number}`} className="text-yellow-600 hover:text-yellow-700">{project.phone_number}</a>
                    </dd>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <dt className="text-sm font-medium text-gray-500 mb-1">Address</dt>
                  <dd className="text-sm text-gray-900 whitespace-pre-line">{project.address}</dd>
                </div>
              </div>

              {/* Property Details */}
              <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Property Details</h3>
                  {canEditProject && (
                    <button 
                      onClick={() => onEdit('property')} 
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-full transition-colors"
                      aria-label="Edit Property Details"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Property Type</dt>
                    <dd className="text-sm text-gray-900">{project.property_type?.replace(/\b\w/g, l => l.toUpperCase()) || 'Not specified'}</dd>
                  </div>
                  {project.apartment_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Apartment/Building</dt>
                      <dd className="text-sm text-gray-900">{project.apartment_name}</dd>
                    </div>
                  )}
                  {project.block_number && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Block Number</dt>
                      <dd className="text-sm text-gray-900">{project.block_number}</dd>
                    </div>
                  )}
                  {project.flat_number && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Flat Number</dt>
                      <dd className="text-sm text-gray-900">{project.flat_number}</dd>
                    </div>
                  )}
                  {project.floor_number && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Floor Number</dt>
                      <dd className="text-sm text-gray-900">{project.floor_number}</dd>
                    </div>
                  )}
                  {project.area_sqft && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Area (sq.ft)</dt>
                      <dd className="text-sm text-gray-900">{project.area_sqft}</dd>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {activeSubTab === 'workers' && (
            <div className="space-y-4">
              {assignedTrades.length === 0 ? (
                <div className="bg-white p-8 sm:p-10 rounded-xl border border-gray-200 text-center">
                  <FiUsers className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">No Vendors Assigned</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto mb-5">
                    No trade contractors or suppliers have been assigned to this project yet.
                  </p>
                  {canEditProject && (
                    <button
                      onClick={() => onEdit('workers')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 active:scale-[0.99] text-gray-950 font-semibold rounded-lg shadow-xs transition-all text-xs"
                    >
                      <FiPlus className="w-3.5 h-3.5" />
                      <span>Assign Vendors</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">Assigned Vendors</h3>
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                          {assignedTrades.length} of {TRADES.length} Assigned
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Trade contractors and registered suppliers assigned to this site
                      </p>
                    </div>
                    {canEditProject && (
                      <button
                        onClick={() => onEdit('workers')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-semibold rounded-lg text-xs shadow-xs transition-all shrink-0"
                      >
                        <FiEdit2 className="w-3 h-3" />
                        <span>Manage Vendors</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {assignedTrades.map((t) => {
                      const name = project[`${t.id}_name` as keyof Project] as string;
                      const phone = project[`${t.id}_phone` as keyof Project] as string;
                      const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
                      return (
                        <div 
                          key={t.id} 
                          className="p-3.5 bg-gray-50/60 hover:bg-white border border-gray-200 hover:border-gray-300 rounded-lg transition-all shadow-xs flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                {t.title}
                              </span>
                              {canEditProject && (
                                <button
                                  onClick={() => onEditWorker ? onEditWorker(t.id) : onEdit('workers')}
                                  className="opacity-60 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-1 rounded transition-colors"
                                  title={`Edit ${t.title}`}
                                >
                                  <FiEdit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 truncate" title={name}>
                              {name}
                            </h4>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-gray-200/60 flex items-center justify-between">
                            {phone ? (
                              <>
                                <a
                                  href={`tel:${phone}`}
                                  className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-yellow-600 font-medium transition-colors"
                                  title="Call Phone"
                                >
                                  <FiPhone className="w-3 h-3 text-gray-400" />
                                  <span>{phone}</span>
                                </a>
                                {cleanPhone && (
                                  <a
                                    href={`https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                                  >
                                    WhatsApp
                                  </a>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-gray-400 italic">No contact number</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {canEditProject && unassignedTrades.length > 0 && (
                    <div className="pt-2 text-xs text-gray-500 flex items-center justify-between">
                      <span>Unassigned: {unassignedTrades.map(t => t.title).join(', ')}</span>
                      <button
                        onClick={() => onEdit('workers')}
                        className="text-yellow-600 hover:text-yellow-700 font-medium underline ml-2"
                      >
                        Assign now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* On-Site Contract Workers if allocated */}
              {siteWorkers.length > 0 && (
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-bold text-gray-900">On-Site Contract Workers</h4>
                      <p className="text-xs text-gray-500">Allocated to this project from worker registry</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {siteWorkers.length} Worker{siteWorkers.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {siteWorkers.map((w: any) => (
                      <div key={w.id} className="p-3 bg-gray-50 border border-gray-200/70 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-gray-500">{w.trade || 'Worker'}</div>
                          <div className="text-sm font-bold text-gray-900">{w.full_name}</div>
                          {w.phone && (
                            <a href={`tel:${w.phone}`} className="text-xs text-yellow-700 hover:underline inline-flex items-center gap-1 mt-0.5">
                              <FiPhone className="w-2.5 h-2.5" />
                              <span>{w.phone}</span>
                            </a>
                          )}
                        </div>
                        {w.daily_wage && (
                          <div className="text-right">
                            <span className="text-[11px] text-gray-400 block">Daily</span>
                            <span className="text-xs font-bold text-gray-700">₹{w.daily_wage}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="w-full lg:w-80 flex-shrink-0">
          <ProjectUsersPanel projectId={project.id} assignedEmployee={project.assigned_employee} siteSupervisorId={project.site_supervisor_id} createdBy={project.created_by} onProjectUpdated={onProjectUpdated} />
        </div>
      </div>
    </div>
  );
};
