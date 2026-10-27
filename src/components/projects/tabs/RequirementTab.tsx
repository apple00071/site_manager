'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FiCheck, 
  FiCopy, 
  FiLoader, 
  FiFileText, 
  FiLayers, 
  FiPrinter, 
  FiShield, 
  FiInfo, 
  FiSliders,
  FiExternalLink,
  FiLink,
  FiDownload
} from 'react-icons/fi';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { generateRequirementPDF } from '@/lib/reports/requirementPdfGenerator';

interface CRMQuotationItem {
  id: string;
  section: string;
  item_name: string;
  is_lumpsum: boolean;
  length_ft: number | null;
  width_ft: number | null;
  area_sqft: number;
  unit: string;
  sort_order: number;
}

interface CRMQuotation {
  id: string;
  lead_id: string;
  notes: string;
  material_specs: Record<string, string> | null;
  created_at: string;
  lead: {
    id: string;
    ref_no: string;
    client_name: string;
    site_project: string;
    phone?: string;
    status: string;
  };
  items: CRMQuotationItem[];
}

interface AvailableLead {
  id: string;
  ref_no: string;
  client_name: string;
  site_project: string;
  status: string;
}

interface RequirementTabProps {
  projectId: string;
  projectName?: string;
  activeSubTab?: string;
  onSubTabChange?: (subTab: string) => void;
}

