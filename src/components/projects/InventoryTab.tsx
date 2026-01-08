'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { formatDateIST } from '@/lib/dateUtils';
import { ImageModal } from '@/components/ui/ImageModal';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SidePanel } from '@/components/ui/SidePanel';
import { DesignViewer } from '@/components/projects/DesignViewer';
import {
  FiEdit2, FiTrash2, FiEye, FiPlus, FiMoreVertical, FiCheck, FiX, FiUpload, FiPackage, FiSearch, FiChevronDown
} from 'react-icons/fi';

type InventoryItem = {
  id: string;
  project_id: string;
  item_name: string;
  quantity: number | null;
  total_cost: number | null;
  supplier_name: string | null;
  date_purchased: string | null;
  bill_url: string | null;
  bill_urls: string[] | null;
  created_by: string;
  created_at: string;
  bill_approval_status: string | null;
  bill_rejection_reason: string | null;
  is_bill_resubmission: boolean | null;
  created_by_user: {
    id: string;
    full_name: string;
    email: string;
  };
};



interface InventoryItemFormProps {
  form: {
    item_name: string;
    expense_type: string;
    quantity: string;
    amount: string;
    date_purchased: string;
    bill_urls: string[];
    po_id: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    item_name: string;
    expense_type: string;
    quantity: string;
    amount: string;
    date_purchased: string;
    bill_urls: string[];
    bill_url: string; // Keep for compatibility if needed
    po_id: string;
  }>>;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onBillUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveBill: (url: string) => void;
  saving: boolean;
  uploadingBill: boolean;
  isEditing: boolean;
  projectId: string; // Added prop
}

