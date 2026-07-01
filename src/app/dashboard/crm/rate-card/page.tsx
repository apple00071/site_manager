'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { FiPlus, FiTrash2, FiSave, FiAlertTriangle } from 'react-icons/fi';

interface RateItem {
  id: string;
  section: string;
  item_name: string;
  unit: string;
  default_rate: number;
  is_lumpsum: boolean;
  sort_order: number;
  is_active: boolean;
}

const UNITS = ['sqft', 'rft', 'nos', 'lumpsum'];

export default function RateCardPage() {
  const { hasPermission } = useUserPermissions();
  const [items, setItems] = useState<RateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState('all');

  const canEdit = hasPermission('crm.manage');

  useEffect(() => {
    fetch('/api/rate-card')
      .then(r => r.json())
      .then(d => { setItems(d.data || []); setLoading(false); });
  }, []);

  const sections = useMemo(() => ['all', ...Array.from(new Set(items.map(i => i.section)))], [items]);
  const filtered = sectionFilter === 'all' ? items : items.filter(i => i.section === sectionFilter);

  const updateLocal = (id: string, patch: Partial<RateItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const saveItem = async (item: RateItem) => {
    setSaving(item.id);
    await fetch('/api/rate-card', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    setSaving(null);
  };

  const deleteItem = async (id: string) => {
    if (!confirm('Deactivate this item?')) return;
    await fetch(`/api/rate-card?id=${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const addItem = async () => {
    const section = sectionFilter === 'all' ? 'Drawing Room' : sectionFilter;
    const res = await fetch('/api/rate-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, item_name: 'New Item', unit: 'sqft', default_rate: 0, is_lumpsum: false }),
    });
    const data = await res.json();
    if (data.data) setItems(prev => [...prev, data.data]);
  };

  if (!hasPermission('crm.view')) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[50vh]">
        <FiAlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-lg font-bold">Access Denied</h2>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Rate Card</h1>
          <p className="text-xs text-gray-500 mt-0.5">Master price list used in quotation builder</p>
        </div>
        {canEdit && (
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <FiPlus size={14} /> Add Item
          </button>
        )}
      </div>

      {/* Section filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        {sections.map(s => (
          <button
            key={s}
            onClick={() => setSectionFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
              sectionFilter === s
                ? 'bg-yellow-500 text-white border-yellow-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-black uppercase border-b border-gray-200">
                <th className="px-4 py-2.5 text-left">Section</th>
                <th className="px-4 py-2.5 text-left">Item Name</th>
                <th className="px-4 py-2.5 text-center">Unit</th>
                <th className="px-4 py-2.5 text-right">Rate (₹)</th>
                <th className="px-4 py-2.5 text-center">LSM?</th>
                {canEdit && <th className="px-4 py-2.5 text-center w-20">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2">
                    {canEdit ? (
                      <input
                        className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-yellow-500 outline-none text-xs font-medium"
                        value={item.section}
                        onChange={e => updateLocal(item.id, { section: e.target.value })}
                        onBlur={() => saveItem(item)}
                      />
                    ) : <span className="text-xs font-medium text-gray-600">{item.section}</span>}
                  </td>
                  <td className="px-4 py-2">
                    {canEdit ? (
                      <input
                        className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-yellow-500 outline-none text-sm"
                        value={item.item_name}
                        onChange={e => updateLocal(item.id, { item_name: e.target.value })}
                        onBlur={() => saveItem(item)}
                      />
                    ) : <span className="text-sm text-gray-800">{item.item_name}</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {canEdit ? (
                      <select
                        className="bg-transparent border border-gray-200 rounded px-1 py-0.5 text-xs"
                        value={item.unit}
                        onChange={e => { updateLocal(item.id, { unit: e.target.value }); saveItem({ ...item, unit: e.target.value }); }}
                      >
                        {UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    ) : <span className="text-xs text-gray-500">{item.unit}</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canEdit ? (
                      <input
                        type="number"
                        className="w-28 text-right bg-transparent border-b border-transparent hover:border-gray-300 focus:border-yellow-500 outline-none font-bold text-gray-800"
                        value={item.default_rate}
                        onChange={e => updateLocal(item.id, { default_rate: parseFloat(e.target.value) || 0 })}
                        onBlur={() => saveItem(item)}
                      />
                    ) : <span className="font-bold text-gray-800">₹{item.default_rate.toLocaleString('en-IN')}</span>}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={item.is_lumpsum}
                      disabled={!canEdit}
                      onChange={e => { updateLocal(item.id, { is_lumpsum: e.target.checked }); saveItem({ ...item, is_lumpsum: e.target.checked }); }}
                      className="accent-yellow-500"
                    />
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => saveItem(item)}
                          className="text-green-600 hover:bg-green-50 p-1 rounded"
                          title="Save"
                          disabled={saving === item.id}
                        >
                          <FiSave size={13} />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-red-400 hover:bg-red-50 p-1 rounded"
                          title="Remove"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-10 text-center text-gray-400 text-sm">No items in this section.</div>
          )}
        </div>
      )}
    </div>
  );
}
