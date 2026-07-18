'use client';

import { useEffect, useState, useMemo, useRef, Fragment, useCallback } from 'react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { 
  FiSearch, FiPlus, FiTrash2, FiRefreshCw, 
  FiAlertTriangle, FiCloud,
  FiDownload, FiUpload, FiEdit, FiPrinter
} from 'react-icons/fi';
import { TbCurrencyRupee } from 'react-icons/tb';
import { BottomSheet } from '@/components/ui/BottomSheet';
import * as XLSX from 'xlsx';
import dynamic from 'next/dynamic';
const QuotationBuilder = dynamic(() => import('@/components/crm/QuotationBuilder'), { ssr: false });

interface Lead {
  id: string;
  ref_no: string;
  created_date: string;
  client_name: string;
  phone: string;
  site_project: string;
  area_sqft: number;
  quote_value: number;
  status: 'Draft' | 'Sent' | 'Follow-up' | 'Approved' | 'Rejected' | 'On Hold';
  approved_value: number;
  assigned_by: string;
  follow_up_1: string;
  follow_up_2: string;
  follow_up_3: string;
  remarks: string;
  latest_quotation_id?: string;
  quote_version?: number;
}

// ponytail: timezone-safe local date parser to avoid shifting on date-only strings
const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date(NaN);
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  const d = new Date(dateStr);
  return d;
};

