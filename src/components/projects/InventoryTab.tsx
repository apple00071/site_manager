'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateIST, formatDateTimeReadable } from '@/lib/dateUtils';

type InventoryItem = {
  id: string;
  project_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_cost: number;
  supplier_name: string | null;
  date_purchased: string | null;
  bill_url: string | null;
  created_by: string;
  created_at: string;
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
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingBill, setUploadingBill] = useState(false);
  
  const [form, setForm] = useState({
    item_name: '',
    quantity: '',
    unit: 'pieces',
    price_per_unit: '',
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

      const { items: fetchedItems, totalCost: total } = await response.json();
      setItems(fetchedItems || []);
      setTotalCost(total || 0);
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
    if (!form.item_name.trim() || !form.quantity || !form.price_per_unit) {
      alert('Please fill in all required fields');
      return;
    }

    const quantity = parseFloat(form.quantity);
    const price_per_unit = parseFloat(form.price_per_unit);

    if (isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    if (isNaN(price_per_unit) || price_per_unit < 0) {
      alert('Please enter a valid price');
      return;
    }

    setSaving(true);

    try {
      const url = '/api/inventory-items';
      const method = editingItem ? 'PATCH' : 'POST';

      const body: any = {
        project_id: projectId,
        item_name: form.item_name.trim(),
        quantity,
        unit: form.unit,
        price_per_unit,
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

      // Recalculate total
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
      quantity: item.quantity.toString(),
      unit: item.unit,
      price_per_unit: item.price_per_unit.toString(),
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
      fetchItems(); // Recalculate total
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const resetForm = () => {
    setForm({
      item_name: '',
      quantity: '',
      unit: 'pieces',
      price_per_unit: '',
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
          <p className="text-sm text-gray-500 mt-1">Total Cost: <span className="font-bold text-yellow-600">{formatCurrency(totalCost)}</span></p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold w-full sm:w-auto"
        >
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 md:mb-6 p-3 md:p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3">{editingItem ? 'Edit Item' : 'New Item'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Item Name *</label>
              <input
                type="text"
                value={form.item_name}
                onChange={(e) => setForm(prev => ({ ...prev, item_name: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Supplier Name</label>
              <input
                type="text"
                value={form.supplier_name}
                onChange={(e) => setForm(prev => ({ ...prev, supplier_name: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Quantity *</label>
              <input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Unit *</label>
              <select
                value={form.unit}
                onChange={(e) => setForm(prev => ({ ...prev, unit: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              >
                <option value="pieces">Pieces</option>
                <option value="kg">Kilograms</option>
                <option value="meters">Meters</option>
                <option value="liters">Liters</option>
                <option value="boxes">Boxes</option>
                <option value="bags">Bags</option>
                <option value="sqft">Square Feet</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Price per Unit *</label>
              <input
                type="number"
                step="0.01"
                value={form.price_per_unit}
                onChange={(e) => setForm(prev => ({ ...prev, price_per_unit: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date Purchased</label>
              <input
                type="date"
                value={form.date_purchased}
                onChange={(e) => setForm(prev => ({ ...prev, date_purchased: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Bill/Invoice</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleBillUpload}
                disabled={uploadingBill}
                className="w-full border rounded-md px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
              />
              {uploadingBill && <p className="text-xs text-gray-500 mt-1">Uploading...</p>}
              {form.bill_url && (
                <a href={form.bill_url} target="_blank" rel="noopener noreferrer" className="text-xs text-yellow-600 hover:underline mt-1 block">
                  📄 View uploaded bill
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingItem(null);
                resetForm();
              }}
              disabled={saving}
              className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || uploadingBill}
              className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold disabled:opacity-50 w-full sm:w-auto"
            >
              {saving ? 'Saving...' : editingItem ? 'Update' : 'Add Item'}
            </button>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.item_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(item.price_per_unit)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(item.total_cost)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.date_purchased ? formatDateIST(item.date_purchased) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.bill_url ? (
                        <a href={item.bill_url} target="_blank" rel="noopener noreferrer" className="text-yellow-600 hover:underline">
                          View
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-yellow-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - hidden on desktop */}
          <div className="md:hidden space-y-3">
            {items.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-medium text-gray-900">{item.item_name}</h4>
                  <span className="text-sm font-bold text-yellow-600">{formatCurrency(item.total_cost)}</span>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span className="font-medium text-gray-900">{item.quantity} {item.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price/Unit:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(item.price_per_unit)}</span>
                  </div>
                  {item.supplier_name && (
                    <div className="flex justify-between">
                      <span>Supplier:</span>
                      <span className="font-medium text-gray-900">{item.supplier_name}</span>
                    </div>
                  )}
                  {item.date_purchased && (
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span className="font-medium text-gray-900">{formatDateIST(item.date_purchased)}</span>
                    </div>
                  )}
                  {item.bill_url && (
                    <div className="flex justify-between">
                      <span>Bill:</span>
                      <a href={item.bill_url} target="_blank" rel="noopener noreferrer" className="text-yellow-600 hover:underline font-medium">
                        📄 View
                      </a>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex-1 px-3 py-1.5 text-xs bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

