'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateIST } from '@/lib/dateUtils';
import { ImageModal } from '@/components/ui/ImageModal';
import { useToast } from '@/components/ui/Toast';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SidePanel } from '@/components/ui/SidePanel';
import {
  FiEdit2, FiTrash2, FiEye, FiPlus, FiMoreVertical, FiCheck, FiX, FiUpload, FiPackage
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

  // UI state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Form state
  const [saving, setSaving] = useState(false);
  const [uploadingBill, setUploadingBill] = useState(false);
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

  const resetForm = () => {
    setForm({ item_name: '', quantity: '', supplier_name: '', date_purchased: '', bill_url: '' });
    setEditingItem(null);
  };

  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBill(true);
    try {
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

      setForm(prev => ({ ...prev, bill_url: publicUrl }));
      showToast('success', 'Bill uploaded');
    } catch (error) {
      console.error('Error uploading bill:', error);
      showToast('error', 'Failed to upload bill');
    } finally {
      setUploadingBill(false);
    }
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
          quantity: form.quantity ? parseFloat(form.quantity) : null,
          supplier_name: form.supplier_name || null,
          date_purchased: form.date_purchased || null,
          bill_url: form.bill_url || null,
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
      quantity: item.quantity?.toString() || '',
      supplier_name: item.supplier_name || '',
      date_purchased: item.date_purchased || '',
      bill_url: item.bill_url || '',
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

  // Form component
  const ItemForm = () => (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
        <input
          type="text"
          value={form.item_name}
          onChange={(e) => setForm(prev => ({ ...prev, item_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
          placeholder="Enter item name"
        />
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
        <input
          type="text"
          value={form.supplier_name}
          onChange={(e) => setForm(prev => ({ ...prev, supplier_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
          placeholder="Enter supplier name"
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
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            e.stopPropagation();
            handleBillUpload(e);
          }}
          disabled={uploadingBill}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-yellow-50 file:text-yellow-700"
        />
        {form.bill_url && (
          <p className="mt-1 text-xs text-green-600">✓ Bill uploaded</p>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => { setIsAddingNew(false); resetForm(); }}
          className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-yellow-500 text-gray-900 font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50"
        >
          {saving ? 'Saving...' : editingItem ? 'Update' : 'Add Item'}
        </button>
      </div>
    </form>
  );

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
    <div className="bg-white shadow sm:rounded-lg">
      {/* Desktop Side Panel */}
      <SidePanel
        isOpen={isAddingNew && !isMobile}
        onClose={() => { setIsAddingNew(false); resetForm(); }}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
      >
        <ItemForm />
      </SidePanel>

      {/* Mobile Bottom Sheet */}
      <BottomSheet
        isOpen={isAddingNew && isMobile}
        onClose={() => { setIsAddingNew(false); resetForm(); }}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
      >
        <ItemForm />
      </BottomSheet>

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="p-3">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setIsAddingNew(true)}
              className="px-3 py-1.5 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 text-xs font-medium inline-flex items-center gap-1.5"
            >
              <FiPlus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <FiPackage className="h-12 w-12 mx-auto text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No inventory items</h3>
            <p className="mt-1 text-sm text-gray-500">Add your first item to get started.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            {/* Action bar */}
            <div className="flex justify-end px-4 py-2 border-b border-gray-200">
              <button
                onClick={() => setIsAddingNew(true)}
                className="px-3 py-1.5 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 text-xs font-medium inline-flex items-center gap-1.5"
              >
                <FiPlus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
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
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{item.item_name}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.quantity || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.supplier_name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.date_purchased ? formatDateIST(item.date_purchased) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(item.bill_approval_status)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <FiMoreVertical className="w-5 h-5" />
                      </button>

                      {openMenuId === item.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-4 top-10 z-50 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
                        >
                          {item.bill_url && (
                            <button
                              onClick={() => { setSelectedImage(item.bill_url!); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <FiEye className="w-4 h-4" />
                              View Bill
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(item)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <FiEdit2 className="w-4 h-4" />
                            Edit
                          </button>

                          {user?.role === 'admin' && item.bill_url && item.bill_approval_status === 'pending' && (
                            <>
                              <div className="border-t border-gray-100 my-1"></div>
                              <button
                                onClick={() => handleApprove(item.id)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                              >
                                <FiCheck className="w-4 h-4" />
                                Approve Bill
                              </button>
                              <button
                                onClick={() => handleReject(item.id)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                              >
                                <FiX className="w-4 h-4" />
                                Reject Bill
                              </button>
                            </>
                          )}

                          <div className="border-t border-gray-100 my-1"></div>
                          <button
                            onClick={() => { handleDelete(item.id); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <FiTrash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden">
            <div className="flex justify-end px-4 py-3 border-b border-gray-200">
              <button
                onClick={() => setIsAddingNew(true)}
                className="px-3 py-1.5 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-600 text-xs font-medium inline-flex items-center gap-1.5"
              >
                <FiPlus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {items.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.quantity && `Qty: ${item.quantity}`}
                        {item.supplier_name && ` • ${item.supplier_name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(item.bill_approval_status)}
                      <button
                        onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                        className="p-1 text-gray-400"
                      >
                        <FiMoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {openMenuId === item.id && (
                    <div className="mt-3 p-2 bg-gray-50 rounded-lg space-y-1">
                      {item.bill_url && (
                        <button
                          onClick={() => { setSelectedImage(item.bill_url!); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-white rounded"
                        >
                          <FiEye className="w-4 h-4" /> View Bill
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(item)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-white rounded"
                      >
                        <FiEdit2 className="w-4 h-4" /> Edit
                      </button>
                      {user?.role === 'admin' && item.bill_url && item.bill_approval_status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(item.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 hover:bg-white rounded"
                          >
                            <FiCheck className="w-4 h-4" /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(item.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-white rounded"
                          >
                            <FiX className="w-4 h-4" /> Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-white rounded"
                      >
                        <FiTrash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Image Modal for Bills */}
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