const InventoryItemForm = ({
  form, setForm, onClose, onSubmit, onBillUpload, onRemoveBill, saving, uploadingBill, isEditing, projectId
}: InventoryItemFormProps) => {
  const [usePO, setUsePO] = useState(false);
  const [pos, setPos] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [loadingPOs, setLoadingPOs] = useState(false);

  // Fetch POs when usePO is toggled
  useEffect(() => {
    if (usePO && pos.length === 0) {
      const fetchPOs = async () => {
        try {
          setLoadingPOs(true);
          const res = await fetch(`/api/purchase-orders?project_id=${projectId}`);
          const data = await res.json();
          if (data.pos) {
            // Filter only sent/received POs
            const activePos = data.pos.filter((p: any) => ['sent', 'received', 'partially_received'].includes(p.status));
            setPos(activePos);
          }
        } catch (e) {
          console.error('Failed to fetch POs', e);
        } finally {
          setLoadingPOs(false);
        }
      };
      fetchPOs();
    }
  }, [usePO, projectId]);

  const handlePOSelect = (poId: string) => {
    setSelectedPO(poId);
    const po = pos.find(p => p.id === poId);
    if (po) {
      setForm(prev => ({
        ...prev,
        supplier_name: po.supplier?.name || '',
        po_id: poId
      }));
    }
  };

  const handleLineItemSelect = (poId: string, itemIdx: number) => {
    const po = pos.find(p => p.id === poId);
    if (po && po.line_items && po.line_items[itemIdx]) {
      const item = po.line_items[itemIdx];
      setForm(prev => ({
        ...prev,
        item_name: item.description || '',
        quantity: (item.quantity || '').toString(),
      }));
    }
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">

      {!isEditing && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="usePO"
              checked={usePO}
              onChange={(e) => setUsePO(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="usePO" className="text-sm font-medium text-blue-900 cursor-pointer">
              Import from Purchase Order
            </label>
          </div>

          {usePO && (
            <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-2">
              {loadingPOs ? (
                <div className="text-xs text-blue-600">Loading POs...</div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-blue-800 mb-1">Select PO</label>
                    <select
                      className="w-full text-sm border-blue-200 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                      value={selectedPO}
                      onChange={(e) => handlePOSelect(e.target.value)}
                    >
                      <option value="">-- Choose PO --</option>
                      {pos.map(po => (
                        <option key={po.id} value={po.id}>
                          {po.po_number} - {po.supplier?.name} ({new Date(po.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedPO && (
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">Select Item</label>
                      <select
                        className="w-full text-sm border-blue-200 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                        onChange={(e) => handleLineItemSelect(selectedPO, parseInt(e.target.value))}
                      >
                        <option value="">-- Choose Item --</option>
                        {pos.find(p => p.id === selectedPO)?.line_items?.map((item: any, idx: number) => (
                          <option key={idx} value={idx}>
                            {item.description} (Qty: {item.quantity} {item.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expense Name *</label>
        <input
          type="text"
          value={form.item_name}
          onChange={(e) => setForm(prev => ({ ...prev, item_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
          placeholder="Enter expense name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expense Type</label>
        <select
          value={form.expense_type}
          onChange={(e) => setForm(prev => ({ ...prev, expense_type: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
        >
          <option value="">Select type</option>
          <option value="materials">Materials</option>
          <option value="labor">Labor</option>
          <option value="transport">Transport</option>
          <option value="equipment">Equipment Rental</option>
          <option value="utilities">Utilities</option>
          <option value="contractor">Contractor Payment</option>
          <option value="miscellaneous">Miscellaneous</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
        <input
          type="number"
          value={form.quantity}
          onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
          placeholder="Enter quantity"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
        <input
          type="number"
          value={form.amount}
          onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
          placeholder="Enter amount"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date Purchased</label>
        <input
          type="date"
          value={form.date_purchased}
          onChange={(e) => setForm(prev => ({ ...prev, date_purchased: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bill/Invoice</label>

        {form.bill_urls && form.bill_urls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {form.bill_urls.map((url, idx) => (
              <div key={idx} className="relative group">
                {url.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-16 h-16 bg-gray-100 rounded border flex flex-col items-center justify-center p-1">
                    <FiUpload className="w-4 h-4 text-red-500" />
                    <span className="text-[8px] text-gray-500 uppercase mt-0.5">PDF</span>
                  </div>
                ) : (
                  <img src={url} alt="bill" className="w-16 h-16 object-cover rounded border" />
                )}
                <button
                  type="button"
                  onClick={() => onRemoveBill(url)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full !w-5 !h-5 flex items-center justify-center shadow-md z-10 !min-w-0 !min-h-0"
                  style={{ width: '20px', height: '20px', minWidth: '0', minHeight: '0' }}
                >
                  <FiX className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          accept="application/pdf,image/*"
          multiple
          onChange={onBillUpload}
          disabled={uploadingBill}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-yellow-50 file:text-yellow-700"
        />
      </div>
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
          onClick={onSubmit}
          disabled={saving}
          className="flex-1 btn-primary disabled:opacity-50"
        >
          {saving ? 'Saving...' : isEditing ? 'Update' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
};

export interface InventoryTabHandle {
  openAddItem: () => void;
}

type InventoryTabProps = {
  projectId: string;
};

export const InventoryTab = forwardRef<InventoryTabHandle, InventoryTabProps>(({ projectId }, ref) => {
  const { user } = useAuth();
  const { hasPermission } = useUserPermissions();

  // Permission checks
  const canAdd = hasPermission('inventory.add');
  const canApprove = hasPermission('inventory.approve');

  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [mobileActionItem, setMobileActionItem] = useState<InventoryItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewingPDF, setViewingPDF] = useState<{ url: string; filename: string } | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [filters, setFilters] = useState({
    name: '',
    expenseType: '',
    amount: '',
    date: '',
    status: '',
  });

  // Form state
  const [saving, setSaving] = useState(false);
  const [uploadingBill, setUploadingBill] = useState(false);
  const [form, setForm] = useState({
    item_name: '',
    expense_type: '',
    quantity: '',
    amount: '',
    date_purchased: new Date().toISOString().split('T')[0], // Default to today
    bill_urls: [] as string[],
    bill_url: '', // keep for schema compatibility
    po_id: '',
  });

  useImperativeHandle(ref, () => ({
    openAddItem: () => {
      setIsAddingNew(true);
      resetForm();
    }
  }));

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
    fetchItems();
  }, [projectId]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/inventory-items?project_id=${projectId}`);

      if (!response.ok) {
        showToast('error', 'Failed to fetch inventory items');
        return;
      }

      const { items: fetchedItems } = await response.json();
      setItems(fetchedItems || []);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
      showToast('error', 'Failed to fetch inventory items');
    } finally {
      setLoading(false);
    }
  };

  // Filtered items
  const filteredItems = items.filter(item => {
    const matchName = !filters.name || item.item_name.toLowerCase().includes(filters.name.toLowerCase());
    const matchType = !filters.expenseType || (item as any).expense_type === filters.expenseType;
    const matchAmount = !filters.amount || (item.total_cost?.toString() || '').includes(filters.amount);
    const itemDate = item.date_purchased ? formatDateIST(item.date_purchased).toLowerCase() : '-';
    const matchDate = !filters.date || itemDate.includes(filters.date.toLowerCase());
    const matchStatus = !filters.status || (item.bill_approval_status || 'pending') === filters.status;

    return matchName && matchType && matchAmount && matchDate && matchStatus;
  });

  const resetForm = () => {
    setForm({
      item_name: '',
      expense_type: '',
      quantity: '',
      amount: '',
      date_purchased: new Date().toISOString().split('T')[0], // Default to today
      bill_urls: [],
      bill_url: '',
      po_id: ''
    });
    setEditingItem(null);
  };

  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingBill(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `bills/${projectId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('inventory-bills')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('inventory-bills')
          .getPublicUrl(filePath);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      setForm(prev => ({ ...prev, bill_urls: [...(prev.bill_urls || []), ...urls] }));
      showToast('success', `${urls.length} files uploaded`);
    } catch (error) {
      console.error('Error uploading bill:', error);
      showToast('error', 'Failed to upload files');
    } finally {
      setUploadingBill(false);
      e.target.value = '';
    }
  };

  const removeBill = (urlToRemove: string) => {
    setForm(prev => ({
      ...prev,
      bill_urls: (prev.bill_urls || []).filter(url => url !== urlToRemove)
    }));
  };

  const handleSubmit = async () => {
    if (!form.item_name.trim()) {
      showToast('error', 'Item name is required');
      return;
    }

    setSaving(true);
    try {
      const url = editingItem ? `/api/inventory-items/${editingItem.id}` : '/api/inventory-items';
      const method = editingItem ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          item_name: form.item_name,
          expense_type: form.expense_type || undefined,
          quantity: form.quantity ? parseFloat(form.quantity) : undefined,
          total_cost: form.amount ? parseFloat(form.amount) : undefined,
          date_purchased: form.date_purchased || undefined,
          bill_urls: form.bill_urls || [],
          po_id: form.po_id || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save item');
      }

      await fetchItems();
      setIsAddingNew(false);
      resetForm();
      showToast('success', editingItem ? 'Item updated' : 'Item added');
    } catch (error: any) {
      console.error('Error saving item:', error);
      showToast('error', error.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch(`/api/inventory-items/${id}`, { method: 'DELETE' });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete item');
      }

      setItems(prev => prev.filter(item => item.id !== id));
      showToast('success', 'Item deleted');
    } catch (error: any) {
      console.error('Error deleting item:', error);
      showToast('error', error.message || 'Failed to delete item');
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      item_name: item.item_name,
      expense_type: (item as any).expense_type || '',
      quantity: item.quantity?.toString() || '',
      amount: item.total_cost?.toString() || '',
      date_purchased: item.date_purchased || new Date().toISOString().split('T')[0],
      bill_urls: (item as any).bill_urls || (item.bill_url ? [item.bill_url] : []),
      bill_url: item.bill_url || '',
      po_id: '',
    });
    setIsAddingNew(true);
    setOpenMenuId(null);
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/inventory-items/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (!response.ok) throw new Error('Failed to approve');

      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, bill_approval_status: 'approved' } : item
      ));
      showToast('success', 'Bill approved');
      setOpenMenuId(null);
    } catch (error) {
      showToast('error', 'Failed to approve bill');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/inventory-items/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      });

      if (!response.ok) throw new Error('Failed to reject');

      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, bill_approval_status: 'rejected', bill_rejection_reason: reason } : item
      ));
      showToast('success', 'Bill rejected');
      setOpenMenuId(null);
    } catch (error) {
      showToast('error', 'Failed to reject bill');
    }
  };

  const getStatusBadge = (status: string | null) => {
    const config = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
    };
    const c = config[(status || 'pending') as keyof typeof config] || config.pending;
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };



  if (loading) {
    return (
      <div className="bg-white shadow sm:rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow sm:rounded-lg overflow-visible">
      {/* Desktop Side Panel */}
      <SidePanel
        isOpen={isAddingNew && !isMobile}
        onClose={() => { setIsAddingNew(false); resetForm(); }}
        title={editingItem ? 'Edit Expense' : 'Add Expense'}
      >
        <InventoryItemForm
          form={form}
          setForm={setForm}
          onClose={() => { setIsAddingNew(false); resetForm(); }}
          onSubmit={handleSubmit}
          onBillUpload={handleBillUpload}
          onRemoveBill={removeBill}
          saving={saving}
          uploadingBill={uploadingBill}
          isEditing={!!editingItem}
          projectId={projectId}
        />
      </SidePanel>

      {/* Mobile Bottom Sheet */}
      <BottomSheet
        isOpen={isAddingNew && isMobile}
        onClose={() => { setIsAddingNew(false); resetForm(); }}
        title={editingItem ? 'Edit Expense' : 'Add Expense'}
      >
        <InventoryItemForm
          form={form}
          setForm={setForm}
          onClose={() => { setIsAddingNew(false); resetForm(); }}
          onSubmit={handleSubmit}
          onBillUpload={handleBillUpload}
          onRemoveBill={removeBill}
          saving={saving}
          uploadingBill={uploadingBill}
          isEditing={!!editingItem}
          projectId={projectId}
        />
      </BottomSheet>

      {/* Mobile Actions Bottom Sheet */}
      <BottomSheet
        isOpen={mobileActionItem !== null}
        onClose={() => setMobileActionItem(null)}
        title="Expense Actions"
      >
        {mobileActionItem && (
          <div className="space-y-1">
            {mobileActionItem.bill_url && (
              <button
                onClick={() => {
                  const isPDF = mobileActionItem.bill_url!.toLowerCase().endsWith('.pdf');
                  if (isPDF) {
                    setViewingPDF({
                      url: mobileActionItem.bill_url!,
                      filename: `${mobileActionItem.item_name} - Bill`
                    });
                  } else {
                    setSelectedImage(mobileActionItem.bill_url!);
                  }
                  setMobileActionItem(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                <FiEye className="w-5 h-5 text-gray-500" /> View Bill
              </button>
            )}

            <button
              onClick={() => {
                if (mobileActionItem) handleEdit(mobileActionItem);
                setMobileActionItem(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              <FiEdit2 className="w-5 h-5 text-gray-500" /> Edit Item
            </button>

            {canApprove && mobileActionItem.bill_approval_status === 'pending' && (
              <>
                <button
                  onClick={() => {
                    if (mobileActionItem) handleApprove(mobileActionItem.id);
                    setMobileActionItem(null);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-green-700 hover:bg-green-50 rounded-lg"
                >
                  <FiCheck className="w-5 h-5" /> Approve
                </button>
                <button
                  onClick={() => {
                    if (mobileActionItem) handleReject(mobileActionItem.id);
                    setMobileActionItem(null);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg"
                >
                  <FiX className="w-5 h-5" /> Reject
                </button>
              </>
            )}

            <button
              onClick={() => {
                if (mobileActionItem) handleDelete(mobileActionItem.id);
                setMobileActionItem(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
            >
              <FiTrash2 className="w-5 h-5" /> Delete Item
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Empty State */}
      {
        items.length === 0 ? (
          <div className="p-3">
            {/* Add Item Button Removed */}
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <FiPackage className="h-12 w-12 mx-auto text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No expenses yet</h3>
              <p className="mt-1 text-sm text-gray-500">Add your first item to get started.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-visible">
              {/* Action bar */}
              <div className="flex justify-end px-4 py-2 border-b border-gray-200">
                {/* Add Item Button Removed */}
              </div>
              <table className="min-w-full divide-y divide-gray-200 overflow-visible">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expense Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                            placeholder="Search Expense"
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
                          value={filters.expenseType || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, expenseType: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white appearance-none"
                        >
                          <option value="">All Types</option>
                          <option value="materials">Materials</option>
                          <option value="labor">Labor</option>
                          <option value="transport">Transport</option>
                          <option value="equipment">Equipment</option>
                          <option value="utilities">Utilities</option>
                          <option value="contractor">Contractor</option>
                          <option value="miscellaneous">Misc</option>
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
                          placeholder="Amount"
                          value={filters.amount || ''}
                          onChange={(e) => setFilters(prev => ({ ...prev, amount: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative w-full">
                        <input
                          type="text"
                          placeholder="Filter Date"
                          value={filters.date}
                          onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative w-full">
                        <select
                          value={filters.status}
                          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:bg-white appearance-none"
                        >
                          <option value="">Status</option>
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
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
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.item_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        <span className="capitalize">{(item as any).expense_type || '-'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {item.total_cost ? `₹${item.total_cost.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {item.date_purchased ? formatDateIST(item.date_purchased) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(item.bill_approval_status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (openMenuId === item.id) {
                              setOpenMenuId(null);
                              setMenuPosition(null);
                            } else {
                              setOpenMenuId(item.id);
                              setMenuPosition({
                                top: rect.bottom + window.scrollY,
                                left: rect.right - 192 // 192px = w-48
                              });
                            }
                          }}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          <FiMoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Portal-based Dropdown Menu */}
                  {openMenuId && menuPosition && typeof document !== 'undefined' && createPortal(
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-[9998]"
                        onClick={() => { setOpenMenuId(null); setMenuPosition(null); }}
                      />
                      <div
                        ref={menuRef}
                        className="fixed w-48 rounded-md shadow-lg bg-white border border-gray-200 z-[9999]"
                        style={{ top: menuPosition.top, left: menuPosition.left }}
                      >
                        <div className="py-1" role="menu">
                          {filteredItems.find(i => i.id === openMenuId)?.bill_url && (
                            <button
                              onClick={() => {
                                const item = filteredItems.find(i => i.id === openMenuId);
                                if (!item?.bill_url) return;
                                const isPDF = item.bill_url.toLowerCase().endsWith('.pdf');
                                if (isPDF) {
                                  setViewingPDF({
                                    url: item.bill_url,
                                    filename: `${item.item_name} - Bill`
                                  });
                                } else {
                                  setSelectedImage(item.bill_url);
                                }
                                setOpenMenuId(null);
                                setMenuPosition(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <FiEye className="w-4 h-4" /> View Bill
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const item = filteredItems.find(i => i.id === openMenuId);
                              if (item) handleEdit(item);
                              setMenuPosition(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <FiEdit2 className="w-4 h-4" /> Edit
                          </button>
                          {canApprove && (() => {
                            const item = filteredItems.find(i => i.id === openMenuId);
                            return item && (item.bill_approval_status === 'pending' || item.bill_approval_status === 'rejected');
                          })() && (
                              <button
                                onClick={() => { handleApprove(openMenuId); setMenuPosition(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                              >
                                <FiCheck className="w-4 h-4" /> Approve
                              </button>
                            )}
                          {canApprove && (() => {
                            const item = filteredItems.find(i => i.id === openMenuId);
                            return item && (item.bill_approval_status === 'pending' || item.bill_approval_status === 'approved');
                          })() && (
                              <button
                                onClick={() => { handleReject(openMenuId); setMenuPosition(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                              >
                                <FiX className="w-4 h-4" /> Reject
                              </button>
                            )}
                          <button
                            onClick={() => { handleDelete(openMenuId); setMenuPosition(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <FiTrash2 className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </tbody>
              </table>

              {filteredItems.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No items match your search filters.
                </div>
              )}
            </div>

            {/* Mobile List View */}
            <div className="md:hidden">
              <div className="divide-y divide-gray-200">
                {filteredItems.map(item => (
                  <div key={item.id} className="p-4 bg-white" onClick={() => setMobileActionItem(item)}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{item.item_name}</h4>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span>{item.quantity} units</span>
                          <span>•</span>
                          <span>{item.date_purchased ? formatDateIST(item.date_purchased) : '-'}</span>
                        </div>
                      </div>
                      {getStatusBadge(item.bill_approval_status)}
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>{item.supplier_name || 'No supplier'}</span>
                      <FiMoreVertical className="text-gray-400" />
                    </div>
                  </div>
                ))}
                {filteredItems.length === 0 && (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No items match your search.
                  </div>
                )}
              </div>
            </div>
          </>
        )
      }

      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        images={selectedImage ? [selectedImage] : []}
        currentIndex={0}
      />

      {viewingPDF && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">{viewingPDF.filename}</h3>
              <button
                onClick={() => setViewingPDF(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiX className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 p-0 overflow-hidden">
              <iframe
                src={viewingPDF.url}
                className="w-full h-full"
                title="PDF Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </div >
  );
});

InventoryTab.displayName = 'InventoryTab';
