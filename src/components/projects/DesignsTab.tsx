'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTimeReadable } from '@/lib/dateUtils';
import { FiUpload, FiFileText, FiPaperclip, FiEye, FiCheck, FiAlertTriangle, FiX } from 'react-icons/fi';

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

  const handleReupload = (design: DesignFile) => {
    setUploadForm(prev => ({
      ...prev,
      version_number: design.version_number + 1
    }));
    setShowUploadForm(true);
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
          onClick={() => setShowUploadForm(true)}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <FiUpload className="w-4 h-4" />
          Upload Design
        </button>
      </div>

      {showUploadForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Upload New Design</h4>
            <div className="space-y-4">
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
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowUploadForm(false)}
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
                  {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent"></div> : <FiUpload />}
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {designs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <FiUpload className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No designs</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by uploading a new design file.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View (lg:hidden) */}
          <div className="lg:hidden space-y-4">
            {designs.map((design) => (
              <div key={design.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-10 w-10 relative">
                      {design.file_type === 'image' ? (
                        <img className="h-10 w-10 rounded object-cover border border-gray-200" src={design.file_url} alt="" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                          {design.file_type === 'pdf' ? <FiFileText className="w-5 h-5" /> : <FiPaperclip className="w-5 h-5" />}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 break-all line-clamp-1">{design.file_name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{design.file_type.toUpperCase()}</span>
                        <span className="text-xs font-medium text-gray-400">•</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          V{design.version_number}
                        </span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(design.approval_status)}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600 mb-3 bg-gray-50 p-3 rounded-md border border-gray-100">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase tracking-wider mb-0.5">Uploaded By</span>
                    <span className="font-medium text-gray-900">{design.uploaded_by_user.full_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase tracking-wider mb-0.5">Date</span>
                    <span className="font-medium text-gray-900">{formatDateTimeReadable(design.created_at).split(',')[0]}</span>
                  </div>
                </div>

                {design.approval_status === 'needs_changes' && design.admin_comments && (
                  <div className="mb-3 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-100">
                    <div className="font-medium mb-1">Requested Changes:</div>
                    {design.admin_comments}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex gap-2">
                    <a
                      href={design.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                      title="View File"
                    >
                      <FiEye className="w-4 h-4" />
                    </a>
                  </div>
                  <div className="flex gap-2">
                    {isAdmin && design.approval_status === 'pending' && (
                      <>
                        <button
                          onClick={() => openApprovalModal(design, 'approved')}
                          className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors border border-transparent hover:border-green-200"
                          title="Approve"
                        >
                          <FiCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openApprovalModal(design, 'needs_changes')}
                          className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors border border-transparent hover:border-orange-200"
                          title="Request Changes"
                        >
                          <FiAlertTriangle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openApprovalModal(design, 'rejected')}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-200"
                          title="Reject"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {!isAdmin && (design.approval_status === 'rejected' || design.approval_status === 'needs_changes') && (
                      <button
                        onClick={() => handleReupload(design)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200"
                      >
                        <FiUpload className="w-3.5 h-3.5" />
                        Resubmit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (hidden lg:block) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {designs.map((design) => (
                  <tr key={design.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 relative group-hover:scale-105 transition-transform">
                          {design.file_type === 'image' ? (
                            <img className="h-10 w-10 rounded object-cover border border-gray-200" src={design.file_url} alt="" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                              {design.file_type === 'pdf' ? <FiFileText className="w-5 h-5" /> : <FiPaperclip className="w-5 h-5" />}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate" title={design.file_name}>
                              {design.file_name}
                            </div>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                              V{design.version_number}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">{design.file_type.toUpperCase()}</div>
                          {design.admin_comments && (
                            <div className="mt-1 text-xs text-red-600 bg-red-50 p-1 rounded border border-red-100 max-w-[200px] break-words">
                              Comments: {design.admin_comments}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 text-xs font-bold border border-yellow-200">
                          {design.uploaded_by_user.full_name.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{design.uploaded_by_user.full_name}</div>
                          <div className="text-xs text-gray-500">{design.uploaded_by_user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDateTimeReadable(design.created_at).split(',')[0]}</div>
                      <div className="text-xs text-gray-500">{formatDateTimeReadable(design.created_at).split(',')[1]}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(design.approval_status)}
                      {design.is_current_approved && (
                        <div className="mt-1 flex items-center text-xs text-green-600 font-medium">
                          <FiCheck className="w-3 h-3 mr-1" />
                          Current
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={design.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                          title="View File"
                        >
                          <FiEye className="w-5 h-5" />
                        </a>

                        {isAdmin && design.approval_status === 'pending' && (
                          <>
                            <button
                              onClick={() => openApprovalModal(design, 'approved')}
                              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Approve"
                            >
                              <FiCheck className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => openApprovalModal(design, 'needs_changes')}
                              className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                              title="Request Changes"
                            >
                              <FiAlertTriangle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => openApprovalModal(design, 'rejected')}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Reject"
                            >
                              <FiX className="w-5 h-5" />
                            </button>
                          </>
                        )}

                        {!isAdmin && (design.approval_status === 'rejected' || design.approval_status === 'needs_changes') && (
                          <button
                            onClick={() => handleReupload(design)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Upload New Version"
                          >
                            <FiUpload className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Approval Modal - Shared */}
          {showApprovalModal && selectedDesign && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 md:p-6 max-h-screen overflow-y-auto">
                <h3 className="text-base md:text-lg font-medium text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
                  {approvalAction === 'approved' && <FiCheck className="w-5 h-5 text-green-600" />}
                  {approvalAction === 'rejected' && <FiX className="w-5 h-5 text-red-600" />}
                  {approvalAction === 'needs_changes' && <FiAlertTriangle className="w-5 h-5 text-orange-600" />}

                  {approvalAction === 'approved' && 'Approve Design'}
                  {approvalAction === 'rejected' && 'Reject Design'}
                  {approvalAction === 'needs_changes' && 'Request Changes'}
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
                    className="px-4 py-2 rounded-md text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 w-full sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApproval}
                    disabled={processing}
                    className={`px-4 py-2 text-white rounded-md text-sm font-medium disabled:opacity-50 w-full sm:w-auto ${approvalAction === 'approved' ? 'bg-green-600 hover:bg-green-700' :
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
        </>
      )}
    </div>
  );
}