export function RequirementTab({ 
  projectId, 
  projectName, 
  activeSubTab = 'quotation',
  onSubTabChange
}: RequirementTabProps) {
  const { hasPermission, isAdmin } = useUserPermissions();
  const canEdit = isAdmin || hasPermission('requirements.edit') || hasPermission('projects.edit');

  const [loading, setLoading] = useState(true);
  const [crmQuotation, setCrmQuotation] = useState<CRMQuotation | null>(null);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [requirementsPdfUrl, setRequirementsPdfUrl] = useState<string | null>(null);
  const [availableLeads, setAvailableLeads] = useState<AvailableLead[]>([]);
  
  // Manual link state
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [selectedLeadToLink, setSelectedLeadToLink] = useState('');
  const [linkingLead, setLinkingLead] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');

  // Site Notes states
  const [notesContent, setNotesContent] = useState('');
  const [notesTitle, setNotesTitle] = useState('Site Notes');
  const [noteSaveStatus, setNoteSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [copiedNotes, setCopiedNotes] = useState(false);
  const noteSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch requirement notes, approved quotation (price-free) and project requirements document
  const fetchRequirementsData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ t: Date.now().toString() });
      const res = await fetch(`/api/projects/${projectId}/requirements?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load requirement data');
      const data = await res.json();

      if (data.notes && data.notes.length > 0) {
        setNotesContent(data.notes[0].content || '');
        setNotesTitle(data.notes[0].title || 'Site Notes');
      }

      setRequirementsPdfUrl(data.requirementsPdfUrl || null);
      setAvailableLeads(data.availableLeads || []);
      setCrmQuotation(data.crmQuotation || null);
      setProjectInfo(data.projectInfo || null);
    } catch (err) {
      console.error('Error fetching requirement data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchRequirementsData();
    }
    return () => {
      if (noteSaveTimerRef.current) {
        clearTimeout(noteSaveTimerRef.current);
      }
    };
  }, [projectId]);

  // Handle manually linking a CRM quotation lead
  const handleLinkLead = async () => {
    if (!selectedLeadToLink) return;
    try {
      setLinkingLead(true);
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_lead_id: selectedLeadToLink }),
      });
      if (res.ok) {
        setShowLinkSelector(false);
        setSelectedLeadToLink('');
        await fetchRequirementsData();
      }
    } catch (err) {
      console.error('Error linking lead:', err);
    } finally {
      setLinkingLead(false);
    }
  };

  // Debounced auto-save for notes
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

  // Group quotation items by section (room)
  const groupedSections = useMemo(() => {
    if (!crmQuotation?.items) return {};
    const map: Record<string, CRMQuotationItem[]> = {};
    for (const item of crmQuotation.items) {
      const sec = (item.section || 'General').trim();
      if (!map[sec]) map[sec] = [];
      map[sec].push(item);
    }
    return map;
  }, [crmQuotation]);

  // Total scope metrics (without prices)
  const totalItemsCount = crmQuotation?.items?.length || 0;
  const totalRoomsCount = Object.keys(groupedSections).length;
  const totalMeasuredArea = crmQuotation?.items?.reduce((sum, i) => sum + (Number(i.area_sqft) || 0), 0) || 0;

  // Filter available leads for linking
  const filteredAvailableLeads = useMemo(() => {
    if (!leadSearchQuery) return availableLeads.slice(0, 30);
    const q = leadSearchQuery.toLowerCase();
    return availableLeads.filter(
      l => (l.client_name && l.client_name.toLowerCase().includes(q)) ||
           (l.ref_no && l.ref_no.toLowerCase().includes(q)) ||
           (l.site_project && l.site_project.toLowerCase().includes(q))
    );
  }, [availableLeads, leadSearchQuery]);

  // Handle downloading Scope of Work PDF (strictly price-free, clean header with project details & site engineer)
  const handleDownloadPdf = () => {
    if (!crmQuotation) return;

    generateRequirementPDF({
      siteName: projectInfo?.title || projectName || crmQuotation.lead.client_name || 'Project Scope',
      siteAddress: projectInfo?.address || crmQuotation.lead.site_project || 'N/A',
      engineerName: projectInfo?.site_engineer_name || 'Not Assigned',
      engineerMobile: projectInfo?.site_engineer_phone || '',
      date: new Date().toISOString(),
      sections: groupedSections,
      materialSpecs: crmQuotation.material_specs,
      fileName: (projectInfo?.title || projectName || crmQuotation.lead.client_name || 'Project').replace(/\s+/g, '_'),
    });
  };

  if (loading && !crmQuotation && !notesContent && !requirementsPdfUrl) {
    return (
      <div className="w-full p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-28 bg-gray-100 rounded-2xl w-full" />
        <div className="h-64 bg-gray-100 rounded-2xl w-full" />
      </div>
    );
  }

  return (
    <div className="w-full p-3 sm:p-6 space-y-5 animate-tab-enter">
      
      {/* ─── TAB 1: CRM QUOTATION SCOPE (PRICE-FREE) ────────────── */}
      {activeSubTab === 'quotation' && (
        <div className="space-y-5">
          {crmQuotation ? (
            <>
              {/* Minimal Toolbar: Ref, Stats & Download PDF */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-2xs">
                <div>
                  {crmQuotation.lead.ref_no && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 border border-gray-200">
                      Ref #{crmQuotation.lead.ref_no}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-medium">
                    {totalItemsCount} items • {totalRoomsCount} rooms
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="btn-primary py-1.5 px-3.5 text-xs font-medium cursor-pointer"
                    title="Download Scope of Work PDF"
                  >
                    <FiDownload className="w-3.5 h-3.5" />
                    <span>Download Scope PDF</span>
                  </button>
                </div>
              </div>

              {/* ─── SCOPE OF WORK SECTIONS (TABLES PER ROOM) ─────── */}
              <div className="space-y-4">
                {Object.entries(groupedSections).map(([sectionName, items], secIdx) => {
                  const sectionArea = items.reduce((s, i) => s + (Number(i.area_sqft) || 0), 0);

                  return (
                    <div 
                      key={sectionName} 
                      className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden transition-all"
                    >
                      {/* Section Header - Clean Light Warm Brand Colors */}
                      <div className="px-4 py-3 sm:px-6 sm:py-3 bg-yellow-50/70 border-b border-yellow-200/80 text-gray-900 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-[#f0b100] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {secIdx + 1}
                          </span>
                          <h3 className="font-extrabold text-xs sm:text-sm tracking-wide uppercase text-gray-900">
                            {sectionName}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                          <span>{items.length} item{items.length > 1 ? 's' : ''}</span>
                          {sectionArea > 0 && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-amber-800 font-extrabold">{sectionArea} sq.ft</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Items Table (Without Price Columns and Without Type Column) */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                              <th className="py-2.5 px-4 w-12 text-center">#</th>
                              <th className="py-2.5 px-4">Work / Item Description</th>
                              <th className="py-2.5 px-3 w-28 text-center">L (ft)</th>
                              <th className="py-2.5 px-3 w-28 text-center">W (ft)</th>
                              <th className="py-2.5 px-4 w-32 text-center">Area / Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                            {items.map((item, idx) => (
                              <tr 
                                key={item.id || idx}
                                className={idx % 2 === 1 ? 'bg-gray-50/50 hover:bg-yellow-50/30' : 'bg-white hover:bg-yellow-50/30'}
                              >
                                <td className="py-3 px-4 text-center text-gray-400 font-bold text-xs">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-4 font-bold text-gray-950">
                                  {item.item_name}
                                </td>
                                <td className="py-3 px-3 text-center text-gray-600">
                                  {item.is_lumpsum ? '—' : (item.length_ft != null ? item.length_ft : '—')}
                                </td>
                                <td className="py-3 px-3 text-center text-gray-600">
                                  {item.is_lumpsum ? '—' : (item.width_ft != null ? item.width_ft : '—')}
                                </td>
                                <td className="py-3 px-4 text-center font-bold text-gray-900">
                                  {item.is_lumpsum 
                                    ? '1 Lumpsum' 
                                    : `${item.area_sqft || 0} ${item.unit || 'sq.ft'}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ─── MATERIAL & HARDWARE SPECIFICATIONS ───────────── */}
              {crmQuotation.material_specs && Object.keys(crmQuotation.material_specs).length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                  <div className="px-4 py-3 sm:px-6 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
                    <FiSliders className="w-4 h-4 text-gray-700" />
                    <h3 className="font-black text-xs sm:text-sm text-gray-900 uppercase tracking-wide">
                      Agreed Material &amp; Hardware Specifications
                    </h3>
                  </div>

                  <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(crmQuotation.material_specs).map(([specKey, specVal]) => (
                      <div 
                        key={specKey}
                        className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 space-y-1"
                      >
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          {specKey}
                        </span>
                        <p className="text-xs font-bold text-gray-900 leading-snug">
                          {specVal}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── QUOTATION NOTES & REMARKS ────────────────────── */}
              {crmQuotation.notes && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs space-y-2">
                  <h4 className="text-xs font-black uppercase text-gray-500 tracking-wider flex items-center gap-1.5">
                    <FiInfo className="w-3.5 h-3.5 text-gray-400" />
                    <span>Quotation Remarks &amp; Special Conditions</span>
                  </h4>
                  <p className="text-xs text-gray-700 leading-relaxed font-medium whitespace-pre-line bg-gray-50 p-3 rounded-xl border border-gray-100">
                    {crmQuotation.notes}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* State when no CRM quotation is auto-matched */
            <div className="space-y-5">
              
              {/* If an uploaded Requirements PDF exists for this project (e.g. Vrishen) */}
              {requirementsPdfUrl && (
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-yellow-50 border border-yellow-200 flex items-center justify-center text-yellow-600 text-xl shrink-0">
                      📄
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-gray-900">
                        Uploaded Requirements Document (PDF)
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        An official client requirements document is uploaded for this project.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={requirementsPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary py-1.5 px-3.5 text-xs font-medium cursor-pointer"
                    >
                      <FiExternalLink className="w-3.5 h-3.5 text-white" />
                      <span>View Requirements PDF</span>
                    </a>
                    <a
                      href={requirementsPdfUrl}
                      download
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
                      title="Download PDF"
                    >
                      <FiDownload className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* No quotation linked card with Link selector */}
              <div className="bg-white p-6 sm:p-10 text-center rounded-2xl border border-gray-200 shadow-xs space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-yellow-50 text-yellow-600 flex items-center justify-center mx-auto text-xl border border-yellow-200">
                  📋
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-sm font-bold text-gray-900">
                    No Quotation Linked
                  </h3>
                  <p className="text-xs text-gray-500">
                    No quotation has been linked to this project yet.
                  </p>
                </div>

                {/* Quick Link Selector */}
                {canEdit && (
                  <div className="max-w-md mx-auto pt-2">
                    {!showLinkSelector ? (
                      <button
                        type="button"
                        onClick={() => setShowLinkSelector(true)}
                        className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 mx-auto cursor-pointer"
                      >
                        <FiLink className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Link Quotation</span>
                      </button>
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3 text-left">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-700">
                            Select Quotation:
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowLinkSelector(false)}
                            className="text-[11px] text-gray-400 hover:text-gray-600 font-semibold"
                          >
                            Cancel
                          </button>
                        </div>

                        <input
                          type="text"
                          value={leadSearchQuery}
                          onChange={(e) => setLeadSearchQuery(e.target.value)}
                          placeholder="Search by client name, Ref #, or site..."
                          className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-500"
                        />

                        <select
                          value={selectedLeadToLink}
                          onChange={(e) => setSelectedLeadToLink(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg font-medium text-gray-800 outline-none focus:ring-2 focus:ring-yellow-500"
                        >
                          <option value="">-- Choose a Quotation --</option>
                          {filteredAvailableLeads.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.ref_no ? `[${l.ref_no}] ` : ''}{l.client_name} {l.site_project ? `• ${l.site_project}` : ''}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={handleLinkLead}
                          disabled={!selectedLeadToLink || linkingLead}
                          className="btn-primary w-full py-2 text-xs font-medium cursor-pointer disabled:opacity-50"
                        >
                          {linkingLead ? (
                            <>
                              <FiLoader className="w-3.5 h-3.5 animate-spin" />
                              <span>Linking...</span>
                            </>
                          ) : (
                            <>
                              <FiCheck className="w-3.5 h-3.5" />
                              <span>Confirm Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: SITE NOTES (RICH TEXT EDITOR WITH AUTO-SAVE) ─── */}
      {activeSubTab === 'notes' && (
        <div key="notes" className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Notes Toolbar */}
            <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200/80 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 font-bold text-xs ${
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
                <span className="text-gray-400 text-xs hidden sm:inline">
                  {notesContent.length} chars • {notesContent.split(/\s+/).filter(Boolean).length} words
                </span>
                <button
                  type="button"
                  onClick={handleCopyNotes}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold transition cursor-pointer"
                  title="Copy notes to clipboard"
                >
                  {copiedNotes ? (
                    <>
                      <FiCheck className="text-emerald-600 w-3.5 h-3.5" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <FiCopy className="w-3.5 h-3.5" />
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
      )}

    </div>
  );
}
