'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { FiX, FiPlus, FiTrash2, FiPrinter, FiSave, FiChevronDown, FiChevronUp } from 'react-icons/fi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RateCardItem {
  id: string;
  section: string;
  item_name: string;
  unit: string;
  default_rate: number;
  is_lumpsum: boolean;
  sort_order: number;
}

interface QuotationItem {
  _key: string; // local key for React
  section: string;
  item_name: string;
  is_lumpsum: boolean;
  length_ft: string;
  width_ft: string;
  area_sqft: number;
  unit: string;
  rate: number;
  amount: number;
}

interface Lead {
  id: string;
  ref_no: string;
  client_name: string;
  phone: string;
  site_project: string;
  quote_value: number;
  latest_quotation_id?: string;
  quote_version?: number;
}

interface Props {
  lead: Lead;
  onClose: () => void;
  onSaved: (newQuoteValue: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN');

function computeAmount(item: QuotationItem): number {
  if (item.is_lumpsum) return item.rate;
  return item.area_sqft * item.rate;
}

let _keyCounter = 0;
const newKey = () => `item_${++_keyCounter}_${Date.now()}`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function QuotationBuilder({ lead, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<'sections' | 'items' | 'summary'>('sections');
  const [rateCard, setRateCard] = useState<RateCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingQuotation, setExistingQuotation] = useState<any>(null);

  // Selected sections (ordered list matters for display)
  const allSections = useMemo(() => {
    const seen = new Set<string>();
    rateCard.forEach(r => seen.add(r.section));
    return Array.from(seen);
  }, [rateCard]);

  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Summary / discount
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'flat'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [notes, setNotes] = useState('');

  // ── Load rate card + existing quotation ──────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [rcRes, qRes] = await Promise.all([
        fetch('/api/rate-card'),
        fetch(`/api/quotations?lead_id=${lead.id}`),
      ]);
      const rcData = await rcRes.json();
      const qData = await qRes.json();

      setRateCard(rcData.data || []);

