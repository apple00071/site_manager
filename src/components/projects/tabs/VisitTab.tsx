'use client';

import React from 'react';
import { FiEdit2 } from 'react-icons/fi';
import { formatDateIST } from '@/lib/dateUtils';
import { ProjectUsersPanel } from '../ProjectUsersPanel';
import type { Project } from '../ProjectDetailsClient';

interface VisitTabProps {
  project: Project;
  canEditProject: boolean;
  isAdmin: boolean;
  onEdit: (section: 'info' | 'customer' | 'property' | 'workers' | null) => void;
  activeSubTab: string;
}

export const VisitTab: React.FC<VisitTabProps> = ({ 
  project, 
  canEditProject, 
  isAdmin, 
  onEdit,
  activeSubTab
}) => {
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
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Vendors</h3>
                {canEditProject && (
                  <button 
                    onClick={() => onEdit('workers')} 
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-full transition-colors"
                    aria-label="Edit Vendor Details"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {['carpenter', 'electrician', 'plumber', 'painter', 'granite_worker', 'glass_worker'].map((worker) => {
                  const name = project[`${worker}_name` as keyof Project] as string;
                  const phone = project[`${worker}_phone` as keyof Project] as string;
                  if (!name) return null;
                  return (
                    <div key={worker} className="p-3 bg-gray-50 rounded-lg group relative">
                      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{worker.replace('_', ' ')}</dt>
                      <dd className="text-sm text-gray-900 font-medium">{name}</dd>
                      {phone && <dd className="text-sm"><a href={`tel:${phone}`} className="text-yellow-600 hover:text-yellow-700">{phone}</a></dd>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="w-full lg:w-80 flex-shrink-0">
          <ProjectUsersPanel projectId={project.id} assignedEmployee={project.assigned_employee} createdBy={project.created_by} />
        </div>
      </div>
    </div>
  );
};