export default function CRMPage() {
  const { hasPermission } = useUserPermissions();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'log'>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quotationLead, setQuotationLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbWarning, setDbWarning] = useState<string | null>(null);
  const [dashboardTimeFilter, setDashboardTimeFilter] = useState<'all' | 'month' | '3months' | '6months'>('all');
  
  // Real-time Sync Status
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');

  // Selected leads for bulk actions
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

  // Default column widths state (loaded from localStorage if exists)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('crm_column_widths');
      if (saved) {
        try {
          return { ...JSON.parse(saved) };
        } catch (_) {}
      }
    }
    return {
      ref_no: 110,
      created_date: 80,
      client_name: 100,
      phone: 95,
      site_project: 220,
      area_sqft: 70,
      quote_value: 95,
      status: 105,
      approved_value: 110,
      assigned_by: 100,
      follow_up_1: 160,
      follow_up_2: 160,
      follow_up_3: 160,
      remarks: 150
    };
  });

  // Save widths to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm_column_widths', JSON.stringify(columnWidths));
    }
  }, [columnWidths]);

  const resizingColRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColRef.current) return;
    const { id, startX, startWidth } = resizingColRef.current;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(50, startWidth + deltaX);
    setColumnWidths(prev => ({
      ...prev,
      [id]: newWidth
    }));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizingColRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    resizingColRef.current = {
      id: colId,
      startX: e.clientX,
      startWidth: columnWidths[colId] || 100
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // Drag and drop helper for Kanban
  const handleDragStartKanban = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    setDraggedLeadId(leadId);
  };

  const handleDropKanban = async (e: React.DragEvent, targetStatus: Lead['status']) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedLeadId;
    setDraggedLeadId(null);
    if (!id) return;
    
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.status === targetStatus) return;

    setSyncStatus('syncing');
    const updatedLead = {
      ...lead,
      status: targetStatus
    };

    // Auto-fill approved value if approved
    if (targetStatus === 'Approved' && !updatedLead.approved_value) {
      updatedLead.approved_value = lead.quote_value;
    }

    try {
      const response = await fetch('/api/crm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLead)
      });
      if (response.ok) {
        setLeads(prev => prev.map(l => l.id === id ? updatedLead : l));
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Error changing status via Kanban:', err);
      setSyncStatus('error');
    }
  };

  // Helper to format currency in Lakhs (₹24.8L-style)
  const formatLakhs = useCallback((value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    }
    return `₹${value.toLocaleString('en-IN')}`;
  }, []);

  // Row alert color helper for Log spreadsheet view
  const getRowAlertClass = useCallback((lead: Lead) => {
    if (lead.status === 'Approved' || lead.status === 'Rejected' || lead.status === 'Draft') return '';
    if (!lead.created_date) return '';
    
    const created = parseLocalDate(lead.created_date);
    if (isNaN(created.getTime())) return '';
    
    const ageInDays = (new Date().getTime() - created.getTime()) / (1000 * 3600 * 24);
    
    if (ageInDays > 14) {
      return 'bg-red-50/40 hover:bg-red-50/60 dark:bg-red-950/10 dark:hover:bg-red-950/20 text-red-900 border-l-4 border-l-red-500';
    }
    if (ageInDays > 7) {
      return 'bg-amber-50/40 hover:bg-amber-50/60 dark:bg-amber-950/10 dark:hover:bg-amber-950/20 text-amber-900 border-l-4 border-l-amber-500';
    }
    return '';
  }, []);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Active Cell Selection for Sheet Grid
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const selectedCellRef = useRef<HTMLTableCellElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [isMobileEditOpen, setIsMobileEditOpen] = useState(false);
  const [mobileEditForm, setMobileEditForm] = useState<Lead | null>(null);
  
  // Collapsible month groups
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const toggleMonthCollapse = (monthName: string) => {
    setCollapsedMonths(prev => ({
      ...prev,
      [monthName]: !prev[monthName]
    }));
  };

  // Column definitions modeled after user screenshot
  const columns = useMemo(() => [
    { id: 'ref_no', label: 'Ref No.', width: '110px', editable: false },
    { id: 'created_date', label: 'Date', width: '80px', editable: true, type: 'date' },
    { id: 'client_name', label: 'Client Name', width: '100px', editable: true, type: 'text' },
    { id: 'phone', label: 'Phone', width: '95px', editable: true, type: 'text' },
    { id: 'site_project', label: 'Site / Project', width: '220px', editable: true, type: 'text' },
    { id: 'area_sqft', label: 'Area (sq.ft)', width: '70px', editable: true, type: 'number' },
    { id: 'quote_value', label: 'Quote Value (₹)', width: '95px', editable: true, type: 'number' },
    { id: 'status', label: 'Status', width: '105px', editable: true, type: 'status' },
    { id: 'approved_value', label: 'Approved Value (₹)', width: '110px', editable: true, type: 'number' },
    { id: 'assigned_by', label: 'Assigned By', width: '100px', editable: true, type: 'assignee' },
    { id: 'follow_up_1', label: 'Follow-up 1', width: '160px', editable: true, type: 'text' },
    { id: 'follow_up_2', label: 'Follow-up 2', width: '160px', editable: true, type: 'text' },
    { id: 'follow_up_3', label: 'Follow-up 3', width: '160px', editable: true, type: 'text' },
    { id: 'remarks', label: 'Remarks', width: '150px', editable: true, type: 'text' }
  ], []);

  // Dynamically extract unique assignees to prevent data mismatches and support custom data entries
  const assigneeOptions = useMemo(() => {
    const set = new Set<string>(['Aravind Sir', 'Walk-in', 'Direct Call', 'Office Mobile', 'Other']);
    employees.forEach(emp => {
      if (emp.full_name) {
        set.add(emp.full_name);
      }
    });
    leads.forEach(lead => {
      if (lead.assigned_by) {
        set.add(lead.assigned_by);
      }
    });
    return Array.from(set).sort();
  }, [leads, employees]);

  // Fetch leads
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/crm');
      if (response.ok) {
        const result = await response.json();
        setLeads(result.data || []);
        if (result.warning) {
          setDbWarning(result.warning);
        } else {
          setDbWarning(null);
        }
      } else {
        console.error('Failed to fetch CRM leads');
      }
    } catch (err) {
      console.error('Error fetching CRM leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/admin/users');
        if (response.ok) {
          const data = await response.json();
          setEmployees(data || []);
        }
      } catch (err) {
        console.error('Error fetching employees:', err);
      }
    };
    fetchEmployees();
  }, []);

  // Filtered Leads list
  const filteredLeads = useMemo(() => {
    const filtered = leads.filter((lead) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        lead.client_name?.toLowerCase().includes(query) ||
        lead.phone?.includes(query) ||
        lead.ref_no?.toLowerCase().includes(query) ||
        lead.site_project?.toLowerCase().includes(query) ||
        lead.remarks?.toLowerCase().includes(query);
      
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // ponytail: sort by date descending and secondary by ref_no descending to ensure month wise data are grouped together
    return [...filtered].sort((a, b) => {
      const dateA = a.created_date ? parseLocalDate(a.created_date).getTime() : 0;
      const dateB = b.created_date ? parseLocalDate(b.created_date).getTime() : 0;
      
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      
      return (b.ref_no || '').localeCompare(a.ref_no || '', undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [leads, searchQuery, statusFilter]);

  // Date filtered leads for Dashboard view
  const dashboardFilteredLeads = useMemo(() => {
    const now = new Date();
    
    if (dashboardTimeFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return leads.filter(lead => {
        if (!lead.created_date) return false;
        const d = parseLocalDate(lead.created_date);
        return d >= startOfMonth;
      });
    }
    
    if (dashboardTimeFilter === '3months') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      threeMonthsAgo.setDate(1);
      threeMonthsAgo.setHours(0, 0, 0, 0);
      return leads.filter(lead => {
        if (!lead.created_date) return false;
        const d = parseLocalDate(lead.created_date);
        return d >= threeMonthsAgo;
      });
    }

    if (dashboardTimeFilter === '6months') {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);
      return leads.filter(lead => {
        if (!lead.created_date) return false;
        const d = parseLocalDate(lead.created_date);
        return d >= sixMonthsAgo;
      });
    }

    return leads;
  }, [leads, dashboardTimeFilter]);

  // Group leads by month/year for Monthly breakdown
  const monthlyBreakdown = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const groups: Record<string, { monthStr: string; dateVal: Date; quotes: number; approved: number; rejected: number; pending: number; value: number }> = {};
    
    dashboardFilteredLeads.forEach(lead => {
      if (!lead.created_date) return;
      const date = parseLocalDate(lead.created_date);
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!groups[key]) {
        groups[key] = {
          monthStr: `${months[date.getMonth()]} ${date.getFullYear()}`,
          dateVal: date,
          quotes: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          value: 0
        };
      }
      
      groups[key].quotes += 1;
      if (lead.status === 'Approved') {
        groups[key].approved += 1;
        groups[key].value += lead.approved_value || 0;
      } else if (lead.status === 'Rejected') {
        groups[key].rejected += 1;
      } else if (lead.status === 'Follow-up' || lead.status === 'Sent' || lead.status === 'On Hold') {
        groups[key].pending += 1;
        groups[key].value += lead.quote_value || 0;
      }
    });

    return Object.values(groups).sort((a, b) => b.dateVal.getTime() - a.dateVal.getTime());
  }, [dashboardFilteredLeads]);

  // Counts by status for Summary Table
  const statusSummary = useMemo(() => {
    const summary: Record<string, number> = {
      'Draft': 0,
      'Sent': 0,
      'Follow-up': 0,
      'Approved': 0,
      'Rejected': 0,
      'On Hold': 0
    };
    
    dashboardFilteredLeads.forEach(lead => {
      if (summary[lead.status] !== undefined) {
        summary[lead.status] += 1;
      }
    });
    
    return summary;
  }, [dashboardFilteredLeads]);

  // Overall statistics for Dashboard
  const stats = useMemo(() => {
    const totalQuotes = dashboardFilteredLeads.length;
    
    // This month (June 2026 for default, dynamically checks current month)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthQuotes = leads.filter(lead => {
      if (!lead.created_date) return false;
      const d = parseLocalDate(lead.created_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const approvedCount = dashboardFilteredLeads.filter(l => l.status === 'Approved').length;
    const pendingCount = dashboardFilteredLeads.filter(l => l.status === 'Follow-up' || l.status === 'Sent').length;
    const rejectedCount = dashboardFilteredLeads.filter(l => l.status === 'Rejected').length;
    const onHoldCount = dashboardFilteredLeads.filter(l => l.status === 'On Hold').length;

    // Financial calculations
    const totalPipeline = dashboardFilteredLeads
      .filter(l => l.status !== 'Approved' && l.status !== 'Rejected')
      .reduce((sum, l) => sum + (l.quote_value || 0), 0);

    const totalApprovedVal = dashboardFilteredLeads
      .filter(l => l.status === 'Approved')
      .reduce((sum, l) => sum + (l.approved_value || 0), 0);

    const avgQuoteVal = totalQuotes > 0
      ? dashboardFilteredLeads.reduce((sum, l) => sum + (l.quote_value || 0), 0) / totalQuotes
      : 0;

    const conversionRate = totalQuotes > 0
      ? (approvedCount / totalQuotes) * 100
      : 0;

    const activePipeline = dashboardFilteredLeads.filter(l => l.status !== 'Approved' && l.status !== 'Rejected').length;

    return {
      totalQuotes,
      thisMonthQuotes,
      approvedCount,
      pendingCount,
      rejectedCount,
      onHoldCount,
      totalPipeline,
      totalApprovedVal,
      avgQuoteVal,
      conversionRate,
      activePipeline
    };
  }, [leads, dashboardFilteredLeads]);

  // Update lead backend sync helper
  const syncLeadChange = useCallback(async (updatedLead: Lead) => {
    setSyncStatus('syncing');
    try {
      const response = await fetch('/api/crm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLead)
      });
      if (response.ok) {
        setSyncStatus('synced');
        // Update local state
        setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Error syncing change:', err);
      setSyncStatus('error');
    }
  }, []);

  // Excel Export
  const exportToExcel = () => {
    try {
      const dataToExport = filteredLeads.map(lead => ({
        'Ref No.': lead.ref_no || '',
        'Date': lead.created_date || '',
        'Client Name': lead.client_name || '',
        'Phone': lead.phone || '',
        'Site / Project': lead.site_project || '',
        'Area (sq.ft)': lead.area_sqft || 0,
        'Quote Value (₹)': lead.quote_value || 0,
        'Status': lead.status || '',
        'Approved Value (₹)': lead.approved_value || 0,
        'Assigned By': lead.assigned_by || '',
        'Follow-up 1': lead.follow_up_1 || '',
        'Follow-up 2': lead.follow_up_2 || '',
        'Follow-up 3': lead.follow_up_3 || '',
        'Remarks': lead.remarks || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotation Leads');
      XLSX.writeFile(workbook, `Quotation_Leads_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert('Failed to export data to Excel.');
    }
  };

  // Helper to parse dates from Excel
  const parseExcelDate = (val: unknown) => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
      // Excel serial date format
      const date = new Date((val - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    const d = new Date(val as string | number);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  // Excel/CSV Import
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (jsonData.length === 0) {
          alert('No records found in the uploaded file.');
          return;
        }

        setSyncStatus('syncing');
        let successCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          const client_name = row['Client Name'] || row['client_name'] || 'Imported Customer';
          const phone = String(row['Phone'] || row['phone'] || '');
          const site_project = row['Site / Project'] || row['site_project'] || row['Site Project'] || '';
          const area_sqft = Number(row['Area (sq.ft)'] || row['area_sqft'] || row['Area'] || 0);
          const quote_value = Number(row['Quote Value (₹)'] || row['quote_value'] || row['Quote Value'] || 0);
          const status = row['Status'] || row['status'] || 'Draft';
          const approved_value = Number(row['Approved Value (₹)'] || row['approved_value'] || row['Approved Value'] || 0);
          const assigned_by = row['Assigned By'] || row['assigned_by'] || '';
          const follow_up_1 = row['Follow-up 1'] || row['follow_up_1'] || '';
          const follow_up_2 = row['Follow-up 2'] || row['follow_up_2'] || '';
          const follow_up_3 = row['Follow-up 3'] || row['follow_up_3'] || '';
          const remarks = row['Remarks'] || row['remarks'] || '';
          const created_date = parseExcelDate(row['Date'] || row['created_date'] || row['created_at']);

          try {
            const response = await fetch('/api/crm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                client_name,
                phone,
                site_project,
                area_sqft,
                quote_value,
                status,
                approved_value,
                assigned_by,
                follow_up_1,
                follow_up_2,
                follow_up_3,
                remarks,
                created_date
              })
            });

            if (response.ok) {
              const result = await response.json();
              setLeads(prev => [result.data, ...prev]);
              successCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            console.error('Error importing row:', err);
            errorCount++;
          }
        }

        setSyncStatus('synced');
        alert(`Import completed! Successfully imported ${successCount} leads. Errors: ${errorCount}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error('Error reading file:', err);
        setSyncStatus('error');
        alert('Failed to read Excel file. Please ensure it is a valid .xlsx or .csv file.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Open mobile / layout editor Bottom Sheet
  const handleOpenMobileEdit = () => {
    if (!selectedCell) return;
    const lead = filteredLeads[selectedCell.rowIndex];
    if (!lead) return;
    setMobileEditForm({ ...lead });
    setIsMobileEditOpen(true);
  };

  // Save changes from Bottom Sheet
  const handleSaveMobileEdit = async () => {
    if (!mobileEditForm) return;
    await syncLeadChange(mobileEditForm);
    setIsMobileEditOpen(false);
  };

  // Add new lead API call
  const handleAddLead = async () => {
    if (!hasPermission('crm.manage')) return;
    
    setSyncStatus('syncing');
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'New Customer',
          status: 'Draft',
          quote_value: 0
        })
      });
      if (response.ok) {
        const result = await response.json();
        setLeads(prev => [result.data, ...prev]);
        setSyncStatus('synced');
        // Focus on client name of the newly added lead
        setSelectedCell({ rowIndex: 0, colIndex: 2 });
        setIsEditing(true);
        setEditValue('New Customer');
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Error adding lead:', err);
      setSyncStatus('error');
    }
  };

  // Delete lead API call
  const handleDeleteLead = async () => {
    if (!hasPermission('crm.manage') || !selectedCell) return;
    const targetLead = filteredLeads[selectedCell.rowIndex];
    if (!targetLead) return;

    if (!confirm(`Are you sure you want to delete lead ${targetLead.ref_no} for ${targetLead.client_name}?`)) {
      return;
    }

    setSyncStatus('syncing');
    try {
      const response = await fetch(`/api/crm?id=${targetLead.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setLeads(prev => prev.filter(l => l.id !== targetLead.id));
        setSyncStatus('synced');
        setSelectedCell(null);
        setIsEditing(false);
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Error deleting lead:', err);
      setSyncStatus('error');
    }
  };

  // Bulk Delete API call
  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedLeadIds.length} selected leads?`)) {
      return;
    }

    setSyncStatus('syncing');
    try {
      const response = await fetch(`/api/crm?id=${selectedLeadIds.join(',')}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setLeads(prev => prev.filter(l => !selectedLeadIds.includes(l.id)));
        setSelectedLeadIds([]);
        setSyncStatus('synced');
        setSelectedCell(null);
        setIsEditing(false);
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Error bulk deleting leads:', err);
      setSyncStatus('error');
    }
  };

  // Bulk Status change API call
  const handleBulkStatusChange = async (newStatus: Lead['status']) => {
    if (selectedLeadIds.length === 0) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch('/api/crm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLeadIds,
          status: newStatus
        })
      });
      if (response.ok) {
        const result = await response.json();
        const updatedList = Array.isArray(result.data) ? result.data : [result.data];
        setLeads(prev => prev.map(l => {
          const updated = updatedList.find((u: Lead) => u.id === l.id);
          return updated ? updated : l;
        }));
        setSelectedLeadIds([]);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Error bulk status change:', err);
      setSyncStatus('error');
    }
  };

  // Trigger editing of cell
  const startEditCell = useCallback((rowIndex: number, colIndex: number) => {
    if (!hasPermission('crm.manage')) return;
    const lead = filteredLeads[rowIndex];
    const col = columns[colIndex];
    if (!lead || !col || !col.editable) return;
    
    setSelectedCell({ rowIndex, colIndex });
    setIsEditing(true);
    setEditValue(String(lead[col.id as keyof Lead] ?? ''));
  }, [filteredLeads, columns, hasPermission]);

  // Close cell editor and save
  const finishEditCell = useCallback(() => {
    if (!selectedCell || !isEditing) return;
    const lead = filteredLeads[selectedCell.rowIndex];
    const col = columns[selectedCell.colIndex];
    if (!lead || !col) return;

    let newValue: string | number = editValue;
    if (col.type === 'number') {
      newValue = Number(editValue) || 0;
    }

    // Only sync if value actually changed
    if (lead[col.id as keyof Lead] !== newValue) {
      const updatedLead = {
        ...lead,
        [col.id]: newValue
      };

      // Automations
      if (col.id === 'status') {
        if (newValue === 'Approved' && !updatedLead.approved_value) {
          updatedLead.approved_value = lead.quote_value;
        } else if (newValue === 'Follow-up') {
          const followUpCols = ['follow_up_1', 'follow_up_2', 'follow_up_3'];
          const colIdx = columns.findIndex(c => followUpCols.includes(c.id) && !lead[c.id as keyof Lead]);
          if (colIdx !== -1) {
            const rowIndex = selectedCell.rowIndex;
            setTimeout(() => {
              setSelectedCell({ rowIndex, colIndex: colIdx });
              setIsEditing(true);
              setEditValue('');
            }, 100);
          }
        }
      }

      syncLeadChange(updatedLead);
    }
    
    setIsEditing(false);
  }, [selectedCell, isEditing, filteredLeads, columns, editValue, syncLeadChange]);

  // Keyboard navigation inside sheet
  useEffect(() => {
    if (!selectedCell || isEditing || quotationLead) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const { rowIndex, colIndex } = selectedCell;
      let newRow = rowIndex;
      let newCol = colIndex;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        newRow = Math.max(0, rowIndex - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        newRow = Math.min(filteredLeads.length - 1, rowIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        newCol = Math.max(0, colIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        newCol = Math.min(columns.length - 1, colIndex + 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        startEditCell(rowIndex, colIndex);
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          newCol = Math.max(0, colIndex - 1);
        } else {
          newCol = Math.min(columns.length - 1, colIndex + 1);
        }
      } else {
        return;
      }

      setSelectedCell({ rowIndex: newRow, colIndex: newCol });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, isEditing, filteredLeads, columns, startEditCell]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  // Scroll selected cell into view
  useEffect(() => {
    if (selectedCell && selectedCellRef.current) {
      selectedCellRef.current.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [selectedCell]);

  const activeCellAddress = useMemo(() => {
    if (!selectedCell) return '';
    const colLetter = String.fromCharCode(65 + selectedCell.colIndex); // A, B, C...
    const rowNum = selectedCell.rowIndex + 1;
    return `${colLetter}${rowNum}`;
  }, [selectedCell]);

  const activeCellValue = useMemo(() => {
    if (!selectedCell) return '';
    const lead = filteredLeads[selectedCell.rowIndex];
    const col = columns[selectedCell.colIndex];
    if (!lead || !col) return '';
    return String(lead[col.id as keyof Lead] ?? '');
  }, [selectedCell, filteredLeads, columns]);

  // Status Badge classes
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Follow-up':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Sent':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'On Hold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  if (!hasPermission('crm.view')) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white min-h-[50vh] rounded-2xl shadow-sm border border-gray-100">
        <FiAlertTriangle className="h-16 w-16 text-yellow-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 text-sm max-w-sm text-center">
          You do not have the required permissions (`crm.view`) to access the Quotation CRM. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full bg-gray-50 p-1 sm:p-2.5 select-none">
      
      {dbWarning && (
        <div className="mb-2 p-2.5 bg-yellow-50 border border-yellow-100 text-yellow-800 text-xs rounded-xl flex items-center gap-2">
          <FiAlertTriangle className="text-yellow-600 flex-shrink-0" />
          <span><strong>Failsafe Mode active:</strong> {dbWarning} Leads are running in sandbox mode.</span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-200">
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setActiveTab('dashboard'); setSelectedCell(null); setIsEditing(false); }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-200 ${
              activeTab === 'dashboard' 
                ? 'bg-yellow-500 text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-200/50'
            }`}
          >
            🏡 Dashboard
          </button>
          <button
            onClick={() => { setActiveTab('log'); }}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-200 ${
              activeTab === 'log' 
                ? 'bg-yellow-500 text-white shadow-sm' 
                : 'text-gray-600 hover:bg-gray-200/50'
            }`}
          >
            📋 Quotation Log
          </button>
        </div>

        <div className="flex items-center gap-3 pr-2">
          {/* Time Filter Dropdown (Dashboard tab only) */}
          {activeTab === 'dashboard' && (
            <select
              value={dashboardTimeFilter}
              onChange={(e) => setDashboardTimeFilter(e.target.value as 'all' | 'month' | '3months' | '6months')}
              className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] text-gray-700 focus:outline-none focus:border-yellow-500 font-bold"
            >
              <option value="all">📅 All Time</option>
              <option value="month">📅 This Month</option>
              <option value="3months">📅 Last 3 Months</option>
              <option value="6months">📅 Last 6 Months</option>
            </select>
          )}

          {/* Sync Status Icon (Google Sheets Style) */}
          <div className="flex items-center gap-1" title={
            syncStatus === 'synced' ? 'All changes saved to database' :
            syncStatus === 'syncing' ? 'Saving changes...' : 'Error saving changes'
          }>
            {syncStatus === 'synced' && (
              <div className="flex items-center gap-1 text-gray-400 text-xs font-medium">
                <FiCloud className="h-4 w-4 text-green-500" />
                <span className="text-[10px] text-gray-500 font-bold">Saved</span>
              </div>
            )}
            {syncStatus === 'syncing' && (
              <div className="flex items-center gap-1 text-blue-500 text-xs font-medium">
                <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="text-[10px] font-bold">Saving...</span>
              </div>
            )}
            {syncStatus === 'error' && (
              <div className="flex items-center gap-1 text-red-500 text-xs font-medium">
                <FiAlertTriangle className="h-4 w-4" />
                <span className="text-[10px] font-bold">Error</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[50vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500 mb-2"></div>
          <span className="text-xs text-gray-500 font-bold">Loading Quotation Logs...</span>
        </div>
      ) : activeTab === 'dashboard' ? (
        // REDESIGNED HIGH-FIDELITY DASHBOARD VIEW
        <div className="space-y-6 p-2 sm:p-4 text-xs">
          {/* KPI Dashboard Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: New leads */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">New Leads</span>
                <p className="text-3xl font-black text-gray-900 mt-2">{stats.thisMonthQuotes}</p>
              </div>
              <div className="text-[10px] text-gray-500 font-bold mt-2 flex items-center gap-1">
                <span className="text-green-600 font-black">↑ {dashboardFilteredLeads.filter(l => l.status === 'Draft').length}</span> drafts active
              </div>
            </div>

            {/* Card 2: Active Follow-ups */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Active Follow-ups</span>
                <p className="text-3xl font-black text-blue-600 mt-2">{stats.pendingCount}</p>
              </div>
              <div className="text-[10px] text-gray-500 font-bold mt-2 flex items-center gap-1">
                <span className="text-blue-600 font-black">↑ {stats.onHoldCount}</span> on hold
              </div>
            </div>

            {/* Card 3: Quotation Value */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Quotation Value</span>
                <p className="text-3xl font-black text-yellow-600 mt-2">
                  {formatLakhs(stats.totalPipeline)}
                </p>
              </div>
              <div className="text-[10px] text-gray-500 font-bold mt-2 flex items-center gap-1">
                <span className="text-yellow-600 font-black">↑ {stats.activePipeline}</span> under discussion
              </div>
            </div>

            {/* Card 4: Conversion Rate */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Conversion Rate</span>
                <p className="text-3xl font-black text-green-600 mt-2">{stats.conversionRate.toFixed(1)}%</p>
              </div>
              <div className="text-[10px] text-gray-500 font-bold mt-2 flex items-center gap-1">
                <span className="text-green-600 font-black">↑ {stats.approvedCount}</span> approved leads
              </div>
            </div>
          </div>

          {/* Main Layout: Pipeline & Sidebar widgets */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Left 3 cols: Lead Pipeline (Kanban Board) */}
            <div className="xl:col-span-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900">Lead pipeline</h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">Drag and drop leads to progress them</p>
                </div>
                <button
                  onClick={() => setActiveTab('log')}
                  className="text-xs text-yellow-600 hover:text-yellow-700 font-black flex items-center gap-0.5 hover:underline cursor-pointer"
                >
                  View all leads →
                </button>
              </div>

              {/* Kanban Columns container */}
              <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-2 min-h-[300px]">
                {(['Draft', 'Sent', 'Follow-up', 'On Hold', 'Approved'] as const).map((colStatus) => {
                  const colLeads = dashboardFilteredLeads.filter(l => l.status === colStatus);
                  const colLabels: Record<string, string> = {
                    'Draft': 'Draft',
                    'Sent': 'Sent',
                    'Follow-up': 'Follow-up',
                    'On Hold': 'On Hold',
                    'Approved': 'Approved'
                  };
                  const colColorClasses: Record<string, string> = {
                    'Draft': 'border-t-4 border-t-gray-400 bg-gray-50/50',
                    'Sent': 'border-t-4 border-t-blue-500 bg-blue-50/20',
                    'Follow-up': 'border-t-4 border-t-orange-500 bg-orange-50/20',
                    'On Hold': 'border-t-4 border-t-yellow-500 bg-yellow-50/20',
                    'Approved': 'border-t-4 border-t-green-500 bg-green-50/20'
                  };
                  const colHeaderColorClasses: Record<string, string> = {
                    'Draft': 'text-gray-500 bg-gray-100',
                    'Sent': 'text-blue-700 bg-blue-100/60',
                    'Follow-up': 'text-orange-700 bg-orange-100/60',
                    'On Hold': 'text-yellow-700 bg-yellow-100/60',
                    'Approved': 'text-green-700 bg-green-100/60'
                  };

                  return (
                    <div
                      key={colStatus}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropKanban(e, colStatus)}
                      className={`flex flex-col gap-3 p-2.5 rounded-xl border border-gray-100 min-w-[150px] ${colColorClasses[colStatus]}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                          {colLabels[colStatus]}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${colHeaderColorClasses[colStatus]}`}>
                          {colLeads.length}
                        </span>
                      </div>

                      {/* Column Cards Container */}
                      <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-[480px] min-h-[120px]">
                        {colLeads.map((lead) => {
                          const initials = lead.client_name
                            ? lead.client_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                            : '?';
                          
                          // Dynamic initials color
                          const colorHash = lead.client_name.charCodeAt(0) % 5;
                          const badgeColors = [
                            'bg-amber-100 text-amber-700',
                            'bg-blue-100 text-blue-700',
                            'bg-green-100 text-green-700',
                            'bg-purple-100 text-purple-700',
                            'bg-rose-100 text-rose-700'
                          ][colorHash];

                          return (
                            <div
                              key={lead.id}
                              draggable={hasPermission('crm.manage')}
                              onDragStart={(e) => handleDragStartKanban(e, lead.id)}
                              className="bg-white p-3 rounded-xl border border-gray-100 shadow-xs hover:shadow-sm hover:border-gray-200 transition-all cursor-grab active:cursor-grabbing flex flex-col gap-2.5 relative group text-left"
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-bold text-gray-800 truncate leading-snug">{lead.client_name}</h4>
                                  <p className="text-[9px] text-gray-400 font-bold truncate mt-0.5">
                                    {lead.site_project || 'No project site details'}
                                  </p>
                                </div>
                                <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black ${badgeColors}`}>
                                  {initials}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[9px] text-gray-500 font-bold">
                                <span>₹{lead.quote_value ? (lead.quote_value / 100000).toFixed(1) + 'L' : '0'}</span>
                                <span className="text-[8px] bg-gray-50 border border-gray-100 px-1 py-0.5 rounded text-gray-400">
                                  {lead.ref_no}
                                </span>
                              </div>

                              {/* WhatsApp / Action badge */}
                              {lead.phone && (
                                <div className="flex items-center justify-between border-t border-gray-50 pt-2 text-[9px] font-bold">
                                  <span className="text-gray-400">{lead.created_date ? parseLocalDate(lead.created_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span>
                                  <a
                                    href={`https://api.whatsapp.com/send?phone=${String(lead.phone).replace(/[^\d]/g, '').length === 10 ? '91' + String(lead.phone).replace(/[^\d]/g, '') : String(lead.phone).replace(/[^\d]/g, '')}&text=${encodeURIComponent(
                                      `Hi ${lead.client_name || 'Customer'},\n\nThis is Apple Interior Manager following up regarding the quotation ${lead.ref_no} for your project at ${lead.site_project || 'your site'}.\n\nPlease let us know if you have any questions or feedback. Thanks!`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-1.5 py-0.5 rounded-md transition-colors flex items-center gap-0.5"
                                  >
                                    WhatsApp
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 1 col: Today's follow-ups sidebar widget */}
            <div className="flex flex-col gap-6">
              {/* Today's Follow-ups */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[280px] text-left">
                <div className="flex items-center justify-between mb-3.5">
                  <div>
                    <h3 className="text-xs uppercase font-black text-gray-400 tracking-widest">Today's follow-ups</h3>
                    <p className="text-[9px] text-gray-400 font-bold mt-0.5">
                      {dashboardFilteredLeads.filter(l => l.status === 'Follow-up').length} pending follow-ups
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setStatusFilter('Follow-up');
                      setActiveTab('log');
                    }}
                    className="text-[10px] text-yellow-600 hover:text-yellow-700 font-black hover:underline cursor-pointer"
                  >
                    View all
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 max-h-[320px]">
                  {dashboardFilteredLeads.filter(l => l.status === 'Follow-up').length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <span className="text-lg">🎉</span>
                      <p className="text-[10px] text-gray-400 font-bold mt-1">All follow-ups completed!</p>
                    </div>
                  ) : (
                    dashboardFilteredLeads.filter(l => l.status === 'Follow-up').map((lead) => {
                      const latestFollowUp = lead.follow_up_3 || lead.follow_up_2 || lead.follow_up_1 || 'No follow-up notes logged yet.';
                      const dateParsed = lead.created_date ? parseLocalDate(lead.created_date) : null;
                      const monthStr = dateParsed && !isNaN(dateParsed.getTime())
                        ? dateParsed.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                        : 'JUL';
                      const dayStr = dateParsed && !isNaN(dateParsed.getTime())
                        ? dateParsed.getDate()
                        : '16';

                      return (
                        <div key={lead.id} className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <div className="w-10 h-10 rounded-lg bg-yellow-50 border border-yellow-100 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[8px] font-black text-yellow-600 leading-none">{monthStr}</span>
                            <span className="text-xs font-black text-yellow-800 mt-0.5 leading-none">{dayStr}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-gray-900 truncate">{lead.client_name}</h4>
                            <p className="text-[9px] text-gray-400 font-bold truncate mt-0.5">{latestFollowUp}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Compact Monthly Breakdown Table */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-left">
                <h3 className="text-xs uppercase font-black text-gray-400 tracking-widest mb-3">🗓️ Monthly Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 uppercase font-black text-[9px]">
                        <th className="py-2">Month</th>
                        <th className="py-2 text-center">Quotes</th>
                        <th className="py-2 text-right">Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[11px]">
                      {monthlyBreakdown.slice(0, 4).map((row) => (
                        <tr key={row.monthStr} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2 font-bold text-gray-700">{row.monthStr}</td>
                          <td className="py-2 text-center font-medium text-gray-900">{row.quotes}</td>
                          <td className="py-2 text-right font-black text-gray-950">
                            {formatLakhs(row.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // QUOTATION LOG SHEET VIEW
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[70vh]">
          
          {/* SHEET TOOLBAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center flex-wrap gap-2">
              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-2.5 text-gray-400 h-4.5 w-4.5" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 w-44 sm:w-56 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-yellow-500 text-gray-700"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-yellow-500"
              >
                <option value="all">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <FiDownload className="h-3.5 w-3.5" /> Export
              </button>

              {hasPermission('crm.manage') && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportExcel}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <FiUpload className="h-3.5 w-3.5" /> Import
                  </button>
                  <button
                    onClick={handleOpenMobileEdit}
                    disabled={!selectedCell}
                    className={`px-3 py-1.5 font-bold rounded-lg text-xs flex items-center gap-1.5 border transition-all ${
                      selectedCell 
                        ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 cursor-pointer active:scale-95' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <FiEdit className="h-3.5 w-3.5" /> Edit Details
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedCell) return;
                      const lead = filteredLeads[selectedCell.rowIndex];
                      if (lead) setQuotationLead(lead);
                    }}
                    disabled={!selectedCell}
                    className={`px-3 py-1.5 font-bold rounded-lg text-xs flex items-center gap-1.5 border transition-all ${
                      selectedCell 
                        ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700 cursor-pointer active:scale-95 shadow-sm font-black' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    📄 {(() => {
                      if (!selectedCell) return 'Quotation';
                      const lead = filteredLeads[selectedCell.rowIndex];
                      return lead?.latest_quotation_id ? `Quotation (v${lead.quote_version || 1})` : 'Create Quotation';
                    })()}
                  </button>
                  <button
                    onClick={handleAddLead}
                    className="px-3.5 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <FiPlus className="h-4 w-4" /> Add Lead
                  </button>
                  <button
                    onClick={handleDeleteLead}
                    disabled={!selectedCell}
                    className={`px-3 py-1.5 font-bold rounded-lg text-xs flex items-center gap-1.5 border transition-all ${
                      selectedCell 
                        ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600 cursor-pointer active:scale-95' 
                        : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <FiTrash2 className="h-3.5 w-3.5" /> Delete Row
                  </button>
                </>
              )}
            </div>
          </div>

          {/* FORMULA BAR (Like Google Sheets) */}
          <div className="flex items-center border-b border-gray-200 bg-white text-xs px-2.5 py-1.5">
            <div className="flex items-center bg-gray-100 border border-gray-200 px-2 py-1 rounded font-bold text-gray-500 w-36 text-center select-none shrink-0 shadow-inner">
              <span className="text-[10px] text-gray-400 mr-1.5 font-black uppercase">Cell:</span>
              <span className="text-gray-800 text-[11px]">{selectedCell ? activeCellAddress : 'None'}</span>
            </div>
            
            <div className="text-gray-400 font-serif italic text-sm font-bold px-3 select-none shrink-0">fx</div>
            
            <input
              type="text"
              disabled={!selectedCell || !hasPermission('crm.manage')}
              value={isEditing ? editValue : (selectedCell ? activeCellValue : '')}
              onChange={(e) => {
                if (!selectedCell) return;
                setIsEditing(true);
                setEditValue(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  finishEditCell();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                }
              }}
              onBlur={finishEditCell}
              placeholder="Select a cell or edit cell value directly..."
              className="flex-1 bg-gray-50 focus:bg-white border border-transparent focus:border-yellow-300 rounded px-2 py-1 text-gray-700 font-medium focus:outline-none placeholder-gray-400 text-xs transition-colors h-7"
            />
          </div>

          {/* SHEET GRID CONTAINER */}
          <div className="flex-1 overflow-auto max-w-full">
            <table 
              ref={tableRef}
              className="w-full text-left border-collapse border-spacing-0 text-xs select-none"
              style={{ tableLayout: 'fixed' }}
            >
              <thead>
                <tr className="bg-gray-100 text-gray-500 font-bold select-none text-center divide-x divide-gray-200 sticky top-0 z-20">
                  {/* Left row index header spacer with checkbox */}
                  <th className="w-10 bg-gray-200 border-b border-gray-300 text-center py-1.5 align-middle select-none">
                    <input
                      type="checkbox"
                      checked={filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                      ref={el => {
                        if (el) {
                          el.indeterminate = selectedLeadIds.length > 0 && selectedLeadIds.length < filteredLeads.length;
                        }
                      }}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeadIds(filteredLeads.map(l => l.id));
                        } else {
                          setSelectedLeadIds([]);
                        }
                      }}
                      className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 cursor-pointer h-3.5 w-3.5 align-middle"
                    />
                  </th>
                  {columns.map((col, idx) => (
                    <th 
                      key={col.id} 
                      className="py-1.5 border-b border-gray-300 text-gray-600 text-[11px] font-black uppercase shadow-sm relative group/resize select-none"
                      style={{ width: columnWidths[col.id] }}
                    >
                      {String.fromCharCode(65 + idx)} {/* A, B, C... */}
                      <span className="block text-[9px] text-gray-400 tracking-wider font-bold capitalize mt-0.5">{col.label}</span>
                      
                      {/* Resize Handle */}
                      <div
                        onMouseDown={(e) => handleResizeStart(e, col.id)}
                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-yellow-400/80 active:bg-yellow-500 z-10 select-none transition-all"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="py-8 text-center text-gray-400 font-bold">
                      No quotation log entries match your search/filters.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, rowIndex) => {
                    // Grouping header helper logic (e.g. May 2026 grouping just like the sheet screenshot)
                    const date = parseLocalDate(lead.created_date);
                    const prevLead = rowIndex > 0 ? filteredLeads[rowIndex - 1] : null;
                    const prevDate = prevLead ? parseLocalDate(prevLead.created_date) : null;
                    
                    const isNewMonthGroup = !prevLead || !prevDate || 
                      (isNaN(date.getTime()) !== isNaN(prevDate.getTime())) ||
                      (!isNaN(date.getTime()) && (date.getMonth() !== prevDate.getMonth() || date.getFullYear() !== prevDate.getFullYear()));
                    
                    const months = [
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ];
                    
                    const monthGroupName = !isNaN(date.getTime()) 
                      ? `${months[date.getMonth()]} ${date.getFullYear()}` 
                      : 'Unscheduled';

                    return (
                      <Fragment key={lead.id}>
                        {/* Render Month Divider Row */}
                        {isNewMonthGroup && (
                          <tr 
                            onClick={() => toggleMonthCollapse(monthGroupName)}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-black select-none border-y border-amber-600 text-[11px] uppercase tracking-wider cursor-pointer transition-colors"
                          >
                            <td className="w-10 bg-amber-600 text-center py-1 font-bold text-xs">
                              {collapsedMonths[monthGroupName] ? '+' : '-'}
                            </td>
                            <td colSpan={columns.length} className="px-4 py-1.5">
                              {monthGroupName}
                            </td>
                          </tr>
                        )}

                        <tr className={`${collapsedMonths[monthGroupName] ? 'hidden' : ''} ${getRowAlertClass(lead) || 'hover:bg-gray-50/30'} transition-colors divide-x divide-gray-200`}>
                          {/* Row Index / Sl. No. / Checkbox */}
                          <td 
                            className="w-10 text-center font-black text-gray-400 bg-gray-50 border-r border-gray-300 py-2 select-none align-middle cursor-pointer group/select" 
                            style={{ verticalAlign: 'middle' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLeadIds(prev => 
                                prev.includes(lead.id) ? prev.filter(id => id !== lead.id) : [...prev, lead.id]
                              );
                            }}
                          >
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={selectedLeadIds.includes(lead.id)}
                                onChange={() => {}} // toggled by cell onClick
                                className={`rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 cursor-pointer h-3.5 w-3.5 ${
                                  selectedLeadIds.includes(lead.id) ? 'block' : 'hidden group-hover/select:block'
                                }`}
                              />
                              <span className={selectedLeadIds.includes(lead.id) ? 'hidden' : 'block group-hover/select:hidden text-[10px]'}>
                                {rowIndex + 1}
                              </span>
                            </div>
                          </td>

                          {columns.map((col, colIndex) => {
                            const isCellSelected = selectedCell?.rowIndex === rowIndex && selectedCell?.colIndex === colIndex;
                            const isCellEditing = isCellSelected && isEditing;
                            const cellValue = lead[col.id as keyof Lead];

                            return (
                              <td
                                key={col.id}
                                ref={isCellSelected ? selectedCellRef : undefined}
                                onClick={() => {
                                  if (isCellSelected) return;
                                  setSelectedCell({ rowIndex, colIndex });
                                  setIsEditing(false);
                                }}
                                onDoubleClick={() => startEditCell(rowIndex, colIndex)}
                                className={`px-2 py-1.5 relative select-none align-middle transition-colors cursor-cell ${
                                  col.id === 'site_project' || col.id === 'remarks' || col.id.startsWith('follow_up')
                                    ? 'whitespace-normal break-words'
                                    : 'truncate'
                                } ${
                                  isCellSelected && !isCellEditing ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/15' : ''
                                } ${col.id === 'ref_no' ? 'text-gray-400 font-bold text-center' : ''}`}
                                style={{ width: columnWidths[col.id], minHeight: '36px', verticalAlign: 'middle' }}
                              >
                                {isCellEditing ? (
                                  col.type === 'status' ? (
                                    <select
                                      ref={inputRef as unknown as React.Ref<HTMLSelectElement>}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={finishEditCell}
                                      onKeyDown={(e) => { if (e.key === 'Enter') finishEditCell(); }}
                                      className="absolute inset-0 w-full h-full bg-white border border-blue-500 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                                    >
                                      <option value="Draft">Draft</option>
                                      <option value="Sent">Sent</option>
                                      <option value="Follow-up">Follow-up</option>
                                      <option value="Approved">Approved</option>
                                      <option value="Rejected">Rejected</option>
                                      <option value="On Hold">On Hold</option>
                                    </select>
                                  ) : col.type === 'assignee' ? (
                                    <select
                                      ref={inputRef as unknown as React.Ref<HTMLSelectElement>}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={finishEditCell}
                                      onKeyDown={(e) => { if (e.key === 'Enter') finishEditCell(); }}
                                      className="absolute inset-0 w-full h-full bg-white border border-blue-500 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                                    >
                                      {assigneeOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      ref={inputRef}
                                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={finishEditCell}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') finishEditCell();
                                        if (e.key === 'Escape') setIsEditing(false);
                                      }}
                                      className="absolute inset-0 w-full h-full bg-white border border-blue-500 rounded px-1.5 py-0.5 text-xs focus:outline-none"
                                    />
                                  )
                                ) : (
                                  col.type === 'status' ? (
                                    <span className={`px-2 py-0.5 text-[10px] font-black border uppercase rounded-md shadow-2xs ${getStatusBadgeClass(cellValue as string)}`}>
                                      {cellValue}
                                    </span>
                                  ) : col.type === 'number' ? (
                                    col.id.includes('value') ? (
                                      <span className="font-bold text-gray-800">
                                        ₹{cellValue ? Number(cellValue).toLocaleString('en-IN') : '0'}
                                      </span>
                                    ) : (
                                      <span>{cellValue || '0'}</span>
                                    )
                                  ) : col.type === 'date' ? (
                                    <span className="text-gray-500 font-medium">
                                      {cellValue ? parseLocalDate(cellValue as string).toLocaleDateString('en-GB') : '-'}
                                    </span>
                                  ) : col.id === 'phone' ? (
                                     <div className="flex items-center justify-between group/phone min-w-[80px]">
                                       <span className="text-gray-800 font-medium">{cellValue || '-'}</span>
                                       {cellValue && (
                                         <a
                                           href={`https://api.whatsapp.com/send?phone=${String(cellValue).replace(/[^\d]/g, '').length === 10 ? '91' + String(cellValue).replace(/[^\d]/g, '') : String(cellValue).replace(/[^\d]/g, '')}&text=${encodeURIComponent(
                                             `Hi ${lead.client_name || 'Customer'},\n\nThis is Apple Interior Manager following up regarding the quotation ${lead.ref_no} for your project at ${lead.site_project || 'your site'}.\n\nPlease let us know if you have any questions or feedback. Thanks!`
                                           )}`}
                                           target="_blank"
                                           rel="noopener noreferrer"
                                           title="Send WhatsApp Follow-up"
                                           onClick={(e) => e.stopPropagation()}
                                           className="text-emerald-500 hover:text-emerald-600 transition-colors p-1 rounded hover:bg-emerald-50 opacity-0 group-hover/phone:opacity-100 focus:opacity-100 shrink-0"
                                         >
                                           <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                             <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.89 9.884-.001 2.224.587 4.393 1.697 6.14l-.998 3.645 3.791-.984zm11.033-5.74c-.26-.13-1.534-.757-1.771-.842-.236-.085-.408-.13-.578.13-.171.26-.66.842-.81 1.01-.15.17-.3.19-.56.06-.26-.13-1.097-.404-2.09-1.288-.773-.69-1.295-1.543-1.447-1.802-.152-.26-.016-.4.117-.53.12-.117.26-.305.39-.457.13-.15.172-.26.26-.43.089-.17.044-.325-.022-.455-.067-.13-.578-1.393-.792-1.907-.21-.5-.436-.43-.598-.43h-.514c-.17 0-.447.064-.68.314-.233.25-.89.87-8.9 2.12s.93 2.47 1.056 2.64c.127.17 1.83 2.796 4.434 3.92.62.268 1.103.428 1.481.548.624.2 1.193.171 1.642.105.502-.075 1.534-.627 1.749-1.233.215-.607.215-1.127.151-1.233-.064-.105-.236-.17-.497-.3z"/>
                                           </svg>
                                         </a>
                                       )}
                                     </div>
                                   ) : col.id === 'ref_no' ? (
                                     <div className="flex items-center justify-between group/ref w-full px-1">
                                       <span className="text-gray-400 font-bold">{cellValue || '-'}</span>
                                       {lead.latest_quotation_id && (
                                         <button
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             window.open(`/quotations/${lead.latest_quotation_id}/print`, '_blank');
                                           }}
                                           title={`Print/Preview Quotation (v${lead.quote_version || 1})`}
                                           className="text-yellow-600 hover:text-yellow-700 p-0.5 rounded hover:bg-yellow-50 opacity-0 group-hover/ref:opacity-100 focus:opacity-100 transition-all shrink-0"
                                         >
                                           <FiPrinter size={12} />
                                         </button>
                                       )}
                                     </div>
                                   ) : (
                                    <span className="text-gray-800 font-medium">{cellValue || '-'}</span>
                                  )
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* FLOATING BULK ACTIONS BANNER */}
          {selectedLeadIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white py-3.5 px-6 rounded-2xl border border-gray-800 shadow-2xl flex items-center justify-between gap-6 z-50 transition-all max-w-[95vw] sm:max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black bg-yellow-500 text-gray-950 px-2 py-0.5 rounded-full">
                  {selectedLeadIds.length}
                </span>
                <span className="text-xs font-bold text-gray-300">leads selected</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Bulk Status Update */}
                <div className="relative flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBulkStatusChange(e.target.value as Lead['status']);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="bg-gray-800 text-white text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:border-yellow-500 cursor-pointer"
                  >
                    <option value="" disabled>Change Status...</option>
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Bulk Delete */}
                <button
                  onClick={handleBulkDelete}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <FiTrash2 size={13} /> Delete Selected
                </button>

                {/* Deselect All */}
                <button
                  onClick={() => setSelectedLeadIds([])}
                  className="text-xs text-gray-400 hover:text-white font-bold ml-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* SPREADSHEET BOTTOM BAR STATS SUMMARY FOR SELECTED CELLS */}
          <div className="bg-gray-100 border-t border-gray-300 py-1.5 px-3 flex items-center justify-between text-[11px] font-bold text-gray-500 select-none">
            <div className="flex items-center gap-1">
              <span>Sheet:</span>
              <span className="text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100">Quotation Log</span>
            </div>

            {/* Calculations summaries shown when selecting numbers */}
            {selectedCell && (
              <div className="flex items-center gap-4 bg-white border border-gray-200 px-3 py-0.5 rounded-lg shadow-2xs">
                {(() => {
                  const col = columns[selectedCell.colIndex];
                  if (col.type === 'number') {
                    const colLeads = filteredLeads.map(l => Number(l[col.id as keyof Lead]) || 0);
                    const sum = colLeads.reduce((a, b) => a + b, 0);
                    const avg = colLeads.length > 0 ? sum / colLeads.length : 0;
                    return (
                      <>
                        <span>SUM: <strong className="text-gray-800">₹{Math.round(sum).toLocaleString('en-IN')}</strong></span>
                        <span>AVG: <strong className="text-gray-800">₹{Math.round(avg).toLocaleString('en-IN')}</strong></span>
                        <span>COUNT: <strong className="text-gray-800">{colLeads.length}</strong></span>
                      </>
                    );
                  }
                  return (
                    <span>COUNT: <strong className="text-gray-800">{filteredLeads.length}</strong></span>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Editor Bottom Sheet */}
      <BottomSheet
        isOpen={isMobileEditOpen}
        onClose={() => setIsMobileEditOpen(false)}
        title={mobileEditForm ? `Edit Lead Details: ${mobileEditForm.ref_no || 'New'}` : 'Edit Lead Details'}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setIsMobileEditOpen(false)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMobileEdit}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-all"
            >
              Save Changes
            </button>
          </div>
        }
      >
        {mobileEditForm && (
          <div className="space-y-4 text-xs font-medium text-gray-700">
            {/* Row 1: Date & Client Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={mobileEditForm.created_date || ''}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, created_date: e.target.value } : null)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Client Name</label>
                <input
                  type="text"
                  value={mobileEditForm.client_name || ''}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, client_name: e.target.value } : null)}
                  placeholder="Client name"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            {/* Row 2: Phone & Site / Project */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Phone</label>
                <input
                  type="text"
                  value={mobileEditForm.phone || ''}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  placeholder="Phone number"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Site / Project</label>
                <input
                  type="text"
                  value={mobileEditForm.site_project || ''}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, site_project: e.target.value } : null)}
                  placeholder="Project specifications"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            {/* Row 3: Area (sqft) & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Area (sq.ft)</label>
                <input
                  type="number"
                  value={mobileEditForm.area_sqft || 0}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, area_sqft: Number(e.target.value) || 0 } : null)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Status</label>
                <select
                  value={mobileEditForm.status || 'Draft'}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, status: e.target.value as Lead['status'] } : null)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-gray-700"
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>
            </div>

            {/* Row 4: Quote Value & Approved Value */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Quote Value (₹)</label>
                <input
                  type="number"
                  value={mobileEditForm.quote_value || 0}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, quote_value: Number(e.target.value) || 0 } : null)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Approved Value (₹)</label>
                <input
                  type="number"
                  value={mobileEditForm.approved_value || 0}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, approved_value: Number(e.target.value) || 0 } : null)}
                  disabled={mobileEditForm.status !== 'Approved'}
                  className={`w-full p-2 border rounded-lg focus:outline-none focus:border-yellow-500 ${
                    mobileEditForm.status === 'Approved' ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            {/* Row 5: Assigned By */}
            <div>
              <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Assigned By / Lead Source</label>
              <select
                value={mobileEditForm.assigned_by || ''}
                onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, assigned_by: e.target.value } : null)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 text-gray-700"
              >
                <option value="">Select Assignee</option>
                {assigneeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Row 6: Follow Ups 1, 2, 3 */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-black text-gray-400">Follow-up Notes</label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={mobileEditForm.follow_up_1 || ''}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, follow_up_1: e.target.value } : null)}
                  placeholder="Follow-up note 1"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500"
                />
                <input
                  type="text"
                  value={mobileEditForm.follow_up_2 || ''}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, follow_up_2: e.target.value } : null)}
                  placeholder="Follow-up note 2"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500"
                />
                <input
                  type="text"
                  value={mobileEditForm.follow_up_3 || ''}
                  onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, follow_up_3: e.target.value } : null)}
                  placeholder="Follow-up note 3"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            {/* Row 7: Remarks */}
            <div>
              <label className="block text-[10px] uppercase font-black text-gray-400 mb-1">Remarks</label>
              <textarea
                value={mobileEditForm.remarks || ''}
                onChange={(e) => setMobileEditForm(prev => prev ? { ...prev, remarks: e.target.value } : null)}
                placeholder="General comments or remarks..."
                rows={2}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-500 resize-none"
              />
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Quotation Builder Modal */}
      {quotationLead && (
        <QuotationBuilder
          lead={quotationLead}
          onClose={() => setQuotationLead(null)}
          onSaved={(newQuoteValue) => {
            setLeads(prev => prev.map(l =>
              l.id === quotationLead.id ? { ...l, quote_value: newQuoteValue } : l
            ));
            setQuotationLead(null);
          }}
        />
      )}
    </div>
  );
}
