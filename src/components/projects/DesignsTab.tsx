'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTimeReadable } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SidePanel } from '@/components/ui/SidePanel';
import {
  FiUpload, FiFileText, FiPaperclip, FiEye, FiPlus,
  FiMoreVertical, FiEdit, FiTrash2, FiDownload, FiCheck, FiX, FiClock, FiAlertCircle
} from 'react-icons/fi';

type DesignFile = {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  version_number: number;
  approval_status: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  uploaded_by: string;
  approved_by: string | null;
  approved_at: string | null;
  admin_comments: string | null;
  is_current_approved: boolean;
  created_at: string;
  uploaded_by_user: {
    id: string;
    full_name: string;
    email: string;
  };
  approved_by_user: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  comments: Array<{
    id: string;
    comment: string;
    created_at: string;
    user: {
      id: string;
      full_name: string;
      email: string;
    };
  }>;
};

type DesignsTabProps = {
  projectId: string;
};

export function DesignsTab({ projectId }: DesignsTabProps) {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [designs, setDesigns] = useState<DesignFile[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [approvalDesign, setApprovalDesign] = useState<DesignFile | null>(null);
  const [approvalAction, setApprovalAction] = useState<'reject' | 'needs_changes' | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Form state
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    version_number: 1,
  });

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchDesigns();
  }, [projectId]);

  const fetchDesigns = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/design-files?project_id=${projectId}`);

      if (!response.ok) {
        showToast('error', 'Failed to fetch designs');
        return;
      }

      const { designs: fetchedDesigns } = await response.json();
      setDesigns(fetchedDesigns || []);
    } catch (error) {
      console.error('Error fetching designs:', error);
      showToast('error', 'Failed to fetch designs');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUploadForm({ file: null, version_number: 1 });
    setFormError(null);
  };

  const handleFileUpload = async () => {
    if (!uploadForm.file) {
      setFormError('Please select a file');
      return;
    }

    setUploading(true);
    setFormError(null);

    try {
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `designs/${projectId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('design-files')
        .upload(filePath, uploadForm.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('design-files')
        .getPublicUrl(filePath);

      const fileType = uploadForm.file.type.startsWith('image/') ? 'image' :
        uploadForm.file.type === 'application/pdf' ? 'pdf' : 'other';

      const response = await fetch('/api/design-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          file_name: uploadForm.file.name,
          file_url: publicUrl,
          file_type: fileType,
          version_number: uploadForm.version_number,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create design');
      }

      await fetchDesigns();
      setIsAddingNew(false);
      resetForm();
      showToast('success', 'Design uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading design:', error);
      showToast('error', error.message || 'Failed to upload design');
    } finally {
      setUploading(false);
    }
  };

  const handleApproval = async (designId: string, action: 'approved' | 'rejected' | 'needs_changes', comments?: string) => {
    setProcessing(true);

    try {
      const response = await fetch('/api/design-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: designId,
          approval_status: action,
          admin_comments: comments?.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update approval');
      }

      const { design } = await response.json();
      setDesigns(prev => prev.map(d =>
        d.id === design.id ? design : (action === 'approved' ? { ...d, is_current_approved: false } : d)
      ));

      const actionLabels = {
        approved: 'approved',
        rejected: 'rejected',
        needs_changes: 'marked for changes',
      };
      showToast('success', `Design ${actionLabels[action]}`);
      setApprovalDesign(null);
      setApprovalAction(null);
      setApprovalComment('');
    } catch (error: any) {
      console.error('Error updating approval:', error);
      showToast('error', error.message || 'Failed to update approval');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (designId: string) => {
    if (!confirm('Are you sure you want to delete this design?')) return;

    try {
      const response = await fetch(`/api/design-files?id=${designId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete design');
      }

      setDesigns(prev => prev.filter(d => d.id !== designId));
      showToast('success', 'Design deleted');
    } catch (error: any) {
      console.error('Error deleting design:', error);
      showToast('error', error.message || 'Failed to delete design');
    }
  };

  const handleUploadNewVersion = (design: DesignFile) => {
    setUploadForm(prev => ({
      ...prev,
      version_number: design.version_number + 1
    }));
    setIsAddingNew(true);
    setOpenMenuId(null);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
      needs_changes: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Changes' },
    };
    const c = config[status as keyof typeof config] || config.pending;
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  const getFileIcon = (type: string) => {
    if (type === 'pdf') return <FiFileText className="w-4 h-4 text-red-500" />;
    if (type === 'image') return <FiFileText className="w-4 h-4 text-blue-500" />;
    return <FiPaperclip className="w-4 h-4 text-gray-500" />;
  };

  const handleCloseForm = () => {
    setIsAddingNew(false);
    resetForm();
  };

  // Upload form component
  const UploadForm = () => (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select File *
        </label>
        <input
          type="file"
          accept="image/*,.pdf,.dwg,.dxf"
          onChange={(e) => {
            e.stopPropagation();
            const file = e.target.files?.[0] || null;
            setUploadForm(prev => ({ ...prev, file }));
          }}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
        />
        {uploadForm.file && (
          <p className="mt-2 text-sm text-gray-600">Selected: {uploadForm.file.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Version Number
        </label>
        <input
          type="number"
          min="1"
          value={uploadForm.version_number}
          onChange={(e) => setUploadForm(prev => ({ ...prev, version_number: parseInt(e.target.value) || 1 }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
        />
      </div>

      {formError && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {formError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleCloseForm}
          className="flex-1 px-4 py-2 text-gray-700 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleFileUpload}
          disabled={uploading || !uploadForm.file}
          className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </form>
  );

  if (loading) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow sm:rounded-lg">
      {/* Desktop Side Panel for Upload */}
      <SidePanel
        isOpen={isAddingNew && !isMobile}
        onClose={handleCloseForm}
        title="Upload New Design"
      >
        <UploadForm />
      </SidePanel>

      {/* Mobile Bottom Sheet for Upload */}
      <BottomSheet
        isOpen={isAddingNew && isMobile}
        onClose={handleCloseForm}
        title="Upload New Design"
      >
        <UploadForm />
      </BottomSheet>

      {/* Empty State */}
      {designs.length === 0 ? (
        <div className="p-4">
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                setIsAddingNew(true);
                resetForm();
              }}
              className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 text-sm font-medium flex items-center gap-2 transition-all duration-200"
            >
              <FiPlus className="w-4 h-4" />
              Upload Design
            </button>
          </div>
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <FiUpload className="h-12 w-12 mx-auto text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No designs</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by uploading a new design file.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            {/* Action bar above table */}
            <div className="flex justify-end px-4 py-2 border-b border-gray-200">
              <button
                onClick={() => {
                  setIsAddingNew(true);
                  resetForm();
                }}
                className="px-3 py-1.5 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 text-xs font-medium inline-flex items-center gap-1.5 transition-all duration-200"
              >
                <FiPlus className="w-3.5 h-3.5" />
                Upload Design
              </button>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name of File
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded By
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded On
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {designs.map((design) => (
                  <tr key={design.id} className="hover:bg-gray-50">
                    {/* Name with Version Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded">
                          V{design.version_number}
                        </span>
                        {design.file_type === 'image' ? (
                          <img
                            src={design.file_url}
                            alt=""
                            className="w-8 h-8 rounded object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                            {getFileIcon(design.file_type)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {design.file_name}
                        </span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {design.file_type.toUpperCase()}
                    </td>

                    {/* Uploaded By */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {design.uploaded_by_user?.full_name || 'Unknown'}
                    </td>

                    {/* Uploaded On */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTimeReadable(design.created_at)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(design.approval_status)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap text-right relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === design.id ? null : design.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <FiMoreVertical className="w-5 h-5" />
                      </button>

                      {/* Dropdown Menu */}
                      {openMenuId === design.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-4 top-10 z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
                        >
                          <a
                            href={design.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <FiEye className="w-4 h-4" />
                            View
                          </a>
                          <a
                            href={design.file_url}
                            download
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <FiDownload className="w-4 h-4" />
                            Download
                          </a>
                          <button
                            onClick={() => handleUploadNewVersion(design)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <FiUpload className="w-4 h-4" />
                            Upload new version
                          </button>

                          <div className="border-t border-gray-100 my-1"></div>

                          {isAdmin && design.approval_status === 'pending' && (
                            <>
                              <button
                                onClick={() => {
                                  handleApproval(design.id, 'approved');
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                              >
                                <FiCheck className="w-4 h-4" />
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setApprovalDesign(design);
                                  setApprovalAction('reject');
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                              >
                                <FiX className="w-4 h-4" />
                                Reject
                              </button>
                              <button
                                onClick={() => {
                                  setApprovalDesign(design);
                                  setApprovalAction('needs_changes');
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-orange-700 hover:bg-orange-50"
                              >
                                <FiAlertCircle className="w-4 h-4" />
                                Request Changes
                              </button>
                            </>
                          )}

                          <div className="border-t border-gray-100 my-1"></div>

                          {(isAdmin || design.uploaded_by === user?.id) && (
                            <button
                              onClick={() => {
                                handleDelete(design.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <FiTrash2 className="w-4 h-4" />
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-gray-200">
            {designs.map((design) => (
              <div key={design.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded">
                      V{design.version_number}
                    </span>
                    {design.file_type === 'image' ? (
                      <img
                        src={design.file_url}
                        alt=""
                        className="w-10 h-10 rounded object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                        {getFileIcon(design.file_type)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
                        {design.file_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {design.uploaded_by_user?.full_name} • {formatDateTimeReadable(design.created_at).split(',')[0]}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(design.approval_status)}
                    <button
                      onClick={() => setOpenMenuId(openMenuId === design.id ? null : design.id)}
                      className="p-1 text-gray-400"
                    >
                      <FiMoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Mobile Dropdown */}
                {openMenuId === design.id && (
                  <div className="mt-3 p-2 bg-gray-50 rounded-lg space-y-1">
                    <a
                      href={design.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-white rounded"
                    >
                      <FiEye className="w-4 h-4" /> View
                    </a>
                    <a
                      href={design.file_url}
                      download
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-white rounded"
                    >
                      <FiDownload className="w-4 h-4" /> Download
                    </a>
                    <button
                      onClick={() => handleUploadNewVersion(design)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-white rounded"
                    >
                      <FiUpload className="w-4 h-4" /> Upload new version
                    </button>
                    {isAdmin && design.approval_status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApproval(design.id, 'approved')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 hover:bg-white rounded"
                        >
                          <FiCheck className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setApprovalDesign(design);
                            setApprovalAction('reject');
                            setOpenMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-white rounded"
                        >
                          <FiX className="w-4 h-4" /> Reject
                        </button>
                      </>
                    )}
                    {(isAdmin || design.uploaded_by === user?.id) && (
                      <button
                        onClick={() => handleDelete(design.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-white rounded"
                      >
                        <FiTrash2 className="w-4 h-4" /> Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Rejection/Changes Modal */}
      {approvalDesign && approvalAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {approvalAction === 'reject' ? 'Reject Design' : 'Request Changes'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for {approvalAction === 'reject' ? 'rejecting' : 'requesting changes to'} "{approvalDesign.file_name}":
            </p>
            <textarea
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="Enter your comments..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setApprovalDesign(null);
                  setApprovalAction(null);
                  setApprovalComment('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApproval(
                  approvalDesign.id,
                  approvalAction === 'reject' ? 'rejected' : 'needs_changes',
                  approvalComment
                )}
                disabled={processing || !approvalComment.trim()}
                className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${approvalAction === 'reject' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'
                  }`}
              >
                {processing ? 'Processing...' : approvalAction === 'reject' ? 'Reject' : 'Request Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DesignsTab;
