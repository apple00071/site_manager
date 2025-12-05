'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTimeReadable } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InlineApproval } from '@/components/ui/InlineApproval';
import { FiUpload, FiFileText, FiPaperclip, FiEye, FiX, FiChevronDown, FiChevronUp, FiPlus } from 'react-icons/fi';

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

  // Inline expansion state
  const [expandedDesignId, setExpandedDesignId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Form state
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      const file = uploadForm.file;
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('design-files')
        .upload(fileName, file);

      if (error) {
        console.error('Error uploading file:', error);
        showToast('error', 'Failed to upload file');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('design-files')
        .getPublicUrl(fileName);

      // Determine file type
      let fileType = 'other';
      if (file.type.startsWith('image/')) {
        fileType = 'image';
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf';
      } else if (file.name.toLowerCase().endsWith('.dwg') || file.name.toLowerCase().endsWith('.dxf')) {
        fileType = 'cad';
      }

      // Create design file record
      const response = await fetch('/api/design-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: fileType,
          version_number: uploadForm.version_number,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create design record');
      }

      const { design } = await response.json();
      setDesigns(prev => [design, ...prev]);
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
    } catch (error: any) {
      console.error('Error updating approval:', error);
      showToast('error', error.message || 'Failed to update approval');
    } finally {
      setProcessing(false);
    }
  };

  const handleReupload = (design: DesignFile) => {
    setUploadForm(prev => ({
      ...prev,
      version_number: design.version_number + 1
    }));
    setIsAddingNew(true);
    setExpandedDesignId(null);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      needs_changes: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const handleCloseForm = () => {
    setIsAddingNew(false);
    resetForm();
  };

  // Upload form component
  const UploadForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-gray-700 mb-2">Design File *</label>
        <input
          type="file"
          accept="image/*,application/pdf,.dwg,.dxf"
          onChange={(e) => {
            setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }));
            setFormError(null);
          }}
          className={`w-full border rounded-md px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 ${formError ? 'border-red-300' : 'border-gray-300'
            }`}
        />
        {formError && <p className="mt-1 text-xs text-red-600">{formError}</p>}
      </div>
      <div>
        <label className="block text-sm text-gray-700 mb-2">Version Number</label>
        <input
          type="number"
          min="1"
          value={uploadForm.version_number}
          onChange={(e) => setUploadForm(prev => ({ ...prev, version_number: parseInt(e.target.value) || 1 }))}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={handleCloseForm}
          disabled={uploading}
          className="px-4 py-2 rounded-md text-sm text-gray-700 bg-gray-100 hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleFileUpload}
          disabled={uploading || !uploadForm.file}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent"></div>
          ) : (
            <FiUpload className="w-4 h-4" />
          )}
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 md:mb-6">
        <h3 className="text-base sm:text-lg font-medium leading-6 text-gray-900">Design Files</h3>
        <button
          onClick={() => {
            setIsAddingNew(true);
            setExpandedDesignId(null);
            resetForm();
          }}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <FiPlus className="w-4 h-4" />
          Upload Design
        </button>
      </div>

      {/* Inline Upload Form (Desktop) */}
      {isAddingNew && !isMobile && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg animate-slide-down">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Upload New Design</h4>
            <button
              onClick={handleCloseForm}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
          <UploadForm />
        </div>
      )}

      {/* Mobile Bottom Sheet for Upload */}
      <BottomSheet
        isOpen={isAddingNew && isMobile}
        onClose={handleCloseForm}
        title="Upload New Design"
      >
        <UploadForm />
      </BottomSheet>

      {/* Designs List */}
      {designs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <FiUpload className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No designs</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by uploading a new design file.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {designs.map((design) => (
            <div key={design.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Design Row */}
              <div
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${expandedDesignId === design.id ? 'bg-gray-50' : ''
                  }`}
                onClick={() => {
                  if (expandedDesignId === design.id) {
                    setExpandedDesignId(null);
                  } else {
                    setExpandedDesignId(design.id);
                    setIsAddingNew(false);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 h-10 w-10">
                    {design.file_type === 'image' ? (
                      <img className="h-10 w-10 rounded object-cover border border-gray-200" src={design.file_url} alt="" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                        {design.file_type === 'pdf' ? <FiFileText className="w-5 h-5" /> : <FiPaperclip className="w-5 h-5" />}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{design.file_name}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        V{design.version_number}
                      </span>
                      <span>{design.file_type.toUpperCase()}</span>
                      <span>{formatDateTimeReadable(design.created_at).split(',')[0]}</span>
                    </div>
                  </div>

                  {/* Status & Toggle */}
                  <div className="flex items-center gap-2">
                    {getStatusBadge(design.approval_status)}
                    {expandedDesignId === design.id ? (
                      <FiChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <FiChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content (Desktop) */}
              {expandedDesignId === design.id && !isMobile && (
                <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50 animate-slide-down">
                  <div className="pt-4 space-y-4">
                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Uploaded By</p>
                        <p className="font-medium">{design.uploaded_by_user.full_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Date</p>
                        <p className="font-medium">{formatDateTimeReadable(design.created_at)}</p>
                      </div>
                    </div>

                    {/* Admin Comments */}
                    {design.admin_comments && (
                      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-xs font-medium text-orange-800">Admin Comments:</p>
                        <p className="text-sm text-orange-700 mt-1">{design.admin_comments}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={design.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FiEye className="w-4 h-4" />
                        View File
                      </a>

                      {!isAdmin && (design.approval_status === 'rejected' || design.approval_status === 'needs_changes') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReupload(design);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                        >
                          <FiUpload className="w-4 h-4" />
                          Resubmit
                        </button>
                      )}
                    </div>

                    {/* Inline Approval for Admin */}
                    {isAdmin && design.approval_status === 'pending' && (
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-600 mb-2">Approval Actions</p>
                        <InlineApproval
                          status="pending"
                          onApprove={() => handleApproval(design.id, 'approved')}
                          onReject={(reason) => handleApproval(design.id, 'rejected', reason)}
                          onRequestChanges={(comment) => handleApproval(design.id, 'needs_changes', comment)}
                          showRequestChanges
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mobile Bottom Sheet for Expanded Design */}
      {expandedDesignId && isMobile && (
        <BottomSheet
          isOpen={true}
          onClose={() => setExpandedDesignId(null)}
          title={designs.find(d => d.id === expandedDesignId)?.file_name || 'Design Details'}
        >
          {(() => {
            const design = designs.find(d => d.id === expandedDesignId);
            if (!design) return null;

            return (
              <div className="space-y-4">
                {/* Thumbnail */}
                <div className="flex justify-center">
                  {design.file_type === 'image' ? (
                    <img className="max-h-48 rounded-lg object-contain" src={design.file_url} alt="" />
                  ) : (
                    <div className="h-24 w-24 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                      {design.file_type === 'pdf' ? <FiFileText className="w-12 h-12" /> : <FiPaperclip className="w-12 h-12" />}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Version</p>
                    <p className="font-medium">V{design.version_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="font-medium">{design.file_type.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Uploaded By</p>
                    <p className="font-medium">{design.uploaded_by_user.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    {getStatusBadge(design.approval_status)}
                  </div>
                </div>

                {/* Admin Comments */}
                {design.admin_comments && (
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <p className="text-xs font-medium text-orange-800">Admin Comments:</p>
                    <p className="text-sm text-orange-700 mt-1">{design.admin_comments}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={design.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg"
                  >
                    <FiEye className="w-4 h-4" />
                    View File
                  </a>

                  {!isAdmin && (design.approval_status === 'rejected' || design.approval_status === 'needs_changes') && (
                    <button
                      onClick={() => handleReupload(design)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg"
                    >
                      <FiUpload className="w-4 h-4" />
                      Resubmit
                    </button>
                  )}
                </div>

                {/* Inline Approval for Admin */}
                {isAdmin && design.approval_status === 'pending' && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-2">Approval Actions</p>
                    <InlineApproval
                      status="pending"
                      onApprove={() => handleApproval(design.id, 'approved')}
                      onReject={(reason) => handleApproval(design.id, 'rejected', reason)}
                      onRequestChanges={(comment) => handleApproval(design.id, 'needs_changes', comment)}
                      showRequestChanges
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </BottomSheet>
      )}
    </div>
  );
}

export default DesignsTab;
