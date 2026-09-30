'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiEdit2,
  FiCheck,
  FiFileText,
  FiLayers,
  FiUser,
  FiCopy,
  FiLoader,
  FiChevronDown,
} from 'react-icons/fi';
import { useUserPermissions } from '@/hooks/useUserPermissions';

export interface RequirementItem {
  id: string;
  project_id: string;
  room_section: string;
  item_name: string;
  dimensions?: string | null;
  designer_specs?: string | null;
  status: 'pending' | 'verified' | 'issue';
  supervisor_notes?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  verifier?: { id: string; full_name?: string; email?: string } | null;
  quotation_item_id?: string | null;
  order_index: number;
}

export interface CrmQuotationInfo {
  lead_id: string;
  ref_no?: number | string | null;
  client_name?: string | null;
  site_project?: string | null;
  quotation_id: string;
  version: number;
  final_amount: number;
  total_items: number;
  material_specs?: any;
}

// Predefined Options for Designer Specifications
const CORE_MATERIAL_OPTIONS = [
  '18mm BWP Ply',
  '18mm BWR Ply',
  '16mm Commercial MR',
  'Action TESA HDHMR',
  '12mm Gyproc Gypsum',
  'WPC Waterproof Board',
];

const FINISH_OPTIONS = [
  '1.0mm Suede Laminate',
  '1.0mm High Gloss',
  '1.5mm Acrylic Finish',
  'Veneer + PU Polish',
  'PU Paint Finish',
  'Fluted Louver Panel',
  'Tinted Glass Profile',
];

const HARDWARE_OPTIONS = [
  'Soft-close Hinges',
  'Telescopic Channels',
  'Slim Tandem Box',
  'Hydraulic Lift Up',
  'Profile Gola Handle',
  '2mm PVC Edgeband',
];

const QUICK_CHIPS = [
  '18mm BWP Ply',
  '1.0mm Suede',
  'High Gloss',
  'Acrylic',
  'Soft-Close',
  'Tandem Box',
  'Laminate Code #',
];

