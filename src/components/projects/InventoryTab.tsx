'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateIST, formatDateTimeReadable } from '@/lib/dateUtils';
import { ImageModal } from '@/components/ui/ImageModal';
import { FiEdit2, FiTrash2, FiEye, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';

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
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingBill, setUploadingBill] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingItem, setRejectingItem] = useState<InventoryItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);
  const [resubmittingItem, setResubmittingItem] = useState<InventoryItem | null>(null);
  const [showResubmitModal, setShowResubmitModal] = useState(false);

  const [form, setForm] = useState({
    item_name: '',
    quantity: '',
    supplier_name: '',
    date_purchased: '',
    bill_url: '',
  });

  useEffect(() => {
    fetchItems();
  }, [projectId]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/inventory-items?project_id=${projectId}`);

      if (!response.ok) {
        console.error('Failed to fetch inventory items');
        return;
      }

      const { items: fetchedItems } = await response.json();
      setItems(fetchedItems || []);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
    } finally {
      setLoading(false);
    }
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
        alert('Failed to upload bill');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('inventory-bills')
        .getPublicUrl(fileName);

      setForm(prev => ({ ...prev, bill_url: publicUrl }));
    } catch (error) {
      console.error('Error uploading bill:', error);
      alert('Failed to upload bill');
    } finally {
      setUploadingBill(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.item_name.trim()) {
      alert('Please enter an item name');
      return;
    }

    // Quantity is now optional, only validate if provided
    if (form.quantity && parseFloat(form.quantity) <= 0) {
      alert('Please enter a valid quantity (greater than 0)');
      return;
    }

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

      console.log('Submitting inventory item:', body);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('API error:', error);
        throw new Error(error.error || 'Failed to save item');
      }

      const { item } = await response.json();

      if (editingItem) {
        setItems(prev => prev.map(i => i.id === item.id ? item : i));
      } else {
        setItems(prev => [item, ...prev]);
      }

      // Refresh items list
      fetchItems();

      setShowForm(false);
      setEditingItem(null);
      resetForm();
    } catch (error: any) {
      console.error('Error saving item:', error);
      alert(error.message || 'Failed to save item');
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
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch(`/api/inventory-items?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      setItems(prev => prev.filter(i => i.id !== id));
      fetchItems(); // Refresh items list
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handleApproveBill = async (itemId: string) => {
    if (!confirm('Are you sure you want to approve this bill?')) return;

    setProcessingApproval(true);
    try {
      const response = await fetch(`/api/inventory-items/${itemId}/approve-bill`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve bill');
      }

      // Update the item in the list
      setItems(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, bill_approval_status: 'approved' }
          : item
      ));

      alert('Bill approved successfully!');
    } catch (error: any) {
      console.error('Error approving bill:', error);
      alert(error.message || 'Failed to approve bill');
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleRejectBill = (item: InventoryItem) => {
    setRejectingItem(item);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const submitRejectBill = async () => {
    if (!rejectingItem) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessingApproval(true);
    try {
      const response = await fetch(`/api/inventory-items/${rejectingItem.id}/reject-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: rejectionReason.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject bill');
      }

      // Update the item in the list with rejection reason
      setItems(prev => prev.map(item =>
        item.id === rejectingItem.id
          ? { ...item, bill_approval_status: 'rejected', bill_rejection_reason: rejectionReason.trim() }
          : item
      ));

      setShowRejectModal(false);
      setRejectingItem(null);
      setRejectionReason('');
      alert('Bill rejected successfully!');

      // Refresh items to get latest data from server
      fetchItems();
    } catch (error: any) {
      console.error('Error rejecting bill:', error);
      alert(error.message || 'Failed to reject bill');
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleResubmitBill = (item: InventoryItem) => {
    setResubmittingItem(item);
    setForm(prev => ({ ...prev, bill_url: '' }));
    setShowResubmitModal(true);
  };

  const submitResubmitBill = async () => {
    if (!resubmittingItem) return;
    if (!form.bill_url) {
      alert('Please upload a new bill');
      return;
    }

    setProcessingApproval(true);
    try {
      const response = await fetch(`/api/inventory-items/${resubmittingItem.id}/resubmit-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bill_url: form.bill_url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resubmit bill');
      }

      // Update the item in the list
      setItems(prev => prev.map(item =>
        item.id === resubmittingItem.id
          ? { ...item, bill_approval_status: 'pending', bill_url: form.bill_url, bill_rejection_reason: null, is_bill_resubmission: true }
          : item
      ));

      setShowResubmitModal(false);
      setResubmittingItem(null);
      setForm(prev => ({ ...prev, bill_url: '' }));
      alert('Bill resubmitted successfully!');
      fetchItems(); // Refresh items list
    } catch (error: any) {
      console.error('Error resubmitting bill:', error);
      alert(error.message || 'Failed to resubmit bill');
    } finally {
      setProcessingApproval(false);
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
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
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
        <div>
          <h3 className="text-base sm:text-lg font-medium leading-6 text-gray-900">Inventory</h3>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold w-full sm:w-auto"
        >
          + Add Item
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{editingItem ? 'Edit Item' : 'New Item'}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={form.item_name}
                  onChange={(e) => setForm(prev => ({ ...prev, item_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder="e.g., Cement, Paint, Tiles"
                />
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder="Optional"
                />
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
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingItem(null);
                  resetForm();
                }}
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
        </div>
      )}

      {/* Inventory Display - Table for desktop, Cards for mobile */}
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No inventory items yet. Add your first item!</p>
      ) : (
        <>
          {/* Desktop Table View - hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.item_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.quantity || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.date_purchased ? formatDateIST(item.date_purchased) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.bill_url ? (
                        <button
                          onClick={() => setSelectedImage(item.bill_url!)}
                          className="p-1.5 text-gray-500 hover:text-yellow-600 transition-colors"
                          title="View Bill"
                        >
                          <FiEye className="w-5 h-5" />
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 text-xs rounded-full inline-block ${item.bill_approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                          item.bill_approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                          {item.bill_approval_status || 'pending'}
                          {item.is_bill_resubmission && ' (Resubmitted)'}
                        </span>
                        {item.bill_approval_status === 'rejected' && item.bill_rejection_reason && (
                          <p className="text-xs text-red-600 mt-1">
                            Reason: {item.bill_rejection_reason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <FiEdit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="w-5 h-5" />
                        </button>

                        {user?.role === 'admin' && item.bill_url && item.bill_approval_status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApproveBill(item.id)}
                              disabled={processingApproval}
                              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                              title="Approve Bill"
                            >
                              <FiCheck className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleRejectBill(item)}
                              disabled={processingApproval}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                              title="Reject Bill"
                            >
                              <FiX className="w-5 h-5" />
                            </button>
                          </>
                        )}

                        {item.bill_approval_status === 'rejected' && item.created_by === user?.id && (
                          <button
                            onClick={() => handleResubmitBill(item)}
                            disabled={processingApproval}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                            title="Resubmit Bill"
                          >
                            <FiRefreshCw className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - hidden on desktop */}
          <div className="md:hidden space-y-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">{item.item_name}</h4>
                    {item.supplier_name && (
                      <p className="text-sm text-gray-500">{item.supplier_name}</p>
                    )}
                  </div>
                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${item.bill_approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                    item.bill_approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                    {item.bill_approval_status === 'approved' ? 'Approved' :
                      item.bill_approval_status === 'rejected' ? 'Rejected' : 'Pending'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Quantity</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{item.quantity ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Date</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {item.date_purchased ? formatDateIST(item.date_purchased) : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-3 border-t border-gray-50">
                  {item.bill_url && (
                    <button
                      onClick={() => setSelectedImage(item.bill_url!)}
                      className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                      title="View Bill"
                    >
                      <FiEye className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                    title="Edit"
                  >
                    <FiEdit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Admin Actions Row if needed */}
                {user?.role === 'admin' && item.bill_url && item.bill_approval_status === 'pending' && (
                  <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleApproveBill(item.id)}
                      disabled={processingApproval}
                      className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                      title="Approve Bill"
                    >
                      <FiCheck className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleRejectBill(item)}
                      disabled={processingApproval}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                      title="Reject Bill"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Rejection/Resubmit States */}
                {item.bill_approval_status === 'rejected' && (
                  <div className="mt-3 bg-red-50 rounded-lg p-3 text-xs">
                    <p className="text-red-800 mb-1"><strong>Rejected:</strong> {item.bill_rejection_reason}</p>
                    {item.created_by === user?.id && (
                      <div className="flex justify-center mt-2">
                        <button
                          onClick={() => handleResubmitBill(item)}
                          disabled={processingApproval}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                          title="Resubmit Bill"
                        >
                          <FiRefreshCw className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )
      }

      {/* Enhanced Image Modal for Bills */}
      <ImageModal
        images={selectedImage ? [selectedImage] : []}
        currentIndex={0}
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
      />

      {/* Rejection Modal */}
      {
        showRejectModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Reject Bill
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Please provide a reason for rejecting this bill. The site supervisor will be notified.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px]"
                autoFocus
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingItem(null);
                    setRejectionReason('');
                  }}
                  disabled={processingApproval}
                  className="flex-1 px-4 py-2 text-sm rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRejectBill}
                  disabled={processingApproval || !rejectionReason.trim()}
                  className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {processingApproval ? 'Rejecting...' : 'Reject Bill'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Resubmit Bill Modal */}
      {
        showResubmitModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Resubmit Bill
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload a new bill to resubmit for approval.
              </p>
              {resubmittingItem?.bill_rejection_reason && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Previous rejection reason:</strong><br />
                    {resubmittingItem.bill_rejection_reason}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload New Bill *
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleBillUpload}
                  disabled={uploadingBill}
                  className="w-full border rounded-md px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {uploadingBill && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}
                {form.bill_url && (
                  <p className="text-xs text-green-600 mt-1">✓ Bill uploaded successfully</p>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowResubmitModal(false);
                    setResubmittingItem(null);
                    setForm(prev => ({ ...prev, bill_url: '' }));
                  }}
                  disabled={processingApproval || uploadingBill}
                  className="flex-1 px-4 py-2 text-sm rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitResubmitBill}
                  disabled={processingApproval || uploadingBill || !form.bill_url}
                  className="flex-1 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {processingApproval ? 'Resubmitting...' : 'Resubmit Bill'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

