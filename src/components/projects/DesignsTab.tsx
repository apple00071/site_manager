'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { formatDateTimeReadable } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SidePanel } from '@/components/ui/SidePanel';
import { DesignViewer } from '@/components/projects/DesignViewer';
import {
  FiUpload, FiFileText, FiPaperclip, FiEye, FiPlus,
  FiMoreVertical, FiEdit, FiTrash2, FiDownload, FiCheck, FiX, FiClock, FiAlertCircle, FiLock, FiUnlock,
  FiMessageCircle, FiMapPin, FiSearch, FiChevronDown
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



interface DesignUploadFormProps {
  uploadForm: {
    files: File[];
    category: string;
    version_number: number;
  };
  setUploadForm: React.Dispatch<React.SetStateAction<{
    files: File[];
    category: string;
    version_number: number;
  }>>;
  onClose: () => void;
  onUpload: () => void;
  uploading: boolean;
  error: string | null;
  recoveryMessage?: string | null;
  uploadProgress: number;
  uploadIndex: { current: number, total: number };
}

const DesignUploadForm = ({ uploadForm, setUploadForm, onClose, onUpload, uploading, error, recoveryMessage, uploadProgress, uploadIndex }: DesignUploadFormProps) => (
  <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
    {recoveryMessage && (
      <div className="p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
        ⚠️ {recoveryMessage}
      </div>
    )}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Files *
      </label>
      <input
        type="file"
        multiple
        accept="*"
        onChange={(e) => {
          e.stopPropagation();
          const files = e.target.files ? Array.from(e.target.files) : [];
          setUploadForm(prev => ({ ...prev, files: [...prev.files, ...files] }));
        }}
        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      />
      {uploadForm.files.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploadForm.files.map((file, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100 text-xs">
              <span className="truncate flex-1 mr-2">{file.name}</span>
              <button
                onClick={() => setUploadForm(prev => ({ ...prev, files: prev.files.filter((_, idx) => idx !== i) }))}
                className="text-red-500 hover:text-red-700"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
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

    {error && (
      <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
        {error}
      </div>
    )}

    {uploading && (
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Uploading {uploadIndex.current} of {uploadIndex.total}...</span>
          <span>{uploadProgress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      </div>
    )}

    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 btn-secondary"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onUpload}
        disabled={uploading || uploadForm.files.length === 0}
        className="flex-1 btn-primary disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  </form>
);

type DesignsTabProps = {
  projectId: string;
};

export function DesignsTab({ projectId }: DesignsTabProps) {
  const { user, isAdmin } = useAuth();
  const { hasPermission } = useUserPermissions();

  // Permission checks
  const canUpload = hasPermission('designs.upload');
  const canFreeze = hasPermission('designs.freeze');
  const canApprove = hasPermission('designs.approve');
  const canDelete = hasPermission('designs.delete');

  const { showToast } = useToast();
  const [designs, setDesigns] = useState<DesignFile[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openMenu, setOpenMenu] = useState<{ design: DesignFile, top: number, left: number } | null>(null);
  const [mobileActionDesign, setMobileActionDesign] = useState<DesignFile | null>(null);
  const [approvalDesign, setApprovalDesign] = useState<DesignFile | null>(null);
  const [approvalAction, setApprovalAction] = useState<'reject' | 'needs_changes' | null>(null);

  const [approvalComment, setApprovalComment] = useState('');

  // Filter state
  const [filters, setFilters] = useState({
    name: '',
    type: '',
    uploadedBy: '',
    uploadedOn: '',
    status: '',
  });

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
    files: [] as File[],
    category: '', // Room category like "Kitchen", "Bedroom", etc.
    version_number: 1,
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadIndex, setUploadIndex] = useState({ current: 0, total: 0 });
  const [uploadRecoveryMessage, setUploadRecoveryMessage] = useState<string | null>(null);

  // Session storage key for upload recovery
  const UPLOAD_STORAGE_KEY = `design_upload_${projectId}`;

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
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchDesigns();
  }, [projectId]);

  // Persist upload form state to sessionStorage (for mobile tab discard recovery)
  useEffect(() => {
    if (isAddingNew && uploadForm.category) {
      sessionStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify({
        category: uploadForm.category,
        timestamp: Date.now()
      }));
    }
  }, [isAddingNew, uploadForm.category, UPLOAD_STORAGE_KEY]);

  // Recover from page refresh (mobile tab discard)
  useEffect(() => {
    const stored = sessionStorage.getItem(UPLOAD_STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // Only recover if less than 5 minutes old
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          setIsAddingNew(true);
          setUploadForm(prev => ({ ...prev, category: data.category || '' }));
          setUploadRecoveryMessage('Your previous upload was interrupted. Please select the file again.');
          // Clear after recovery
          sessionStorage.removeItem(UPLOAD_STORAGE_KEY);
        } else {
          sessionStorage.removeItem(UPLOAD_STORAGE_KEY);
        }
      } catch {
        sessionStorage.removeItem(UPLOAD_STORAGE_KEY);
      }
    }
  }, [UPLOAD_STORAGE_KEY]);

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
    // Confirmation dialog
    const action = design.is_frozen ? 'unfreeze' : 'freeze';
    const confirmMessage = design.is_frozen
      ? `Unfreeze "${design.file_name}"? This will allow new uploads to this category.`
      : `Freeze "${design.file_name}"? This will prevent new uploads to the "${design.category}" category.`;

    if (!confirm(confirmMessage)) return;

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

      const successMessage = design.is_frozen
        ? `"${design.category}" unfrozen - uploads allowed`
        : `"${design.category}" frozen - uploads blocked`;
      showToast('success', successMessage);
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

  // Get designs for the selected category and apply filters
  const filteredDesigns = useMemo(() => {
    let result = selectedCategory ? (groupedDesigns[selectedCategory] || []) : [];

    // Apply inline filters
    if (filters.name || filters.type || filters.uploadedBy || filters.uploadedOn || filters.status) {
      result = result.filter(d => {
        const matchName = !filters.name || d.file_name.toLowerCase().includes(filters.name.toLowerCase());
        const matchType = !filters.type || d.file_type === filters.type;
        const uploaderName = d.uploaded_by_user?.full_name || 'Unknown';
        const matchUploader = !filters.uploadedBy || uploaderName.toLowerCase().includes(filters.uploadedBy.toLowerCase());
        const uploadDate = formatDateTimeReadable(d.created_at).split(',')[0];
        const matchDate = !filters.uploadedOn || uploadDate.toLowerCase().includes(filters.uploadedOn.toLowerCase());
        const matchStatus = !filters.status || d.approval_status === filters.status;

        return matchName && matchType && matchUploader && matchDate && matchStatus;
      });
    }

    return result;
  }, [groupedDesigns, selectedCategory, filters]);

  // Helper to check if design has pinned comments
  const hasPinnedComments = (design: DesignFile) => {
    return design.comments?.some(c => (c as any).x_percent !== null && (c as any).x_percent !== undefined) || false;
  };

  // Fetch freeze status on mount
  useEffect(() => {
    fetchFreezeStatus();
  }, [projectId]);

  const resetForm = () => {
    setUploadForm({ files: [], category: '', version_number: 1 });
    setFormError(null);
  };

  const handleFileUpload = async () => {
    if (uploadForm.files.length === 0) {
      setFormError('Please select at least one file');
      return;
    }

    if (!uploadForm.category.trim()) {
      setFormError('Please enter a room/category name (e.g. Kitchen, Bedroom)');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadIndex({ current: 0, total: uploadForm.files.length });
    setFormError(null);

    // Debug: Check bucket limit from client side
    try {
      const { data: bucket } = await supabase.storage.getBucket('design-files');
      console.log('📦 Bucket Debug:', {
        id: bucket?.id,
        public: bucket?.public,
        file_size_limit: bucket?.file_size_limit,
        limit_mb: bucket?.file_size_limit ? bucket.file_size_limit / 1024 / 1024 : 'No limit'
      });
    } catch (e) {
      console.warn('Could not fetch bucket info for debug:', e);
    }

    try {
      let successCount = 0;
      let currentIndex = 0;
      for (const file of uploadForm.files) {
        currentIndex++;
        setUploadIndex(prev => ({ ...prev, current: currentIndex }));
        setUploadProgress(0); // Reset for each file

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `designs/${projectId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('design-files')
          .upload(filePath, file, {
            upsert: false,
            onUploadProgress: (progress: any) => {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setUploadProgress(percent);
            }
          });

        if (uploadError) {
          console.error('Error uploading file:', file.name, uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('design-files')
          .getPublicUrl(filePath);

        const fileType = file.type.startsWith('image/') ? 'image' :
          file.type === 'application/pdf' ? 'pdf' : 'other';

        const response = await fetch('/api/design-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: fileType,
            category: uploadForm.category.trim(),
          }),
        });

        if (response.ok) {
          successCount++;
        }
      }

      if (successCount === 0) {
        throw new Error('Failed to upload any files');
      }

      await fetchDesigns();
      setIsAddingNew(false);
      resetForm();
      // Clear recovery state after successful upload
      sessionStorage.removeItem(UPLOAD_STORAGE_KEY);
      setUploadRecoveryMessage(null);
      showToast('success', `Successfully uploaded ${successCount} design(s)`);
    } catch (error: any) {
      console.error('Error uploading designs:', error);
      showToast('error', error.message || 'Failed to upload designs');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadIndex({ current: 0, total: 0 });
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
    setOpenMenu(null);
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



  if (loading) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {/* Table Header */}
        <div className="bg-white border-b border-gray-200 flex text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="flex items-center justify-between w-full px-4 py-3">
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-gray-200 rounded"></div>
              <div className="h-8 w-20 bg-gray-200 rounded"></div>
              <div className="h-8 w-24 bg-gray-200 rounded"></div>
            </div>
            <div className="h-8 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
        {/* Design cards skeleton */}
        <div className="p-4 space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
              <div className="h-12 w-12 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="flex gap-2">
                  <div className="h-3 w-16 bg-gray-200 rounded"></div>
                  <div className="h-3 w-20 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div className="h-8 w-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div >
    );
  }

  return (
    <div className="bg-white shadow sm:rounded-lg overflow-hidden max-w-full">
      {/* Desktop Side Panel for Upload */}
      <SidePanel
        isOpen={isAddingNew && !isMobile}
        onClose={handleCloseForm}
        title="Upload New Design"
      >
        <DesignUploadForm
          uploadForm={uploadForm}
          setUploadForm={setUploadForm}
          onClose={handleCloseForm}
          onUpload={handleFileUpload}
          uploading={uploading}
          error={formError}
          recoveryMessage={uploadRecoveryMessage}
          uploadProgress={uploadProgress}
          uploadIndex={uploadIndex}
        />
      </SidePanel>

      {/* Mobile Bottom Sheet for Upload */}
      <BottomSheet
        isOpen={isAddingNew && isMobile}
        onClose={handleCloseForm}
        title="Upload New Design"
      >
        <DesignUploadForm
          uploadForm={uploadForm}
          setUploadForm={setUploadForm}
          onClose={handleCloseForm}
          onUpload={handleFileUpload}
          uploading={uploading}
          error={formError}
          recoveryMessage={uploadRecoveryMessage}
          uploadProgress={uploadProgress}
          uploadIndex={uploadIndex}
        />
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

            {/* Freeze/Unfreeze (permission check) */}
            {canFreeze && (
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

            {canApprove && mobileActionDesign.approval_status === 'pending' && (
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

            {(canDelete || mobileActionDesign.uploaded_by === user?.id) && (
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
                className="btn-primary"
              >
                <FiPlus className="w-4 h-4" />
                Upload Design
              </button>
            </div>
            <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <div className="flex justify-center">
                <div className="rounded-full bg-yellow-100 p-3">
                  <FiUpload className="h-8 w-8 text-yellow-600" />
                </div>
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">No designs yet</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                Upload your first design file to get started. Supports PDF, images, and CAD files.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-hidden max-w-full">
              {/* Action bar above table */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
                {/* Category Tabs */}
                {/* Mobile dropdown */}
                <div className="md:hidden flex-1 mr-2">
                  <select
                    value={selectedCategory || ''}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-white border-b-2 border-transparent text-sm font-medium focus:outline-none text-gray-500"
                  >
                    {categories.map((category) => {
                      const count = groupedDesigns[category]?.length || 0;
                      return (
                        <option key={category} value={category}>
                          {category} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Desktop tabs */}
                <div className="hidden md:flex flex-1 items-center gap-1 overflow-x-auto min-w-0 mr-2">
                  {categories.map((category) => {
                    const count = groupedDesigns[category]?.length || 0;
                    const isActive = selectedCategory === category;
                    return (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${isActive
                          ? 'text-yellow-600 border-b-2 border-yellow-500'
                          : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-200'
                          }`}
                      >
                        {category}
                        <span className={`ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full ${isActive ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
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
                  className="btn-primary"
                >
                  <FiPlus className="w-4 h-4" />
                  <span className="hidden md:inline">Upload Design</span>
                </button>
              </div>

              {/* Flat Design Table - Desktop Only */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Name of File
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Type of File
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Uploaded By
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Uploaded On
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                    {/* Inline Filter Row */}
                    <tr className="bg-white border-b border-gray-200">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 p-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                          </span>
                          <div className="relative w-full">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                              <FiSearch className="w-3 h-3 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              placeholder="Search Name of File"
                              value={filters.name}
                              onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-full">
                          <select
                            value={filters.type}
                            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                            className="w-full pl-2 pr-6 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white appearance-none"
                          >
                            <option value="">Select</option>
                            <option value="image">Image</option>
                            <option value="pdf">PDF</option>
                            <option value="other">Other</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                            <FiChevronDown className="w-3 h-3" />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-full">
                          <input
                            type="text"
                            placeholder="Select Uploaded by"
                            value={filters.uploadedBy}
                            onChange={(e) => setFilters(prev => ({ ...prev, uploadedBy: e.target.value }))}
                            className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-full">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                            <FiClock className="w-3 h-3 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            placeholder="Uploaded on"
                            value={filters.uploadedOn}
                            onChange={(e) => setFilters(prev => ({ ...prev, uploadedOn: e.target.value }))}
                            className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-full">
                          <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full pl-2 pr-6 py-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white appearance-none"
                          >
                            <option value="">Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="needs_changes">Changes</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                            <FiChevronDown className="w-3 h-3" />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDesigns.map((design) => (
                      <tr key={design.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {/* Version badge */}
                            <div className="flex items-center gap-1">
                              <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded ${design.is_current_approved
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-700'
                                }`}>
                                V{design.version_number}
                              </span>
                              {design.is_current_approved && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-green-600 text-white rounded">
                                  LATEST
                                </span>
                              )}
                              {design.is_frozen && (
                                <FiLock className="w-3.5 h-3.5 text-yellow-600" title="Frozen" />
                              )}
                            </div>
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
                        <td className="px-3 py-3 whitespace-nowrap">
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
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                          {design.uploaded_by_user?.full_name || 'Unknown'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTimeReadable(design.created_at)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {getStatusBadge(design.approval_status)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-right relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              // Toggle if clicking same button
                              if (openMenu?.design.id === design.id) {
                                setOpenMenu(null);
                              } else {
                                setOpenMenu({
                                  design,
                                  top: rect.bottom + 5,
                                  left: rect.right - 192, // 192px = w-48
                                });
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <FiMoreVertical className="w-5 h-5" />
                          </button>


                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile List */}
            <div className="md:hidden divide-y divide-gray-200 overflow-hidden">
              {filteredDesigns.map((design) => (
                <div key={design.id} className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Left: V-Badge + Thumbnail */}
                    <div className="flex-shrink-0 flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 text-xs font-bold rounded ${design.is_current_approved
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-700'
                          }`}>
                          V{design.version_number}
                        </span>
                        {design.is_current_approved && (
                          <span className="inline-flex items-center px-1 py-0.5 text-[9px] font-bold bg-green-600 text-white rounded">
                            LATEST
                          </span>
                        )}
                        {design.is_frozen && (
                          <FiLock className="w-3 h-3 text-yellow-600" title="Frozen" />
                        )}
                      </div>
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
                    </div>

                    {/* Right: Content */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-gray-900 truncate leading-tight pr-2 max-w-full">
                          {design.file_name}
                        </p>
                        <button
                          onClick={() => setMobileActionDesign(design)}
                          className="p-1 -mr-2 -mt-1 text-gray-400 hover:bg-gray-100 rounded-full flex-shrink-0"
                        >
                          <FiMoreVertical className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                        <div className="scale-90 origin-left">
                          {getStatusBadge(design.approval_status)}
                        </div>
                        <span className="text-xs text-gray-500">
                          {design.uploaded_by_user?.full_name} • {formatDateTimeReadable(design.created_at).split(',')[0]}
                        </span>
                      </div>
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

      {/* Desktop Dropdown Menu (Fixed) */}
      {openMenu && (
        <div
          ref={menuRef}
          style={{ top: openMenu.top, left: openMenu.left }}
          className="fixed z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
        >
          {(() => {
            const design = openMenu.design;
            return (
              <>
                <button
                  onClick={() => {
                    setViewerDesign(design);
                    setOpenMenu(null);
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
                  onClick={() => setOpenMenu(null)}
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

                {canFreeze && (
                  <button
                    onClick={() => {
                      handleToggleFreezeDesign(design);
                      setOpenMenu(null);
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

                {(canDelete || design.uploaded_by === user?.id) && (
                  <button
                    onClick={() => {
                      handleDelete(design.id);
                      setOpenMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    Remove
                  </button>
                )}

                <div className="border-t border-gray-100 my-1"></div>

                {isAdmin && design.approval_status === 'pending' && (
                  <>
                    <button
                      onClick={() => {
                        handleApproval(design.id, 'approved');
                        setOpenMenu(null);
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
                        setOpenMenu(null);
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
                        setOpenMenu(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FiClock className="w-4 h-4" />
                      Mark Reviewed
                    </button>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default DesignsTab;