// Helper: Strip pricing / amounts / commercial rates from specifications
const cleanSpecMaterial = (str: string): string => {
  if (!str) return '';
  return str
    // Remove "up to ₹1,600/sheet", "up to ₹1,600", "₹1,600/sheet", "₹1,600", "Rs. 500", etc.
    .replace(/up\s+to\s+₹[\d,]+(?:\/[a-zA-Z]+)?\s*—?\s*/gi, '')
    .replace(/\b(?:up\s+to\s+)?(?:₹|rs\.?|inr)\s*[\d,]+(?:\s*\/\s*[a-zA-Z]+)?(?:\s*extra(?:\s+per\s+[a-zA-Z]+)?)?/gi, '')
    .replace(/1\.0mm\s+thick\s+(Glossy|Matt|Suede)/gi, '1.0mm $1')
    .replace(/small\s*,\s*big/gi, 'Standard')
    .replace(/\s*—\s*—\s*/g, ' — ')
    .replace(/\s*,\s*—/g, ' —')
    .replace(/\s*—\s*,/g, ' —')
    .replace(/,\s*,/g, ',')
    .replace(/\s*,\s*$/g, '')
    .replace(/\s*—\s*$/g, '')
    .replace(/^\s*—\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

interface RequirementTabProps {
  projectId: string;
  projectName?: string;
  activeSubTab?: string;
}

export function RequirementTab({ projectId, projectName, activeSubTab = 'checklist' }: RequirementTabProps) {
  const { hasPermission, isAdmin } = useUserPermissions();
  const canEdit = isAdmin || hasPermission('requirements.edit') || hasPermission('projects.edit');
  const canDelete = isAdmin || hasPermission('requirements.delete') || canEdit;

  const [items, setItems] = useState<RequirementItem[]>([]);
  const [crmQuotation, setCrmQuotation] = useState<CrmQuotationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Notes state
  const [notesContent, setNotesContent] = useState('');
  const [notesTitle, setNotesTitle] = useState('Site Notes');
  const [noteSaveStatus, setNoteSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [copiedNotes, setCopiedNotes] = useState(false);
  const noteSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter state
  const [selectedRoom, setSelectedRoom] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'issue'>('all');

  // New custom item modal/form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoom, setNewRoom] = useState('Living Room');
  const [newItemName, setNewItemName] = useState('');
  const [newDimensions, setNewDimensions] = useState('');
  const [newDesignerSpecs, setNewDesignerSpecs] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Active supervisor remark editing
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');

  // Collapsible room sections state
  const [collapsedRooms, setCollapsedRooms] = useState<Record<string, boolean>>({});

  const toggleRoomCollapse = (room: string) => {
    setCollapsedRooms((prev) => ({
      ...prev,
      [room]: !prev[room],
    }));
  };

  const debounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // 1. Fetch requirements, notes, and CRM quotation
  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/requirements?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to load requirements');
      const data = await res.json();

      const fetchedItems: RequirementItem[] = data.items || [];
      const dirtyItemsToClean: { id: string; designer_specs: string }[] = [];

      const sanitizedItems = fetchedItems.map((it) => {
        if (it.designer_specs && /₹|rs\.?|inr/i.test(it.designer_specs)) {
          const cleaned = cleanSpecMaterial(it.designer_specs);
          if (cleaned !== it.designer_specs) {
            dirtyItemsToClean.push({ id: it.id, designer_specs: cleaned });
            return { ...it, designer_specs: cleaned };
          }
        }
        return it;
      });

      setItems(sanitizedItems);
      setCrmQuotation(data.crmQuotation || null);

      // Persist cleaned specs silently if any had pricing
      if (dirtyItemsToClean.length > 0) {
        fetch(`/api/projects/${projectId}/requirements`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: dirtyItemsToClean }),
        }).catch((e) => console.error('Silent spec sanitize error:', e));
      }

      if (data.notes && data.notes.length > 0) {
        setNotesContent(data.notes[0].content || '');
        setNotesTitle(data.notes[0].title || 'Site Notes');
      }

      // Auto-sync on first open if quotation exists but no items were imported yet
      if (data.crmQuotation && (!data.items || data.items.length === 0)) {
        handleSyncCrm(false);
      }
    } catch (err) {
      console.error('Error fetching requirements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchRequirements();
    }
  }, [projectId]);

  // 2. Sync from CRM Quotation
  const handleSyncCrm = async (showSuccessAlert = true) => {
    try {
      setSyncing(true);
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_crm' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync from CRM');

      if (data.items && data.items.length > 0) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newItems = data.items.filter((it: any) => !existingIds.has(it.id));
          return [...prev, ...newItems];
        });
      }

      if (showSuccessAlert) {
        alert(data.message || 'Quotation items synced successfully!');
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      if (showSuccessAlert) alert(err.message || 'Error syncing from CRM quotation');
    } finally {
      setSyncing(false);
    }
  };

  // 3. Update Designer Specs (Debounced inline)
  const handleDesignerSpecsChange = (itemId: string, newSpecs: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, designer_specs: newSpecs } : it))
    );

    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    setSaveStatus('Saving specs...');
    debounceTimers.current[itemId] = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${projectId}/requirements`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, designer_specs: newSpecs }),
        });
        setSaveStatus('Saved');
        setTimeout(() => setSaveStatus(null), 1500);
      } catch (err) {
        console.error('Failed to save specs:', err);
        setSaveStatus('Failed to save');
      }
    }, 700);
  };

  // Helper: Append a quick chip to specs
  const handleAppendChip = (itemId: string, currentSpecs: string, chipText: string) => {
    let updated = (currentSpecs || '').trim();
    if (!updated) {
      updated = chipText;
    } else if (!updated.toLowerCase().includes(chipText.toLowerCase())) {
      updated = `${updated} • ${chipText}`;
    }
    handleDesignerSpecsChange(itemId, updated);
  };

  // Helper: Set a structured dropdown value
  const handleSelectDropdownSpec = (
    itemId: string,
    currentSpecs: string,
    category: 'Core' | 'Finish' | 'Fittings',
    val: string
  ) => {
    if (!val) return;
    let updated = (currentSpecs || '').trim();
    if (!updated) {
      updated = `${category}: ${val}`;
    } else {
      const catRegex = new RegExp(`${category}:\\s*[^•|]+`, 'i');
      if (catRegex.test(updated)) {
        updated = updated.replace(catRegex, `${category}: ${val}`);
      } else {
        updated = `${updated} • ${category}: ${val}`;
      }
    }
    handleDesignerSpecsChange(itemId, updated);
  };

  // Helper: Auto-fill base specs from CRM Quotation
  const handleAutoFillFromQuote = async () => {
    const rawQuoteSpecs = crmQuotation?.material_specs || {};
    const defaultPly = cleanSpecMaterial(rawQuoteSpecs['Plywood'] || '18mm BWP Ply');
    let defaultOuter = cleanSpecMaterial(rawQuoteSpecs['Outer Laminate'] || '1.0mm Laminate');
    if (!defaultOuter.toLowerCase().includes('laminate')) {
      defaultOuter = `${defaultOuter} Laminate`;
    }
    const defaultInner = cleanSpecMaterial(rawQuoteSpecs['Inner Laminate'] || '0.8mm Fabric Liner');
    const defaultHinges = cleanSpecMaterial(rawQuoteSpecs['Hinges'] || 'Ebco Soft-Close');
    const kitchenPly = cleanSpecMaterial(rawQuoteSpecs['Kitchen Ply'] || '710 Gurjan BWP');
    const kitchenShutters = cleanSpecMaterial(rawQuoteSpecs['Kitchen Shutters'] || '1mm High Gloss');
    const fcBoard = cleanSpecMaterial(rawQuoteSpecs['False Ceiling Board'] || 'Saint Gobain 12mm Gypsum');
    const fcChannels = cleanSpecMaterial(rawQuoteSpecs['FC Channels'] || 'Ultra channels 0.4 & 0.6mm');
    const wiring = cleanSpecMaterial(rawQuoteSpecs['Wiring'] || 'Finolex flexible wiring');

    const itemsToUpdate: { id: string; designer_specs: string }[] = [];

    const updatedItems = items.map((it) => {
      // If item already has specs, clean any pricing/amounts that might have leaked into it!
      if (it.designer_specs && it.designer_specs.trim().length > 0) {
        if (/₹|rs\.?|inr/i.test(it.designer_specs)) {
          const cleaned = cleanSpecMaterial(it.designer_specs);
          if (cleaned !== it.designer_specs) {
            itemsToUpdate.push({ id: it.id, designer_specs: cleaned });
            return { ...it, designer_specs: cleaned };
          }
        }
        return it;
      }

      const roomLower = (it.room_section || '').toLowerCase();
      const nameLower = (it.item_name || '').toLowerCase();
      let specStr = '';

      if (roomLower.includes('false ceiling') || nameLower.includes('false ceiling') || nameLower.includes('cove')) {
        specStr = `Board: ${fcBoard} • Channels: ${fcChannels}`;
      } else if (roomLower.includes('electrical') || nameLower.includes('electrical') || nameLower.includes('wiring')) {
        specStr = `Wiring: ${wiring}`;
      } else if (roomLower.includes('kitchen')) {
        specStr = `Core: ${kitchenPly} • Shutters: ${kitchenShutters} • Hardware: Tandem Baskets`;
      } else {
        specStr = `Core: ${defaultPly} • Finish: ${defaultOuter} • Inside: ${defaultInner} • Hinges: ${defaultHinges}`;
      }

      itemsToUpdate.push({ id: it.id, designer_specs: specStr });
      return { ...it, designer_specs: specStr };
    });

    if (itemsToUpdate.length === 0) {
      alert('All items already have clean designer specifications without pricing.');
      return;
    }

    setItems(updatedItems);
    setSaveStatus(`Updated ${itemsToUpdate.length} items (pricing removed)`);
    setTimeout(() => setSaveStatus(null), 3000);

    try {
      await fetch(`/api/projects/${projectId}/requirements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToUpdate }),
      });
    } catch (err) {
      console.error('Batch save failed', err);
    }
  };

  // 4. Update Site Supervisor Verification Status
  const handleUpdateStatus = async (
    item: RequirementItem,
    newStatus: 'pending' | 'verified' | 'issue',
    notes?: string
  ) => {
    if (!canEdit) return;

    // Optimistic UI update
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              status: newStatus,
              supervisor_notes: notes !== undefined ? notes : it.supervisor_notes,
              verified_at: newStatus === 'verified' ? new Date().toISOString() : null,
            }
          : it
      )
    );

    try {
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          status: newStatus,
          supervisor_notes: notes !== undefined ? notes : item.supervisor_notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setItems((prev) => prev.map((it) => (it.id === item.id ? data.item : it)));
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      fetchRequirements();
    }
  };

  // 5. Add Custom Requirement Item
  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !canEdit || addingItem) return;

    try {
      setAddingItem(true);
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_item',
          room_section: newRoom.trim() || 'General',
          item_name: newItemName.trim(),
          dimensions: newDimensions.trim() || null,
          designer_specs: newDesignerSpecs.trim() || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add item');

      if (data.item) {
        setItems((prev) => [...prev, data.item]);
      }

      setNewItemName('');
      setNewDimensions('');
      setNewDesignerSpecs('');
      setShowAddModal(false);
    } catch (err: any) {
      alert(err.message || 'Error creating item');
    } finally {
      setAddingItem(false);
    }
  };

  // 6. Delete Item
  const handleDeleteItem = async (itemId: string) => {
    if (!canDelete || !confirm('Delete this requirement item?')) return;

    setItems((prev) => prev.filter((it) => it.id !== itemId));

    try {
      await fetch(`/api/projects/${projectId}/requirements?itemId=${itemId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      fetchRequirements();
    }
  };

  // 7. Debounced Notes Save
  const handleNotesChange = (val: string) => {
    setNotesContent(val);
    if (!canEdit) return;

    setNoteSaveStatus('saving');
    if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);

    noteSaveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/requirements`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'note',
            title: notesTitle,
            content: val,
          }),
        });

        if (res.ok) {
          setNoteSaveStatus('saved');
        } else {
          setNoteSaveStatus('unsaved');
        }
      } catch {
        setNoteSaveStatus('unsaved');
      }
    }, 700);
  };

  // Copy notes to clipboard
  const handleCopyNotes = () => {
    navigator.clipboard.writeText(notesContent);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  // Distinct rooms for filtering
  const distinctRooms = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.room_section) set.add(it.room_section);
    });
    return Array.from(set).sort();
  }, [items]);

  // Statistics
  const totalCount = items.length;
  const verifiedCount = items.filter((it) => it.status === 'verified').length;
  const issueCount = items.filter((it) => it.status === 'issue').length;
  const pendingCount = items.filter((it) => it.status === 'pending').length;
  const missingSpecsCount = items.filter((it) => !it.designer_specs || !it.designer_specs.trim()).length;

  // Filtered Items grouped by Room / Section
  const itemsByRoom = useMemo(() => {
    const grouped: { [room: string]: RequirementItem[] } = {};

    items.forEach((item) => {
      if (selectedRoom !== 'All' && item.room_section !== selectedRoom) return;
      if (statusFilter !== 'all' && item.status !== statusFilter) return;

      const room = item.room_section || 'General';
      if (!grouped[room]) grouped[room] = [];
      grouped[room].push(item);
    });

    return grouped;
  }, [items, selectedRoom, statusFilter]);

  if (loading) {
    return (
      <div className="w-full p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-lg w-full" />
        <div className="space-y-3">
          <div className="h-28 bg-gray-100 rounded-xl w-full" />
          <div className="h-28 bg-gray-100 rounded-xl w-full" />
        </div>
      </div>
    );
  }

  // ================= SUB-TAB 2: SITE NOTES =================
  if (activeSubTab === 'notes') {
    return (
      <div className="w-full p-3 sm:p-6 space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          {/* Notes Toolbar */}
          <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200/80 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  noteSaveStatus === 'saved'
                    ? 'text-emerald-600'
                    : noteSaveStatus === 'saving'
                    ? 'text-yellow-600'
                    : 'text-gray-400'
                }`}
              >
                {noteSaveStatus === 'saving' ? (
                  <FiLoader className="animate-spin text-xs" />
                ) : (
                  <FiCheck className="text-xs" />
                )}
                {noteSaveStatus === 'saved' ? 'Saved' : noteSaveStatus === 'saving' ? 'Saving...' : 'Unsaved changes'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-gray-400">
                {notesContent.length} chars • {notesContent.split(/\s+/).filter(Boolean).length} words
              </span>
              <button
                type="button"
                onClick={handleCopyNotes}
                className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium transition cursor-pointer"
                title="Copy notes"
              >
                {copiedNotes ? (
                  <>
                    <FiCheck className="text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <FiCopy />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Notes Textarea */}
          <div className="p-4 sm:p-6">
            <textarea
              rows={18}
              value={notesContent}
              onChange={(e) => handleNotesChange(e.target.value)}
              disabled={!canEdit}
              placeholder="Write client meeting notes, design remarks, material preferences, room dimensions, or site specifications here... (auto-saves as you type)"
              className="w-full p-4 text-xs sm:text-sm leading-relaxed text-gray-800 bg-gray-50/40 hover:bg-gray-50/70 focus:bg-white border border-gray-200/80 rounded-xl outline-none focus:ring-2 focus:ring-yellow-500/40 focus:border-yellow-500 transition resize-y font-sans placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>
    );
  }

  // ================= SUB-TAB 1: CHECKLIST =================
  return (
    <div className="w-full p-3 sm:p-6 space-y-4">
      {/* 1. Sleek Action Bar (NO giant banner card!) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: CRM Quotation Info or Sync */}
        <div className="flex items-center gap-2">
          {crmQuotation && (
            <button
              type="button"
              onClick={() => handleSyncCrm(true)}
              disabled={syncing}
              className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title="Pull latest items from CRM quotation"
            >
              <FiRefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin text-yellow-600' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Quote'}</span>
            </button>
          )}

          {saveStatus && (
            <span className="text-xs font-medium text-emerald-600 animate-pulse ml-1">{saveStatus}</span>
          )}
        </div>

        {/* Right: Add Custom Item */}
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Status Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-2 rounded-xl border transition cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-yellow-50/80 border-yellow-300 ring-1 ring-yellow-400/50'
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="text-[11px] font-medium text-gray-500">All Items</div>
          <div className="text-base font-bold text-gray-900 mt-0.5">{totalCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('verified')}
          className={`px-3 py-2 rounded-xl border transition cursor-pointer ${
            statusFilter === 'verified'
              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400/50'
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="text-[11px] font-medium text-emerald-600">✓ Verified</div>
          <div className="text-base font-bold text-emerald-700 mt-0.5">{verifiedCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('pending')}
          className={`px-3 py-2 rounded-xl border transition cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400/50'
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="text-[11px] font-medium text-amber-600">⏳ Pending</div>
          <div className="text-base font-bold text-amber-700 mt-0.5">{pendingCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('issue')}
          className={`px-3 py-2 rounded-xl border transition cursor-pointer ${
            statusFilter === 'issue'
              ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-400/50'
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="text-[11px] font-medium text-rose-600">⚠️ Issues</div>
          <div className="text-base font-bold text-rose-700 mt-0.5">{issueCount}</div>
        </div>
      </div>

      {/* 3. Designer Attention Notice (only if specs missing) */}
      {missingSpecsCount > 0 && (
        <div className="p-2.5 bg-amber-50/80 border border-amber-200/90 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="text-amber-600 w-4 h-4 flex-shrink-0" />
            <span>
              <strong>Designer attention:</strong> {missingSpecsCount} items need execution specs (laminate codes, finishes) before site execution.
            </span>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={handleAutoFillFromQuote}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ml-auto"
              title="Automatically pre-populate base specs from the CRM quotation into empty items"
            >
              <span>⚡ Auto-fill Base Specs from Quote</span>
            </button>
          )}
        </div>
      )}

      {/* 4. Room / Section Filter Chips */}
      {distinctRooms.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedRoom('All')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedRoom === 'All'
                ? 'bg-yellow-500 text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            All ({totalCount})
          </button>

          {distinctRooms.map((room) => {
            const count = items.filter((it) => it.room_section === room).length;
            const isSelected = selectedRoom === room;
            return (
              <button
                key={room}
                type="button"
                onClick={() => setSelectedRoom(room)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-yellow-500 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {room} ({count})
              </button>
            );
          })}

          {distinctRooms.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const rooms = Object.keys(itemsByRoom);
                const allCollapsed = rooms.length > 0 && rooms.every((r) => !!collapsedRooms[r]);
                const next: Record<string, boolean> = {};
                rooms.forEach((r) => {
                  next[r] = !allCollapsed;
                });
                setCollapsedRooms(next);
              }}
              className="ml-auto text-xs font-semibold text-gray-500 hover:text-gray-800 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition cursor-pointer whitespace-nowrap"
            >
              {Object.keys(itemsByRoom).length > 0 &&
              Object.keys(itemsByRoom).every((r) => !!collapsedRooms[r])
                ? 'Expand All'
                : 'Collapse All'}
            </button>
          )}
        </div>
      )}

      {/* 5. Room-by-Room Requirements & Verification Cards */}
      {Object.keys(itemsByRoom).length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto text-xl">
            <FiFileText />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 text-sm">No items found</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {crmQuotation
                ? 'Click "Sync Quote" above to pull all scope items from your CRM quotation.'
                : 'Click "Add Item" above to add room specifications for site verification.'}
            </p>
          </div>
          {crmQuotation && (
            <button
              type="button"
              onClick={() => handleSyncCrm(true)}
              className="px-3.5 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition"
            >
              <FiRefreshCw />
              <span>Import {crmQuotation.total_items} Items from CRM Quotation</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {Object.entries(itemsByRoom).map(([room, roomItems]) => {
            const roomVerified = roomItems.filter((i) => i.status === 'verified').length;
            const isCollapsed = !!collapsedRooms[room];

            return (
              <div
                key={room}
                className="bg-white border border-gray-200/90 rounded-xl shadow-xs overflow-hidden"
              >
                {/* Room Section Header (Collapsible) */}
                <button
                  type="button"
                  onClick={() => toggleRoomCollapse(room)}
                  className="w-full px-4 py-2.5 bg-gray-50/70 hover:bg-gray-100/70 border-b border-gray-200/80 flex items-center justify-between text-left transition cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <FiChevronDown
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                        isCollapsed ? '-rotate-90' : 'rotate-0'
                      }`}
                    />
                    <FiLayers className="text-yellow-600 w-4 h-4" />
                    <h3 className="font-bold text-sm text-gray-900">{room}</h3>
                    <span className="text-[11px] font-semibold text-gray-500 bg-gray-200/70 px-2 py-0.5 rounded-full">
                      {roomItems.length}
                    </span>
                  </div>

                  <span className="text-xs font-medium text-gray-600">
                    <strong className="text-emerald-600">{roomVerified}</strong> of {roomItems.length} Verified
                  </span>
                </button>

                {/* Items in Room */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                  {roomItems.map((item) => {
                    const isVerified = item.status === 'verified';
                    const isIssue = item.status === 'issue';
                    const isEditingRemark = editingRemarkId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-start justify-between gap-3.5 transition ${
                          isVerified ? 'bg-emerald-50/20' : isIssue ? 'bg-rose-50/30' : 'bg-white'
                        }`}
                      >
                        {/* 1. Item Name & Dimensions */}
                        <div className="lg:w-1/3 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs sm:text-sm font-bold ${
                                isVerified ? 'text-gray-700' : 'text-gray-900'
                              }`}
                            >
                              {item.item_name}
                            </span>
                            {item.quotation_item_id && (
                              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200/70 px-1.5 py-0.2 rounded font-medium">
                                Quoted
                              </span>
                            )}
                          </div>

                          {item.dimensions && (
                            <div className="text-xs text-gray-500 font-mono">
                              📐 {item.dimensions}
                            </div>
                          )}

                          {item.supervisor_notes && (
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-900 mt-1.5">
                              <span className="font-bold block text-[10px] uppercase text-yellow-700 tracking-wider">
                                Site Supervisor Remark:
                              </span>
                              {item.supervisor_notes}
                            </div>
                          )}
                        </div>

                        {/* 2. Designer Specifications (Predefined Options + Quick Chips + Editable) */}
                        <div className="lg:w-1/3 min-w-0 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                            <span>Designer Specs & Materials</span>
                            {(!item.designer_specs || !item.designer_specs.trim()) ? (
                              <span className="text-amber-600 font-bold lowercase">
                                ⚠️ empty
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold lowercase">
                                ✓ specified
                              </span>
                            )}
                          </div>

                          {/* Quick Dropdown Selectors */}
                          {canEdit && (
                            <div className="grid grid-cols-3 gap-1">
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  handleSelectDropdownSpec(item.id, item.designer_specs || '', 'Core', e.target.value);
                                  e.target.value = '';
                                }}
                                className="text-[10px] py-1 px-1 bg-gray-50 border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-yellow-500 cursor-pointer truncate"
                                title="Pick core plywood/board"
                              >
                                <option value="" disabled>Core Ply ▼</option>
                                {CORE_MATERIAL_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>

                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  handleSelectDropdownSpec(item.id, item.designer_specs || '', 'Finish', e.target.value);
                                  e.target.value = '';
                                }}
                                className="text-[10px] py-1 px-1 bg-gray-50 border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-yellow-500 cursor-pointer truncate"
                                title="Pick outer finish"
                              >
                                <option value="" disabled>Finish ▼</option>
                                {FINISH_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>

                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  handleSelectDropdownSpec(item.id, item.designer_specs || '', 'Fittings', e.target.value);
                                  e.target.value = '';
                                }}
                                className="text-[10px] py-1 px-1 bg-gray-50 border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-yellow-500 cursor-pointer truncate"
                                title="Pick hardware/fitting"
                              >
                                <option value="" disabled>Hardware ▼</option>
                                {HARDWARE_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          <textarea
                            rows={2}
                            value={item.designer_specs || ''}
                            onChange={(e) => handleDesignerSpecsChange(item.id, e.target.value)}
                            disabled={!canEdit}
                            placeholder="Enter laminate code, finish, plywood grade, hardware, or notes..."
                            className="w-full text-xs p-2 bg-gray-50/60 hover:bg-gray-50 focus:bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 transition resize-y placeholder:text-gray-400 text-gray-800"
                          />

                          {/* Quick Spec Chips */}
                          {canEdit && (
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              {QUICK_CHIPS.map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => handleAppendChip(item.id, item.designer_specs || '', chip)}
                                  className="px-1.5 py-0.5 bg-gray-100 hover:bg-yellow-100 hover:text-yellow-800 text-[10px] font-medium text-gray-600 rounded transition cursor-pointer"
                                  title={`Append "${chip}"`}
                                >
                                  + {chip}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. Site Supervisor Verification Actions */}
                        <div className="lg:w-1/3 flex flex-col items-start lg:items-end justify-between space-y-1.5 flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            {/* Verified Button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateStatus(item, isVerified ? 'pending' : 'verified')
                              }
                              disabled={!canEdit}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                                isVerified
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                              }`}
                            >
                              <FiCheck className="w-3.5 h-3.5" />
                              <span>{isVerified ? 'Verified on Site' : 'Mark Verified'}</span>
                            </button>

                            {/* Issue Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isIssue) {
                                  handleUpdateStatus(item, 'pending');
                                } else {
                                  setEditingRemarkId(item.id);
                                  setRemarkText(item.supervisor_notes || '');
                                }
                              }}
                              disabled={!canEdit}
                              className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1 ${
                                isIssue
                                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                              title="Flag mismatch or issue on site"
                            >
                              <FiAlertTriangle className="w-3.5 h-3.5" />
                              <span>{isIssue ? 'Issue Flagged' : 'Flag Issue'}</span>
                            </button>

                            {/* Delete Item */}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 rounded transition cursor-pointer"
                                title="Remove item"
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Verification Timestamp */}
                          {isVerified && item.verified_at && (
                            <div className="text-[11px] text-emerald-700 flex items-center gap-1">
                              <FiCheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>
                                Verified {new Date(item.verified_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                                {item.verifier?.full_name ? `by ${item.verifier.full_name}` : ''}
                              </span>
                            </div>
                          )}

                          {/* Inline Remark Box for Site Supervisor */}
                          {isEditingRemark && (
                            <div className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-lg space-y-2 mt-2">
                              <span className="text-[11px] font-bold text-rose-800 block">
                                Report Site Mismatch / Note:
                              </span>
                              <textarea
                                rows={2}
                                value={remarkText}
                                onChange={(e) => setRemarkText(e.target.value)}
                                placeholder="Describe the site issue or mistake (e.g., electrical point not at 4ft, wrong laminate code)..."
                                className="w-full text-xs p-2 bg-white border border-rose-300 rounded focus:outline-none"
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingRemarkId(null)}
                                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateStatus(item, 'issue', remarkText);
                                    setEditingRemarkId(null);
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white rounded hover:bg-rose-700"
                                >
                                  Save & Flag Issue
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Modal: Add Custom Item */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-gray-900">Add Requirement Item</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Room / Section
                </label>
                <input
                  type="text"
                  required
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  placeholder="e.g. Living Room, Modular Kitchen, Master Bedroom, Balcony"
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Shoe Rack with Cushion, TV Unit Paneling, Study Table"
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Dimensions (optional)
                </label>
                <input
                  type="text"
                  value={newDimensions}
                  onChange={(e) => setNewDimensions(e.target.value)}
                  placeholder="e.g. 6.0ft × 4.0ft • 24 sqft"
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Designer Specifications (optional)
                </label>
                <textarea
                  rows={3}
                  value={newDesignerSpecs}
                  onChange={(e) => setNewDesignerSpecs(e.target.value)}
                  placeholder="e.g. Century BWR ply, Merino suede laminate, soft-close hydraulic hinges..."
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingItem || !newItemName.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {addingItem ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
