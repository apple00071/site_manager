'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTimeReadable } from '@/lib/dateUtils';

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
  const [designs, setDesigns] = useState<DesignFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<DesignFile | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approved' | 'rejected' | 'needs_changes'>('approved');
  const [adminComments, setAdminComments] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    version_number: 1,
  });

  useEffect(() => {
    fetchDesigns();
  }, [projectId]);

  const fetchDesigns = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/design-files?project_id=${projectId}`);
      
      if (!response.ok) {
        console.error('Failed to fetch designs');
        return;
      }

      const { designs: fetchedDesigns } = await response.json();
      setDesigns(fetchedDesigns || []);
    } catch (error) {
      console.error('Error fetching designs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadForm.file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);

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
        alert('Failed to upload file');
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
      setShowUploadForm(false);
      setUploadForm({ file: null, version_number: 1 });
    } catch (error: any) {
      console.error('Error uploading design:', error);
      alert(error.message || 'Failed to upload design');
    } finally {
      setUploading(false);
    }
  };

  const handleApproval = async () => {
    if (!selectedDesign) return;

    setProcessing(true);

    try {
      const response = await fetch('/api/design-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDesign.id,
          approval_status: approvalAction,
          admin_comments: adminComments.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update approval');
      }

      const { design } = await response.json();
      setDesigns(prev => prev.map(d => d.id === design.id ? design : (approvalAction === 'approved' ? { ...d, is_current_approved: false } : d)));
      setShowApprovalModal(false);
      setSelectedDesign(null);
      setAdminComments('');
    } catch (error: any) {
      console.error('Error updating approval:', error);
      alert(error.message || 'Failed to update approval');
    } finally {
      setProcessing(false);
    }
  };

  const openApprovalModal = (design: DesignFile, action: 'approved' | 'rejected' | 'needs_changes') => {
    setSelectedDesign(design);
    setApprovalAction(action);
    setAdminComments('');
    setShowApprovalModal(true);
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
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold w-full sm:w-auto"
        >
          {showUploadForm ? 'Cancel' : '+ Upload Design'}
        </button>
      </div>

      {showUploadForm && (
        <div className="mb-4 md:mb-6 p-3 md:p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Upload New Design</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Design File *</label>
              <input
                type="file"
                accept="image/*,application/pdf,.dwg,.dxf"
                onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                className="w-full border rounded-md px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Version Number</label>
              <input
                type="number"
                min="1"
                value={uploadForm.version_number}
                onChange={(e) => setUploadForm(prev => ({ ...prev, version_number: parseInt(e.target.value) || 1 }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={() => setShowUploadForm(false)}
                disabled={uploading}
                className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                onClick={handleFileUpload}
                disabled={uploading || !uploadForm.file}
                className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold disabled:opacity-50 w-full sm:w-auto"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Designs Grid */}
      <div className="space-y-3 md:space-y-4">
        {designs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No designs uploaded yet. Upload your first design!</p>
        ) : (
          designs.map((design) => (
            <div
              key={design.id}
              className={`border rounded-lg p-3 md:p-4 ${design.is_current_approved ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
            >
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                {/* Preview */}
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  {design.file_type === 'image' ? (
                    <img src={design.file_url} alt={design.file_name} className="w-full sm:w-24 md:w-32 h-48 sm:h-24 md:h-32 object-cover rounded" />
                  ) : (
                    <div className="w-full sm:w-24 md:w-32 h-48 sm:h-24 md:h-32 bg-gray-200 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-500 uppercase">{design.file_type}</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{design.file_name}</h4>
                      <p className="text-xs text-gray-500">Version {design.version_number} • Uploaded by {design.uploaded_by_user.full_name}</p>
                      <p className="text-xs text-gray-500">{formatDateTimeReadable(design.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {design.is_current_approved && (
                        <span className="text-xs font-bold text-green-600">✓ CURRENT</span>
                      )}
                      {getStatusBadge(design.approval_status)}
                    </div>
                  </div>

                  {design.admin_comments && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs font-medium text-gray-700">Admin Comments:</p>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{design.admin_comments}</p>
                    </div>
                  )}

                  {design.approved_by_user && (
                    <p className="text-xs text-gray-500 mt-2">
                      {design.approval_status === 'approved' ? 'Approved' : 'Reviewed'} by {design.approved_by_user.full_name} on {formatDateTimeReadable(design.approved_at!)}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={design.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-yellow-600 hover:underline font-medium"
                    >
                      📄 View File
                    </a>

                    {/* Admin actions - only show Approve if not rejected */}
                    {isAdmin && design.approval_status === 'pending' && (
                      <>
                        <button
                          onClick={() => openApprovalModal(design, 'approved')}
                          className="text-xs text-green-600 hover:underline font-medium"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => openApprovalModal(design, 'needs_changes')}
                          className="text-xs text-orange-600 hover:underline font-medium"
                        >
                          ⚠ Request Changes
                        </button>
                        <button
                          onClick={() => openApprovalModal(design, 'rejected')}
                          className="text-xs text-red-600 hover:underline font-medium"
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}

                    {/* Show Reupload button for rejected designs (employee view) */}
                    {!isAdmin && design.approval_status === 'rejected' && (
                      <button
                        onClick={() => setShowUploadForm(true)}
                        className="text-xs px-3 py-1 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 font-medium"
                      >
                        🔄 Reupload New Version
                      </button>
                    )}

                    {/* Admin can still review rejected designs */}
                    {isAdmin && design.approval_status === 'rejected' && (
                      <button
                        onClick={() => openApprovalModal(design, 'approved')}
                        className="text-xs text-green-600 hover:underline font-medium"
                      >
                        ✓ Approve Anyway
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Approval Modal - Mobile Responsive */}
      {showApprovalModal && selectedDesign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 md:p-6 max-h-screen overflow-y-auto">
            <h3 className="text-base md:text-lg font-medium text-gray-900 mb-3 md:mb-4">
              {approvalAction === 'approved' && '✓ Approve Design'}
              {approvalAction === 'rejected' && '✗ Reject Design'}
              {approvalAction === 'needs_changes' && '⚠ Request Changes'}
            </h3>
            <p className="text-sm text-gray-600 mb-3 md:mb-4">
              Design: <span className="font-medium break-words">{selectedDesign.file_name}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-2">Comments (optional)</label>
              <textarea
                value={adminComments}
                onChange={(e) => setAdminComments(e.target.value)}
                rows={4}
                placeholder="Add your feedback..."
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={() => setShowApprovalModal(false)}
                disabled={processing}
                className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                onClick={handleApproval}
                disabled={processing}
                className={`px-4 py-2 text-white rounded-md text-sm font-medium disabled:opacity-50 w-full sm:w-auto ${
                  approvalAction === 'approved' ? 'bg-green-600 hover:bg-green-700' :
                  approvalAction === 'rejected' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {processing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