      const quotations: any[] = qData.data || [];
      if (quotations.length > 0) {
        const latest = quotations[0]; // ordered by version desc
        setExistingQuotation(latest);
        setDiscountType(latest.discount_type || 'none');
        setDiscountValue(latest.discount_value ? String(latest.discount_value) : '');
        setNotes(latest.notes || '');

        // Rebuild items from saved quotation
        const savedItems: QuotationItem[] = (latest.quotation_items || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((i: any) => ({
            _key: newKey(),
            section: i.section,
            item_name: i.item_name,
            is_lumpsum: i.is_lumpsum,
            length_ft: i.length_ft != null ? String(i.length_ft) : '',
            width_ft: i.width_ft != null ? String(i.width_ft) : '',
            area_sqft: i.area_sqft,
            unit: i.unit,
            rate: i.rate,
            amount: i.amount,
          }));

        const usedSections = [...new Set(savedItems.map(i => i.section))];
        setSelectedSections(usedSections);
        setItems(savedItems);
      }
      setLoading(false);
    }
    load();
  }, [lead.id]);

  // ── Toggle section ────────────────────────────────────────────────────────
  const toggleSection = useCallback((section: string) => {
    setSelectedSections(prev => {
      if (prev.includes(section)) {
        // Remove section and its items
        setItems(cur => cur.filter(i => i.section !== section));
        return prev.filter(s => s !== section);
      } else {
        // Add section with default items from rate card
        const defaults = rateCard
          .filter(r => r.section === section)
          .map(r => ({
            _key: newKey(),
            section: r.section,
            item_name: r.item_name,
            is_lumpsum: r.is_lumpsum,
            length_ft: '',
            width_ft: '',
            area_sqft: r.is_lumpsum ? 1 : 0,
            unit: r.unit,
            rate: r.default_rate,
            amount: r.is_lumpsum ? r.default_rate : 0,
          }));
        setItems(cur => [...cur, ...defaults]);
        return [...prev, section];
      }
    });
  }, [rateCard]);

  // ── Item mutations ────────────────────────────────────────────────────────
  const updateItem = useCallback((key: string, patch: Partial<QuotationItem>) => {
    setItems(cur => cur.map(item => {
      if (item._key !== key) return item;
      const updated = { ...item, ...patch };
      // Recompute area and amount
      if (!updated.is_lumpsum) {
        const l = parseFloat(updated.length_ft) || 0;
        const w = parseFloat(updated.width_ft) || 0;
        updated.area_sqft = parseFloat((l * w).toFixed(2));
      } else {
        updated.area_sqft = 1;
      }
      updated.amount = computeAmount(updated);
      return updated;
    }));
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems(cur => cur.filter(i => i._key !== key));
  }, []);

  const addCustomItem = useCallback((section: string) => {
    setItems(cur => [...cur, {
      _key: newKey(),
      section,
      item_name: '',
      is_lumpsum: false,
      length_ft: '',
      width_ft: '',
      area_sqft: 0,
      unit: 'sqft',
      rate: 0,
      amount: 0,
    }]);
  }, []);

  // ── Computed totals ───────────────────────────────────────────────────────
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);

  const discountAmount = useMemo(() => {
    const v = parseFloat(discountValue) || 0;
    if (discountType === 'percent') return (subtotal * v) / 100;
    if (discountType === 'flat') return v;
    return 0;
  }, [subtotal, discountType, discountValue]);

  const finalAmount = Math.max(0, subtotal - discountAmount);

  const sectionTotals = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(i => { map[i.section] = (map[i.section] || 0) + i.amount; });
    return map;
  }, [items]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (items.length === 0) return alert('Add at least one item.');
    setSaving(true);
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          items: items.map(({ _key, ...rest }) => rest),
          discount_type: discountType,
          discount_value: parseFloat(discountValue) || 0,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSaved(finalAmount);
      // Open print in new tab
      window.open(`/quotations/${data.data.id}/print`, '_blank');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.loadingCenter}>Loading rate card…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.headerTitle}>Quotation Builder</div>
            <div style={styles.headerSub}>
              {lead.client_name} · {lead.ref_no}
              {existingQuotation && <span style={styles.versionBadge}>v{existingQuotation.version} (revising)</span>}
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><FiX size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {(['sections', 'items', 'summary'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'items' && items.length > 0 && <span style={styles.tabBadge}>{items.length}</span>}
              {t === 'summary' && subtotal > 0 && <span style={styles.tabBadge}>{fmt(finalAmount)}</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={styles.body}>

          {/* ── SECTIONS TAB ── */}
          {tab === 'sections' && (
            <div style={styles.sectionGrid}>
              {allSections.map(section => {
                const selected = selectedSections.includes(section);
                return (
                  <button
                    key={section}
                    onClick={() => toggleSection(section)}
                    style={{ ...styles.sectionCard, ...(selected ? styles.sectionCardActive : {}) }}
                  >
                    <span style={styles.sectionCheck}>{selected ? '✓' : '+'}</span>
                    <span style={styles.sectionLabel}>{section}</span>
                    {selected && sectionTotals[section] > 0 && (
                      <span style={styles.sectionTotal}>{fmt(sectionTotals[section])}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── ITEMS TAB ── */}
          {tab === 'items' && (
            <div>
              {selectedSections.length === 0 && (
                <div style={styles.emptyHint}>← Select sections first</div>
              )}
              {selectedSections.map(section => {
                const sectionItems = items.filter(i => i.section === section);
                const collapsed = collapsedSections[section];
                return (
                  <div key={section} style={styles.sectionBlock}>
                    <div style={styles.sectionHeader} onClick={() => setCollapsedSections(p => ({ ...p, [section]: !p[section] }))}>
                      <span style={styles.sectionHeaderName}>{section}</span>
                      <span style={styles.sectionHeaderTotal}>{fmt(sectionTotals[section] || 0)}</span>
                      {collapsed ? <FiChevronDown size={14} /> : <FiChevronUp size={14} />}
                    </div>
                    {!collapsed && (
                      <>
                        {/* Column headers */}
                        <div style={styles.itemRow}>
                          <div style={{ ...styles.col, ...styles.colDesc, fontWeight: 600, fontSize: '11px', color: '#888' }}>Description</div>
                          <div style={{ ...styles.col, ...styles.colLW, fontWeight: 600, fontSize: '11px', color: '#888', textAlign: 'center' }}>L (ft)</div>
                          <div style={{ ...styles.col, ...styles.colLW, fontWeight: 600, fontSize: '11px', color: '#888', textAlign: 'center' }}>W (ft)</div>
                          <div style={{ ...styles.col, ...styles.colArea, fontWeight: 600, fontSize: '11px', color: '#888', textAlign: 'center' }}>Area</div>
                          <div style={{ ...styles.col, ...styles.colRate, fontWeight: 600, fontSize: '11px', color: '#888', textAlign: 'right' }}>Rate ₹</div>
                          <div style={{ ...styles.col, ...styles.colAmt, fontWeight: 600, fontSize: '11px', color: '#888', textAlign: 'right' }}>Amount ₹</div>
                          <div style={{ width: '28px' }} />
                        </div>

                        {sectionItems.map((item, idx) => (
                          <div key={item._key} style={{ ...styles.itemRow, background: idx % 2 === 0 ? '#fff' : '#fafaf7' }}>
                            {/* Description */}
                            <div style={{ ...styles.col, ...styles.colDesc }}>
                              <input
                                style={styles.input}
                                value={item.item_name}
                                placeholder="Item name"
                                onChange={e => updateItem(item._key, { item_name: e.target.value })}
                              />
                            </div>
                            {/* L */}
                            <div style={{ ...styles.col, ...styles.colLW }}>
                              {item.is_lumpsum
                                ? <span style={styles.dash}>—</span>
                                : <input style={{ ...styles.input, textAlign: 'center' }} value={item.length_ft} placeholder="0" onChange={e => updateItem(item._key, { length_ft: e.target.value })} />
                              }
                            </div>
                            {/* W */}
                            <div style={{ ...styles.col, ...styles.colLW }}>
                              {item.is_lumpsum
                                ? <span style={styles.dash}>—</span>
                                : <input style={{ ...styles.input, textAlign: 'center' }} value={item.width_ft} placeholder="0" onChange={e => updateItem(item._key, { width_ft: e.target.value })} />
                              }
                            </div>
                            {/* Area */}
                            <div style={{ ...styles.col, ...styles.colArea, textAlign: 'center', fontSize: '12px', color: item.is_lumpsum ? '#aaa' : '#333' }}>
                              {item.is_lumpsum ? <span style={styles.lsmTag}>LSM</span> : item.area_sqft}
                            </div>
                            {/* Rate */}
                            <div style={{ ...styles.col, ...styles.colRate }}>
                              <input
                                style={{ ...styles.input, textAlign: 'right' }}
                                value={item.rate}
                                type="number"
                                onChange={e => updateItem(item._key, { rate: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                            {/* Amount */}
                            <div style={{ ...styles.col, ...styles.colAmt, textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#2b2b2b' }}>
                              {fmt(item.amount)}
                            </div>
                            {/* Delete */}
                            <button onClick={() => removeItem(item._key)} style={styles.deleteBtn} title="Remove">
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                        ))}

                        {/* Add custom item */}
                        <button onClick={() => addCustomItem(section)} style={styles.addItemBtn}>
                          <FiPlus size={12} /> Add item
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SUMMARY TAB ── */}
          {tab === 'summary' && (
            <div>
              {/* Section breakdown */}
              <table style={styles.summaryTable}>
                <tbody>
                  {selectedSections.map(section => (
                    <tr key={section}>
                      <td style={styles.summaryLabel}>{section}</td>
                      <td style={styles.summaryValue}>{fmt(sectionTotals[section] || 0)}</td>
                    </tr>
                  ))}
                  <tr style={styles.summaryDivider}>
                    <td colSpan={2} />
                  </tr>
                  <tr>
                    <td style={{ ...styles.summaryLabel, fontWeight: 700, fontSize: '14px' }}>Subtotal (Ex. GST)</td>
                    <td style={{ ...styles.summaryValue, fontWeight: 700, fontSize: '14px' }}>{fmt(subtotal)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Discount */}
              <div style={styles.discountBlock}>
                <div style={styles.discountTitle}>Discount</div>
                <div style={styles.discountRow}>
                  <select
                    style={styles.discountSelect}
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value as any)}
                  >
                    <option value="none">No discount</option>
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat amount (₹)</option>
                  </select>
                  {discountType !== 'none' && (
                    <input
                      style={styles.discountInput}
                      type="number"
                      placeholder={discountType === 'percent' ? 'e.g. 5' : 'e.g. 20000'}
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                    />
                  )}
                  {discountType !== 'none' && discountAmount > 0 && (
                    <span style={styles.discountAmt}>− {fmt(discountAmount)}</span>
                  )}
                </div>
              </div>

              {/* Final */}
              <div style={styles.finalBlock}>
                <span style={styles.finalLabel}>Grand Total (Ex. GST)</span>
                <span style={styles.finalAmount}>{fmt(finalAmount)}</span>
              </div>

              {/* Payment schedule preview */}
              <div style={styles.paymentBlock}>
                <div style={styles.paymentTitle}>Payment Schedule</div>
                {[
                  { stage: 'Stage 1', label: 'Token Advance', pct: 10 },
                  { stage: 'Stage 2', label: 'Before Start of Work', pct: 40 },
                  { stage: 'Stage 3', label: 'Completion of Boxes & Inside Laminate', pct: 30 },
                  { stage: 'Stage 4', label: 'Completion of Outside Laminate', pct: 15 },
                  { stage: 'Stage 5', label: 'At Handover', pct: 5 },
                ].map(({ stage, label, pct }) => (
                  <div key={stage} style={styles.paymentRow}>
                    <span style={styles.paymentStage}>{stage}</span>
                    <span style={styles.paymentLabel}>{label}</span>
                    <span style={styles.paymentPct}>{pct}%</span>
                    <span style={styles.paymentAmt}>{fmt((finalAmount * pct) / 100)}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div style={{ marginTop: '16px' }}>
                <label style={styles.notesLabel}>Notes (internal)</label>
                <textarea
                  style={styles.notesArea}
                  rows={3}
                  value={notes}
                  placeholder="Any notes for this quotation…"
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={styles.footer}>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {items.length} items · {fmt(subtotal)}
            {discountAmount > 0 && ` − ${fmt(discountAmount)} disc`}
            {discountAmount > 0 && ` = ${fmt(finalAmount)}`}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {existingQuotation && (
              <button
                style={styles.printBtn}
                onClick={() => window.open(`/quotations/${existingQuotation.id}/print`, '_blank')}
              >
                <FiPrinter size={14} /> Print current
              </button>
            )}
            <button
              style={{ ...styles.saveBtn, opacity: saving ? 0.7 : 1 }}
              onClick={handleSave}
              disabled={saving}
            >
              <FiSave size={14} /> {saving ? 'Saving…' : existingQuotation ? 'Save New Version' : 'Save & Print'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline styles (matches app dark/gold theme) ─────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '16px',
  },
  modal: {
    background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '900px',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: '#2b2b2b', padding: '14px 18px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { color: '#f5c518', fontWeight: 700, fontSize: '16px' },
  headerSub: { color: '#bbb', fontSize: '12px', marginTop: '2px' },
  versionBadge: {
    marginLeft: '8px', background: '#f5c518', color: '#2b2b2b',
    borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 700,
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#ccc', cursor: 'pointer',
    display: 'flex', alignItems: 'center', padding: '4px',
  },
  tabs: { display: 'flex', borderBottom: '2px solid #f0f0f0', background: '#fafafa' },
  tab: {
    padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '13px', color: '#666', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px',
  },
  tabActive: { color: '#2b2b2b', fontWeight: 700, borderBottom: '2px solid #f5c518', marginBottom: '-2px' },
  tabBadge: {
    background: '#f5c518', color: '#2b2b2b', borderRadius: '10px',
    padding: '1px 6px', fontSize: '10px', fontWeight: 700,
  },
  body: { flex: 1, overflowY: 'auto', padding: '16px' },
  loadingCenter: { textAlign: 'center', padding: '40px', color: '#888' },

  // Sections grid
  sectionGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px',
  },
  sectionCard: {
    border: '1.5px solid #e0e0e0', borderRadius: '8px', padding: '12px 10px',
    background: '#fff', cursor: 'pointer', textAlign: 'left', display: 'flex',
    flexDirection: 'column', gap: '4px', transition: 'all 0.15s',
  },
  sectionCardActive: {
    border: '1.5px solid #f5c518', background: '#fffbea',
  },
  sectionCheck: { fontSize: '16px', fontWeight: 700, color: '#f5c518' },
  sectionLabel: { fontSize: '13px', fontWeight: 600, color: '#2b2b2b' },
  sectionTotal: { fontSize: '11px', color: '#888' },
  emptyHint: { color: '#aaa', textAlign: 'center', padding: '40px', fontSize: '14px' },

  // Items table
  sectionBlock: { marginBottom: '16px', border: '1px solid #e8e8e8', borderRadius: '8px', overflow: 'hidden' },
  sectionHeader: {
    background: '#2b2b2b', padding: '8px 12px', display: 'flex',
    alignItems: 'center', gap: '8px', cursor: 'pointer',
  },
  sectionHeaderName: { flex: 1, color: '#f5c518', fontWeight: 700, fontSize: '13px' },
  sectionHeaderTotal: { color: '#fff', fontSize: '13px', fontWeight: 600 },

  itemRow: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '5px 8px', borderBottom: '1px solid #f0f0f0',
  },
  col: { display: 'flex', alignItems: 'center' },
  colDesc: { flex: 1 },
  colLW: { width: '52px' },
  colArea: { width: '52px' },
  colRate: { width: '72px' },
  colAmt: { width: '88px' },

  input: {
    width: '100%', border: '1px solid #e0e0e0', borderRadius: '4px',
    padding: '4px 6px', fontSize: '12px', background: '#fff', outline: 'none',
  },
  dash: { color: '#bbb', display: 'block', textAlign: 'center', width: '100%' },
  lsmTag: {
    fontSize: '10px', background: '#eee', borderRadius: '3px',
    padding: '1px 4px', color: '#888',
  },
  deleteBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#ccc',
    padding: '4px', display: 'flex', alignItems: 'center',
    transition: 'color 0.1s',
  },
  addItemBtn: {
    display: 'flex', alignItems: 'center', gap: '4px', margin: '6px 8px',
    background: 'none', border: '1px dashed #ccc', borderRadius: '4px',
    padding: '4px 10px', fontSize: '12px', color: '#888', cursor: 'pointer',
  },

  // Summary
  summaryTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '16px' },
  summaryLabel: { padding: '6px 0', fontSize: '13px', color: '#444' },
  summaryValue: { padding: '6px 0', textAlign: 'right', fontSize: '13px', color: '#2b2b2b' },
  summaryDivider: { borderTop: '1px solid #eee', height: '1px' },

  discountBlock: {
    background: '#f9f9f9', borderRadius: '8px', padding: '12px', marginBottom: '16px',
  },
  discountTitle: { fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 600 },
  discountRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  discountSelect: {
    border: '1px solid #ddd', borderRadius: '6px', padding: '6px 10px',
    fontSize: '13px', background: '#fff', outline: 'none',
  },
  discountInput: {
    border: '1px solid #ddd', borderRadius: '6px', padding: '6px 10px',
    fontSize: '13px', width: '120px', outline: 'none',
  },
  discountAmt: { color: '#cc4444', fontSize: '13px', fontWeight: 600 },

  finalBlock: {
    background: '#2b2b2b', borderRadius: '8px', padding: '14px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '16px',
  },
  finalLabel: { color: '#ddd', fontSize: '14px', fontWeight: 600 },
  finalAmount: { color: '#f5c518', fontSize: '22px', fontWeight: 800 },

  paymentBlock: {
    border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden',
    marginBottom: '16px',
  },
  paymentTitle: {
    background: '#f5c518', padding: '8px 12px',
    fontSize: '12px', fontWeight: 700, color: '#2b2b2b',
  },
  paymentRow: {
    display: 'flex', alignItems: 'center', padding: '6px 12px',
    borderBottom: '1px solid #f0f0f0', fontSize: '12px', gap: '8px',
  },
  paymentStage: { width: '56px', fontWeight: 600, color: '#2b2b2b' },
  paymentLabel: { flex: 1, color: '#555' },
  paymentPct: { width: '32px', textAlign: 'right', color: '#888' },
  paymentAmt: { width: '90px', textAlign: 'right', fontWeight: 600, color: '#2b2b2b' },

  notesLabel: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' },
  notesArea: {
    width: '100%', border: '1px solid #ddd', borderRadius: '6px',
    padding: '8px', fontSize: '13px', resize: 'vertical', outline: 'none',
    boxSizing: 'border-box',
  },

  // Footer
  footer: {
    padding: '12px 16px', borderTop: '1px solid #eee', background: '#fafafa',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  printBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    border: '1px solid #ddd', background: '#fff', borderRadius: '6px',
    padding: '8px 14px', fontSize: '13px', cursor: 'pointer', color: '#555',
  },
  saveBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#f5c518', border: 'none', borderRadius: '6px',
    padding: '8px 18px', fontSize: '13px', fontWeight: 700,
    cursor: 'pointer', color: '#2b2b2b',
  },
};
