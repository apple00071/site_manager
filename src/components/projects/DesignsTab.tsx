'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTimeReadable } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SidePanel } from '@/components/ui/SidePanel';
import { DesignViewer } from '@/components/projects/DesignViewer';
import {
  FiUpload, FiFileText, FiPaperclip, FiEye, FiPlus,
  FiMoreVertical, FiEdit, FiTrash2, FiDownload, FiCheck, FiX, FiClock, FiAlertCircle, FiLock, FiUnlock,
  FiMessageCircle, FiMapPin
} from 'react-icons/fi';

type DesignFile = {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  category: string;
  version_number: number;
  approval_status: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  uploaded_by: string;
  approved_by: string | null;
  approved_at: string | null;
  admin_comments: string | null;
  is_current_approved: boolean;
  is_frozen: boolean;
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
  const [mobileActionDesign, setMobileActionDesign] = useState<DesignFile | null>(null);
  const [approvalDesign, setApprovalDesign] = useState<DesignFile | null>(null);
  const [approvalAction, setApprovalAction] = useState<'reject' | 'needs_changes' | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  // Freeze state
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezing, setFreezing] = useState(false);

  // Viewer state
  const [viewerDesign, setViewerDesign] = useState<DesignFile | null>(null);

  // Selected category tab (for horizontal tabs navigation)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Form state
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    category: '', // Room category like "Kitchen", "Bedroom", etc.
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

  // Fetch freeze status
  const fetchFreezeStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/freeze-designs`);
      if (response.ok) {
        const { is_frozen } = await response.json();
        setIsFrozen(is_frozen);
      }
    } catch (error) {
      console.error('Error fetching freeze status:', error);
    }
  };

  // Toggle freeze/unfreeze for individual design
  const handleToggleFreezeDesign = async (design: DesignFile) => {
    try {
      const response = await fetch(`/api/design-files/${design.id}/freeze`, {
        method: design.is_frozen ? 'DELETE' : 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update freeze status');
      }

      // Update local state
      setDesigns(prev => prev.map(d =>
        d.id === design.id ? { ...d, is_frozen: !d.is_frozen } : d
      ));
      showToast('success', design.is_frozen ? 'Design unfrozen' : 'Design frozen');
    } catch (error: any) {
      console.error('Error toggling design freeze:', error);
      showToast('error', error.message || 'Failed to update freeze status');
    }
  };

  // Check if any design in project is frozen (for upload blocking)
  const hasAnyFrozenDesign = designs.some(d => d.is_frozen);

  // Group designs by category
  const groupedDesigns = useMemo(() => {
    const groups: Record<string, DesignFile[]> = {};
    designs.forEach(design => {
      const cat = design.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(design);
    });
    // Sort each group by version_number descending (latest first)
    Object.values(groups).forEach(group => {
      group.sort((a, b) => b.version_number - a.version_number);
    });
    return groups;
  }, [designs]);

  // Get list of categories for tabs
  const categories = Object.keys(groupedDesigns);

  // Set default selected category when designs load
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  // Get designs for the selected category
  const filteredDesigns = selectedCategory ? (groupedDesigns[selectedCategory] || []) : [];

  // Helper to check if design has pinned comments
  const hasPinnedComments = (design: DesignFile) => {
    return design.comments?.some(c => (c as any).x_percent !== null && (c as any).x_percent !== undefined) || false;
  };

  // Fetch freeze status on mount
  useEffect(() => {
    fetchFreezeStatus();
  }, [projectId]);

  const resetForm = () => {
    setUploadForm({ file: null, category: '', version_number: 1 });
    setFormError(null);
  };

  const handleFileUpload = async () => {
    if (!uploadForm.file) {
      setFormError('Please select a file');
      return;
    }

    if (!uploadForm.category.trim()) {
      setFormError('Please enter a room/category name (e.g. Kitchen, Bedroom)');
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
          category: uploadForm.category.trim(),
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
      version_number: design.version_number + 1,
      category: design.category || '' // Auto-fill category from original design
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
          Room/Category *
        </label>
        <input
          type="text"
          value={uploadForm.category}
          onChange={(e) => setUploadForm(prev => ({ ...prev, category: e.target.value }))}
          placeholder="e.g. Kitchen, Bedroom, Floor Plan"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">
          Designs with the same category are grouped as versions (V1, V2, V3...)
        </p>
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

      {/* Mobile Actions Bottom Sheet */}
      <BottomSheet
        isOpen={mobileActionDesign !== null}
        onClose={() => setMobileActionDesign(null)}
        title={mobileActionDesign?.file_name || 'Design Actions'}
      >
        {mobileActionDesign && (
          <div className="space-y-1">
            <button
              onClick={() => {
                setViewerDesign(mobileActionDesign);
                setMobileActionDesign(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              <FiEye className="w-5 h-5 text-gray-500" /> View Design
            </button>

            <a
              href={mobileActionDesign.file_url}
              download
              className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              <FiDownload className="w-5 h-5 text-gray-500" /> Download File
            </a>

            <button
              onClick={() => {
                handleUploadNewVersion(mobileActionDesign);
                setMobileActionDesign(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              <FiUpload className="w-5 h-5 text-gray-500" /> Upload New Version
            </button>

            {/* Freeze/Unfreeze (admin only) */}
            {isAdmin && (
              <button
                onClick={() => {
                  handleToggleFreezeDesign(mobileActionDesign);
                  setMobileActionDesign(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg ${mobileActionDesign.is_frozen
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {mobileActionDesign.is_frozen ? (
                  <>
                    <FiUnlock className="w-5 h-5" /> Unfreeze Design
                  </>
                ) : (
                  <>
                    <FiLock className="w-5 h-5" /> Freeze Design
                  </>
                )}
              </button>
            )}

            {isAdmin && mobileActionDesign.approval_status === 'pending' && (
              <>
                <button
                  onClick={() => {
                    handleApproval(mobileActionDesign.id, 'approved');
                    setMobileActionDesign(null);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-green-700 hover:bg-green-50 rounded-lg"
                >
                  <FiCheck className="w-5 h-5" /> Approve Design
                </button>
                <button
                  onClick={() => {
                    setApprovalDesign(mobileActionDesign);
                    setApprovalAction('reject');
                    setMobileActionDesign(null);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg"
                >
                  <FiX className="w-5 h-5" /> Reject Design
                </button>
              </>
            )}

            {(isAdmin || mobileActionDesign.uploaded_by === user?.id) && (
              <button
                onClick={() => {
                  handleDelete(mobileActionDesign.id);
                  setMobileActionDesign(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
              >
                <FiTrash2 className="w-5 h-5" /> Remove Design
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Empty State */}
      {
        designs.length === 0 ? (
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
            <div>
              {/* Action bar above table */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
                {/* Category Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {categories.map((category) => {
                    const count = groupedDesigns[category]?.length || 0;
                    const isActive = selectedCategory === category;
                    return (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${isActive
                          ? 'bg-yellow-500 text-gray-900'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {category}
                        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded ${isActive ? 'bg-gray-900 text-white' : 'bg-gray-300 text-gray-700'
                          }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(true);
                    resetForm();
                  }}
                  className="px-3 py-1.5 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 text-xs font-medium inline-flex items-center gap-1.5 transition-all duration-200"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Upload Design</span>
                </button>
              </div>

              {/* Flat Design Table - Desktop Only */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name of File
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type of File
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
                    {filteredDesigns.map((design) => (
                      <tr key={design.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {/* Version badge */}
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold bg-yellow-500 text-gray-900 rounded">
                              V{design.version_number}
                            </span>
                            {/* Thumbnail */}
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
                            {/* File name */}
                            <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                              {design.file_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {/* Comment count */}
                            {design.comments && design.comments.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                <FiMessageCircle className="w-3.5 h-3.5" />
                                {design.comments.length}
                              </span>
                            )}
                            {/* Pinned indicator */}
                            {hasPinnedComments(design) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                                <FiMapPin className="w-3 h-3" />
                                Pinned
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {design.uploaded_by_user?.full_name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTimeReadable(design.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getStatusBadge(design.approval_status)}
                        </td>
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
                              <button
                                onClick={() => {
                                  setViewerDesign(design);
                                  setOpenMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <FiEye className="w-4 h-4" />
                                View
                              </button>
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

                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    handleToggleFreezeDesign(design);
                                    setOpenMenuId(null);
                                  }}
                                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${design.is_frozen
                                    ? 'text-yellow-700 hover:bg-yellow-50'
                                    : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                  {design.is_frozen ? (
                                    <>
                                      <FiUnlock className="w-4 h-4" />
                                      Unfreeze
                                    </>
                                  ) : (
                                    <>
                                      <FiLock className="w-4 h-4" />
                                      Freeze
                                    </>
                                  )}
                                </button>
                              )}

                              <div className="border-t border-gray-100 my-1"></div>

                              {/* Remove (for owner or admin) */}
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

                              <div className="border-t border-gray-100 my-1"></div>

                              {/* Approve/Reject for admin */}
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
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <FiClock className="w-4 h-4" />
                                    Mark Reviewed
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile List */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredDesigns.map((design) => (
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
                        onClick={() => setMobileActionDesign(design)}
                        className="p-1 text-gray-400"
                      >
                        <FiMoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      }

      {/* Rejection/Changes Modal */}
      {
        approvalDesign && approvalAction && (
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
        )
      }

      {/* Design Viewer Modal - Full Screen */}
      {
        viewerDesign && (
          <div className="fixed inset-0 z-50 bg-black">
            <DesignViewer
              designId={viewerDesign.id}
              fileUrl={viewerDesign.file_url}
              fileName={viewerDesign.file_name}
              fileType={viewerDesign.file_type}
              versionNumber={viewerDesign.version_number}
              approvalStatus={viewerDesign.approval_status}
              onApprovalChange={async (status) => {
                await handleApproval(viewerDesign.id, status);
                // Refresh viewer design data after approval
                const updated = designs.find(d => d.id === viewerDesign.id);
                if (updated) {
                  setViewerDesign({ ...updated, approval_status: status });
                }
              }}
              comments={viewerDesign.comments?.map(c => ({
                ...c,
                x_percent: (c as any).x_percent ?? null,
                y_percent: (c as any).y_percent ?? null,
                zoom_level: (c as any).zoom_level ?? null,
                page_number: (c as any).page_number ?? 1,
                is_resolved: (c as any).is_resolved ?? false,
                linked_task_id: (c as any).linked_task_id ?? null,
              })) || []}
              onCommentAdded={() => {
                fetchDesigns();
              }}
              onClose={() => setViewerDesign(null)}
            />
          </div>
        )
      }
    </div >
  );
}

export default DesignsTab;
