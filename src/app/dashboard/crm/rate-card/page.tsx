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

  const addSection = async () => {
    const sectionName = prompt('Enter new Room / Section name (e.g., Home Theatre, Balcony, Guest Bedroom):');
    if (!sectionName || !sectionName.trim()) return;
    const trimmed = sectionName.trim();

    // Check if section already exists
    const existingMatch = sections.find(s => s.toLowerCase() === trimmed.toLowerCase());
    if (existingMatch) {
      alert(`The section "${existingMatch}" already exists.`);
      setSectionFilter(existingMatch);
      return;
    }

    const res = await fetch('/api/rate-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: trimmed, item_name: 'New Item', unit: 'sqft', default_rate: 0, is_lumpsum: false }),
    });
    const data = await res.json();
    if (data.data) {
      setItems(prev => [...prev, data.data]);
      setSectionFilter(trimmed);
    }
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
    <div className="p-3 sm:p-6 w-full space-y-4">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-gray-900">Rate Card Master</h1>
          <p className="text-xs text-gray-500 mt-0.5">Master price list used in quotation builder</p>
        </div>
        {canEdit && (
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <button
              onClick={addSection}
              className="flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-xs active:scale-95"
              title="Add a new Room / Section category to the Rate Card"
            >
              <FiPlus size={14} /> Add Room
            </button>
            <button
              onClick={addItem}
              className="flex items-center justify-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-3 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-xs active:scale-95"
              title="Add a new item to the active room section"
            >
              <FiPlus size={14} /> Add Item
            </button>
          </div>
        )}
      </div>

      {/* Responsive Section filter pills with hidden scrollbars */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 pt-1 items-center snap-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {sections.map(s => (
          <button
            key={s}
            onClick={() => setSectionFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer shrink-0 snap-start ${sectionFilter === s
                ? 'bg-yellow-500 text-white border-yellow-500 shadow-2xs'
                : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-300'
              }`}
          >
            {s}
          </button>
        ))}

        {canEdit && (
          <button
            onClick={addSection}
            className="px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all flex items-center gap-1 shrink-0 snap-start cursor-pointer"
            title="Create a new room / section category"
          >
            <FiPlus size={12} /> Add Room
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12 font-bold text-xs">Loading rate items…</div>
      ) : (
        <>
          {/* Mobile View (< 768px): Fully touch-friendly responsive cards */}
          <div className="block md:hidden space-y-3">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-xs font-bold bg-white rounded-2xl border border-gray-200">
                No items in this section.
              </div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs space-y-3 text-left">
                  {/* Row 1: Section Name + Save / Delete buttons */}
                  <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] uppercase font-black text-amber-600 tracking-wider block">Section</span>
                      {canEdit ? (
                        <input
                          className="w-full bg-amber-50/60 border border-amber-200/80 rounded-lg px-2 py-1 text-xs font-bold text-gray-900 focus:outline-none focus:border-amber-500 mt-0.5"
                          value={item.section}
                          onChange={e => updateLocal(item.id, { section: e.target.value })}
                          onBlur={() => saveItem(item)}
                        />
                      ) : (
                        <p className="text-xs font-bold text-gray-900 mt-0.5">{item.section}</p>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => saveItem(item)}
                          className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200/80 transition-colors"
                          title="Save item"
                          disabled={saving === item.id}
                        >
                          <FiSave size={14} />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200/80 transition-colors"
                          title="Delete item"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Item Description */}
                  <div>
                    <span className="text-[9px] uppercase font-black text-gray-400 block">Item Description</span>
                    {canEdit ? (
                      <input
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-yellow-500 mt-0.5"
                        value={item.item_name}
                        onChange={e => updateLocal(item.id, { item_name: e.target.value })}
                        onBlur={() => saveItem(item)}
                      />
                    ) : (
                      <p className="text-xs font-bold text-gray-900 mt-0.5">{item.item_name}</p>
                    )}
                  </div>

                  {/* Row 3: Unit & Rate */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-gray-100 items-center">
                    <div>
                      <span className="text-[9px] uppercase font-black text-gray-400 block">Unit</span>
                      {canEdit ? (
                        <select
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-800 mt-0.5"
                          value={item.unit}
                          onChange={e => { updateLocal(item.id, { unit: e.target.value }); saveItem({ ...item, unit: e.target.value }); }}
                        >
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-bold text-gray-700 mt-0.5 block">{item.unit}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[9px] uppercase font-black text-gray-400 block">Rate (₹)</span>
                      {canEdit ? (
                        <input
                          type="number"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-black text-gray-900 mt-0.5 text-right"
                          value={item.default_rate}
                          onChange={e => updateLocal(item.id, { default_rate: parseFloat(e.target.value) || 0 })}
                          onBlur={() => saveItem(item)}
                        />
                      ) : (
                        <span className="text-xs font-black text-gray-900 mt-0.5 block">₹{item.default_rate.toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Lumpsum Toggle */}
                  <div className="flex items-center justify-between pt-1 text-xs bg-gray-50/70 p-2 rounded-xl border border-gray-100">
                    <span className="text-[10px] uppercase font-black text-gray-500">Lumpsum (Fixed Price)</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_lumpsum}
                        disabled={!canEdit}
                        onChange={e => { updateLocal(item.id, { is_lumpsum: e.target.checked }); saveItem({ ...item, is_lumpsum: e.target.checked }); }}
                        className="accent-yellow-500 w-4 h-4 rounded cursor-pointer"
                      />
                      <span className="text-[10px] font-bold text-gray-700">{item.is_lumpsum ? 'Yes' : 'No'}</span>
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (≥ 768px) */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs font-black uppercase border-b border-gray-200">
                    <th className="px-4 py-3 text-left">Section</th>
                    <th className="px-4 py-3 text-left">Item Name</th>
                    <th className="px-4 py-3 text-center">Unit</th>
                    <th className="px-4 py-3 text-right">Rate (₹)</th>
                    <th className="px-4 py-3 text-center">LSM?</th>
                    {canEdit && <th className="px-4 py-3 text-center w-24">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-2.5">
                        {canEdit ? (
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-yellow-500 outline-none text-xs font-bold text-gray-700"
                            value={item.section}
                            onChange={e => updateLocal(item.id, { section: e.target.value })}
                            onBlur={() => saveItem(item)}
                          />
                        ) : <span className="text-xs font-bold text-gray-700">{item.section}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {canEdit ? (
                          <input
                            className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-yellow-500 outline-none text-sm font-bold text-gray-900"
                            value={item.item_name}
                            onChange={e => updateLocal(item.id, { item_name: e.target.value })}
                            onBlur={() => saveItem(item)}
                          />
                        ) : <span className="text-sm font-bold text-gray-900">{item.item_name}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {canEdit ? (
                          <select
                            className="bg-gray-50 border border-gray-200 rounded-md px-1.5 py-1 text-xs font-bold"
                            value={item.unit}
                            onChange={e => { updateLocal(item.id, { unit: e.target.value }); saveItem({ ...item, unit: e.target.value }); }}
                          >
                            {UNITS.map(u => <option key={u}>{u}</option>)}
                          </select>
                        ) : <span className="text-xs font-bold text-gray-600">{item.unit}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            className="w-28 text-right bg-transparent border-b border-transparent hover:border-gray-300 focus:border-yellow-500 outline-none font-black text-gray-900 text-sm"
                            value={item.default_rate}
                            onChange={e => updateLocal(item.id, { default_rate: parseFloat(e.target.value) || 0 })}
                            onBlur={() => saveItem(item)}
                          />
                        ) : <span className="font-black text-gray-900 text-sm">₹{item.default_rate.toLocaleString('en-IN')}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={item.is_lumpsum}
                          disabled={!canEdit}
                          onChange={e => { updateLocal(item.id, { is_lumpsum: e.target.checked }); saveItem({ ...item, is_lumpsum: e.target.checked }); }}
                          className="accent-yellow-500 w-4 h-4"
                        />
                      </td>
                      {canEdit && (
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => saveItem(item)}
                              className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors border border-emerald-100"
                              title="Save"
                              disabled={saving === item.id}
                            >
                              <FiSave size={14} />
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors border border-rose-100"
                              title="Remove"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="py-10 text-center text-gray-400 text-sm font-bold">No items in this section.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
