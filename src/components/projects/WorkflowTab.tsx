'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

type WorkflowTabProps = {
  projectId: string;
};

type ProjectWorkflow = {
  id: string;
  workflow_stage: string | null;
  requirements_pdf_url: string | null;
  requirements_uploaded_at: string | null;
  designer_id: string | null;
  designer_assigned_at: string | null;
  site_supervisor_id: string | null;
  site_supervisor_assigned_at: string | null;
  design_approved_at: string | null;
  design_approved_by: string | null;
  designer: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  site_supervisor: {
    id: string;
    full_name: string;
    email: string;
  } | null;
};

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

export function WorkflowTab({ projectId }: WorkflowTabProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [project, setProject] = useState<ProjectWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedDesigner, setSelectedDesigner] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [assigning, setAssigning] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchProjectWorkflow();
    if (isAdmin) {
      fetchEmployees();
    }
  }, [projectId, isAdmin]);

  const fetchProjectWorkflow = async () => {
    try {
      setLoading(true);

      // Use API route instead of direct Supabase query
      const response = await fetch(`/api/admin/projects?id=${projectId}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('You are not authorized to view this project');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to view this project');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch project');
      }

      const data = await response.json();

      if (!data) {
        throw new Error('Project not found');
      }

      // Transform the data to match ProjectWorkflow type
      const transformedData: ProjectWorkflow = {
        ...data,
        designer: Array.isArray(data.designer) ? data.designer[0] || null : data.designer,
        site_supervisor: Array.isArray(data.site_supervisor) ? data.site_supervisor[0] || null : data.site_supervisor,
      };

      setProject(transformedData);
      if (data.designer_id) setSelectedDesigner(data.designer_id);
      if (data.site_supervisor_id) setSelectedSupervisor(data.site_supervisor_id);
    } catch (error) {
      console.error('Error fetching project workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      // Use API route instead of direct Supabase query
      const response = await fetch('/api/admin/users?role=employee');

      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }

      const data = await response.json();
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      showToast('error', 'Please upload a PDF or image file (JPG, PNG, or WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      showToast('error', 'File size must be less than 10MB');
      return;
    }

    setPdfFile(file);
  };

  const handleAssignDesigner = async () => {
    if (!selectedDesigner) {
      showToast('error', 'Please select a designer');
      return;
    }

    if (!pdfFile && !project?.requirements_pdf_url) {
      showToast('error', 'Please upload a requirements PDF');
      return;
    }

    setAssigning(true);
    setUploadingPDF(true);

    try {
      let pdfUrl = project?.requirements_pdf_url;

      // Upload PDF if a new file is selected
      if (pdfFile) {
        const fileExt = 'pdf';
        const fileName = `${projectId}-requirements-${Date.now()}.${fileExt}`;
        const filePath = `requirements/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('project-requirements')
          .upload(filePath, pdfFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('project-requirements')
          .getPublicUrl(filePath);

        pdfUrl = publicUrl;
      }

      // Call API to assign designer and upload requirements
      const response = await fetch(`/api/projects/${projectId}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirements_pdf_url: pdfUrl,
          designer_id: selectedDesigner,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign designer');
      }

      showToast('success', 'Designer assigned successfully!');
      setPdfFile(null);
      fetchProjectWorkflow();
    } catch (error: any) {
      console.error('Error assigning designer:', error);
      showToast('error', error.message || 'Failed to assign designer');
    } finally {
      setAssigning(false);
      setUploadingPDF(false);
    }
  };

  const getStageColor = (stage: string | null | undefined) => {
    switch (stage) {
      case 'requirements_upload':
        return 'bg-gray-100 text-gray-800';
      case 'design_pending':
        return 'bg-blue-100 text-blue-800';
      case 'design_review':
        return 'bg-purple-100 text-purple-800';
      case 'design_approved':
        return 'bg-green-100 text-green-800';
      case 'design_rejected':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStage = (stage: string | null | undefined) => {
    if (!stage) return 'Not Started';
    return stage.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Workflow Stage */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Workflow Stage</h3>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStageColor(project?.workflow_stage)}`}>
            {formatStage(project?.workflow_stage)}
          </span>
        </div>
      </div>

      {/* Step 1: Assign Designer & Upload Requirements */}
      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Step 1: Assign Designer & Upload Requirements
          </h3>

          {project?.designer ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Designer:</span>
                <span className="font-medium text-gray-900">{project.designer.full_name}</span>
                <span className="text-green-600">✓ Assigned</span>
              </div>
              {project.requirements_pdf_url && (
                <div>
                  <a
                    href={project.requirements_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-yellow-600 hover:text-yellow-700 hover:underline"
                  >
                    📄 View Requirements PDF
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Designer *
                </label>
                <select
                  value={selectedDesigner}
                  onChange={(e) => setSelectedDesigner(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                >
                  <option value="">-- Select Designer --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Requirements File (PDF or Image) *
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handlePDFUpload}
                  disabled={uploadingPDF}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                />
                {pdfFile && (
                  <p className="text-xs text-gray-600 mt-1">Selected: {pdfFile.name}</p>
                )}
              </div>

              <button
                onClick={handleAssignDesigner}
                disabled={assigning || !selectedDesigner || !pdfFile}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? 'Assigning...' : 'Assign Designer & Upload Requirements'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Workflow Progress */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Progress</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${project?.designer_id ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
              {project?.designer_id ? '✓' : '1'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Designer Assigned</p>
              <p className="text-xs text-gray-500">Admin assigns designer and uploads requirements PDF</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${project?.workflow_stage === 'design_pending' || project?.workflow_stage === 'design_review' || project?.workflow_stage === 'design_approved' || project?.workflow_stage === 'in_progress' ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
              {project?.workflow_stage === 'design_pending' || project?.workflow_stage === 'design_review' || project?.workflow_stage === 'design_approved' || project?.workflow_stage === 'in_progress' ? '✓' : '2'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Design Upload</p>
              <p className="text-xs text-gray-500">Designer uploads design files</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${project?.design_approved_at ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
              {project?.design_approved_at ? '✓' : '3'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Design Approval</p>
              <p className="text-xs text-gray-500">Admin reviews and approves design</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${project?.site_supervisor_id ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
              {project?.site_supervisor_id ? '✓' : '4'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Site Supervisor Assigned</p>
              <p className="text-xs text-gray-500">Admin assigns site supervisor after design approval</p>
              {project?.site_supervisor && (
                <p className="text-xs text-green-600 mt-1">
                  Assigned to: {project.site_supervisor.full_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

