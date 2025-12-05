'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateIST } from '@/lib/dateUtils';
import { ImageModal } from '@/components/ui/ImageModal';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InlineApproval } from '@/components/ui/InlineApproval';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FiEdit2, FiTrash2, FiEye, FiPlus, FiChevronDown, FiChevronUp, FiX, FiUpload } from 'react-icons/fi';

type InventoryItem = {
  id: string;
  project_id: string;
  item_name: string;
  quantity: number | null;
  total_cost: number | null;
  supplier_name: string | null;
  date_purchased: string | null;
  bill_url: string | null;
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

type InventoryTabProps = {
  projectId: string;
};

export function InventoryTab({ projectId }: InventoryTabProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline expansion state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Form state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingBill, setUploadingBill] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    item_name: '',
    quantity: '',
    supplier_name: '',
    date_purchased: '',
    bill_url: '',
  });

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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

  const resetForm = () => {
    setForm({
      item_name: '',
      quantity: '',
      supplier_name: '',
      date_purchased: '',
      bill_url: '',
    });
    setFormErrors({});
  };

  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBill(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('inventory-bills')
        .upload(fileName, file);

      if (error) {
        console.error('Error uploading bill:', error);
        showToast('error', 'Failed to upload bill');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('inventory-bills')
        .getPublicUrl(fileName);

      setForm(prev => ({ ...prev, bill_url: publicUrl }));
      showToast('success', 'Bill uploaded successfully');
    } catch (error) {
      console.error('Error uploading bill:', error);
      showToast('error', 'Failed to upload bill');
    } finally {
      setUploadingBill(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.item_name.trim()) {
      errors.item_name = 'Item name is required';
    }

    if (form.quantity && parseFloat(form.quantity) <= 0) {
      errors.quantity = 'Quantity must be greater than 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);

    try {
      const url = '/api/inventory-items';
      const method = editingItem ? 'PATCH' : 'POST';

      const body: any = {
        project_id: projectId,
        item_name: form.item_name.trim(),
        quantity: form.quantity ? parseFloat(form.quantity) : undefined,
        supplier_name: form.supplier_name.trim() || undefined,
        date_purchased: form.date_purchased || undefined,
        bill_url: form.bill_url || undefined,
      };

      if (editingItem) {
        body.id = editingItem.id;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save item');
      }

      const { item } = await response.json();

      if (editingItem) {
        setItems(prev => prev.map(i => i.id === item.id ? item : i));
        showToast('success', 'Item updated successfully');
      } else {
        setItems(prev => [item, ...prev]);
        showToast('success', 'Item added successfully');
      }

      // Close form
      setExpandedItemId(null);
      setIsAddingNew(false);
      setEditingItem(null);
      resetForm();
    } catch (error: any) {
      console.error('Error saving item:', error);
      showToast('error', error.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      item_name: item.item_name,
      quantity: item.quantity?.toString() || '',
      supplier_name: item.supplier_name || '',
      date_purchased: item.date_purchased || '',
      bill_url: item.bill_url || '',
    });
    setExpandedItemId(item.id);
    setIsAddingNew(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/inventory-items?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      setItems(prev => prev.filter(i => i.id !== id));
      showToast('success', 'Item deleted successfully');
    } catch (error) {
      console.error('Error deleting item:', error);
      showToast('error', 'Failed to delete item');
    }
  };

  const handleApproveBill = async (itemId: string) => {
    setLoadingItems(prev => new Set(prev).add(itemId));

    // Optimistic update
    const previousItems = [...items];
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, bill_approval_status: 'approved' }
        : item
    ));

    try {
      const response = await fetch(`/api/inventory-items/${itemId}/approve-bill`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        setItems(previousItems);
        showToast('error', error.error || 'Failed to approve bill');
      } else {
        showToast('success', 'Bill approved');
      }
    } catch (error: any) {
      console.error('Error approving bill:', error);
      setItems(previousItems);
      showToast('error', error.message || 'Failed to approve bill');
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleRejectBill = async (itemId: string, reason?: string) => {
    if (!reason?.trim()) {
      showToast('error', 'Please provide a rejection reason');
      return;
    }

    setLoadingItems(prev => new Set(prev).add(itemId));

    try {
      const response = await fetch(`/api/inventory-items/${itemId}/reject-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: reason.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject bill');
      }

      setItems(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, bill_approval_status: 'rejected', bill_rejection_reason: reason.trim() }
          : item
      ));

      showToast('success', 'Bill rejected');
    } catch (error: any) {
      console.error('Error rejecting bill:', error);
      showToast('error', error.message || 'Failed to reject bill');
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleResubmitBill = async (itemId: string, billUrl: string) => {
    if (!billUrl) {
      showToast('error', 'Please upload a new bill');
      return;
    }

    setLoadingItems(prev => new Set(prev).add(itemId));

    try {
      const response = await fetch(`/api/inventory-items/${itemId}/resubmit-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bill_url: billUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resubmit bill');
      }

      setItems(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, bill_approval_status: 'pending', bill_url: billUrl, bill_rejection_reason: null, is_bill_resubmission: true }
          : item
      ));

      showToast('success', 'Bill resubmitted successfully');
      setExpandedItemId(null);
    } catch (error: any) {
      console.error('Error resubmitting bill:', error);
      showToast('error', error.message || 'Failed to resubmit bill');
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleStartAddNew = () => {
    setIsAddingNew(true);
    setExpandedItemId(null);
    setEditingItem(null);
    resetForm();
  };

  const handleCloseForm = () => {
    setIsAddingNew(false);
    setExpandedItemId(null);
    setEditingItem(null);
    resetForm();
  };

  // Form component used for both add and edit
  const ItemForm = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Item Name *</label>
        <input
          type="text"
          value={form.item_name}
          onChange={(e) => setForm(prev => ({ ...prev, item_name: e.target.value }))}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 ${formErrors.item_name ? 'border-red-300' : 'border-gray-300'
            }`}
          placeholder="e.g., Cement, Paint, Tiles"
        />
        {formErrors.item_name && (
          <p className="mt-1 text-xs text-red-600">{formErrors.item_name}</p>
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Supplier Name</label>
        <input
          type="text"
          value={form.supplier_name}
          onChange={(e) => setForm(prev => ({ ...prev, supplier_name: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
          placeholder="Optional"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Quantity</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={form.quantity}
          onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 ${formErrors.quantity ? 'border-red-300' : 'border-gray-300'
            }`}
          placeholder="Optional"
        />
        {formErrors.quantity && (
          <p className="mt-1 text-xs text-red-600">{formErrors.quantity}</p>
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Date Purchased</label>
        <input
          type="date"
          value={form.date_purchased}
          onChange={(e) => setForm(prev => ({ ...prev, date_purchased: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs text-gray-600 mb-1">Bill/Invoice</label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleBillUpload}
          disabled={uploadingBill}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
        />
        {uploadingBill && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}
        {form.bill_url && (
          <button
            onClick={() => setSelectedImage(form.bill_url)}
            className="text-xs text-yellow-600 hover:underline hover:text-yellow-700 mt-1 block"
          >
            📄 View uploaded bill
          </button>
        )}
      </div>
      <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
        <button
          onClick={handleCloseForm}
          disabled={saving}
          className="px-4 py-2 rounded-md text-sm text-gray-700 bg-gray-100 hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || uploadingBill}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold disabled:opacity-50"
        >
          {saving ? 'Saving...' : editingItem ? 'Update' : 'Add Item'}
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
        <div>
          <h3 className="text-base sm:text-lg font-medium leading-6 text-gray-900">Inventory</h3>
        </div>
        <button
          onClick={handleStartAddNew}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold w-full sm:w-auto flex items-center justify-center gap-2"
        >
          <FiPlus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Inline Add New Form (Desktop) */}
      {isAddingNew && !isMobile && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg animate-slide-down">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-900">New Item</h4>
            <button
              onClick={handleCloseForm}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
          <ItemForm />
        </div>
      )}

      {/* Mobile Bottom Sheet for Add */}
      <BottomSheet
        isOpen={isAddingNew && isMobile}
        onClose={handleCloseForm}
        title="New Item"
      >
        <ItemForm />
      </BottomSheet>

      {/* Inventory List */}
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No inventory items yet. Add your first item!</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Item Row */}
              <div
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${expandedItemId === item.id ? 'bg-gray-50' : ''
                  }`}
                onClick={() => {
                  if (expandedItemId === item.id) {
                    setExpandedItemId(null);
                    setEditingItem(null);
                    resetForm();
                  } else {
                    setExpandedItemId(item.id);
                    setIsAddingNew(false);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900">{item.item_name}</h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                      {item.quantity && <span>Qty: {item.quantity}</span>}
                      {item.supplier_name && <span>Supplier: {item.supplier_name}</span>}
                      {item.date_purchased && <span>{formatDateIST(item.date_purchased)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {/* Status Badge */}
                    <span className={`px-2 py-1 text-xs rounded-full ${item.bill_approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                        item.bill_approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                      }`}>
                      {item.bill_approval_status === 'approved' ? 'Approved' :
                        item.bill_approval_status === 'rejected' ? 'Rejected' : 'Pending'}
                    </span>
                    {/* Expand Toggle */}
                    {expandedItemId === item.id ? (
                      <FiChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <FiChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content (Desktop) */}
              {expandedItemId === item.id && !isMobile && (
                <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50 animate-slide-down">
                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 pt-4">
                    {item.bill_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(item.bill_url!);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <FiEye className="w-4 h-4" />
                        View Bill
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(item);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100"
                    >
                      <FiEdit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <ConfirmDialog
                      trigger={
                        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                          <FiTrash2 className="w-4 h-4" />
                          Delete
                        </button>
                      }
                      title="Delete Item"
                      message="Are you sure you want to delete this item? This action cannot be undone."
                      confirmLabel="Delete"
                      destructive
                      onConfirm={() => handleDelete(item.id)}
                    />
                  </div>

                  {/* Inline Approval (for admin) */}
                  {user?.role === 'admin' && item.bill_url && item.bill_approval_status === 'pending' && (
                    <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-2">Bill Approval</p>
                      <InlineApproval
                        status="pending"
                        onApprove={() => handleApproveBill(item.id)}
                        onReject={(reason) => handleRejectBill(item.id, reason)}
                        requireRejectReason
                        size="sm"
                      />
                    </div>
                  )}

                  {/* Rejection reason display */}
                  {item.bill_approval_status === 'rejected' && item.bill_rejection_reason && (
                    <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs font-medium text-red-800">Rejection Reason:</p>
                      <p className="text-sm text-red-700 mt-1">{item.bill_rejection_reason}</p>

                      {/* Resubmit option for creator */}
                      {item.created_by === user?.id && (
                        <div className="mt-3">
                          <label className="block text-xs text-red-700 mb-1">Upload New Bill</label>
                          <div className="flex gap-2">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={handleBillUpload}
                              disabled={uploadingBill || loadingItems.has(item.id)}
                              className="flex-1 text-xs"
                            />
                            {form.bill_url && (
                              <button
                                onClick={() => handleResubmitBill(item.id, form.bill_url)}
                                disabled={loadingItems.has(item.id)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                              >
                                {loadingItems.has(item.id) ? 'Submitting...' : 'Resubmit'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Edit Form (inline when editing) */}
                  {editingItem?.id === item.id && (
                    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                      <h5 className="text-sm font-semibold text-gray-900 mb-3">Edit Item</h5>
                      <ItemForm />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mobile Bottom Sheet for Expanded Item */}
      {expandedItemId && isMobile && (
        <BottomSheet
          isOpen={true}
          onClose={() => {
            setExpandedItemId(null);
            setEditingItem(null);
            resetForm();
          }}
          title={items.find(i => i.id === expandedItemId)?.item_name || 'Item Details'}
        >
          {(() => {
            const item = items.find(i => i.id === expandedItemId);
            if (!item) return null;

            return (
              <div className="space-y-4">
                {/* Item Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Quantity</p>
                    <p className="font-medium">{item.quantity || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Supplier</p>
                    <p className="font-medium">{item.supplier_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="font-medium">{item.date_purchased ? formatDateIST(item.date_purchased) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${item.bill_approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                        item.bill_approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                      }`}>
                      {item.bill_approval_status || 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {item.bill_url && (
                    <button
                      onClick={() => setSelectedImage(item.bill_url!)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg"
                    >
                      <FiEye className="w-4 h-4" />
                      View Bill
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg"
                  >
                    <FiEdit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <ConfirmDialog
                    trigger={
                      <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg">
                        <FiTrash2 className="w-4 h-4" />
                        Delete
                      </button>
                    }
                    title="Delete Item"
                    message="Are you sure you want to delete this item?"
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => handleDelete(item.id)}
                  />
                </div>

                {/* Inline Approval for Admin */}
                {user?.role === 'admin' && item.bill_url && item.bill_approval_status === 'pending' && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-2">Bill Approval</p>
                    <InlineApproval
                      status="pending"
                      onApprove={() => handleApproveBill(item.id)}
                      onReject={(reason) => handleRejectBill(item.id, reason)}
                      requireRejectReason
                    />
                  </div>
                )}

                {/* Rejection reason + resubmit */}
                {item.bill_approval_status === 'rejected' && item.bill_rejection_reason && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-xs font-medium text-red-800">Rejection Reason:</p>
                    <p className="text-sm text-red-700 mt-1">{item.bill_rejection_reason}</p>

                    {item.created_by === user?.id && (
                      <div className="mt-3">
                        <label className="block text-xs text-red-700 mb-1">Upload New Bill</label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleBillUpload}
                          disabled={uploadingBill}
                          className="w-full text-xs"
                        />
                        {form.bill_url && (
                          <button
                            onClick={() => handleResubmitBill(item.id, form.bill_url)}
                            disabled={loadingItems.has(item.id)}
                            className="mt-2 w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {loadingItems.has(item.id) ? 'Submitting...' : 'Resubmit Bill'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Edit Form */}
                {editingItem?.id === item.id && (
                  <div className="pt-4 border-t border-gray-200">
                    <h5 className="text-sm font-semibold text-gray-900 mb-3">Edit Item</h5>
                    <ItemForm />
                  </div>
                )}
              </div>
            );
          })()}
        </BottomSheet>
      )}

      {/* Image Modal for Bills (keeping this as it's appropriate for full-screen viewing) */}
      <ImageModal
        images={selectedImage ? [selectedImage] : []}
        currentIndex={0}
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}

export default InventoryTab;
