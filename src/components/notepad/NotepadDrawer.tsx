'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FiFileText, FiPlus, FiTrash2, FiCopy, FiDownload,
  FiCheck, FiSearch, FiX, FiChevronLeft, FiEdit3,
  FiCalendar, FiClock, FiAlertCircle, FiDatabase, FiCloudOff
} from 'react-icons/fi';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface NotepadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotepadDrawer({ isOpen, onClose }: NotepadDrawerProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | null>('saved');
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Database Connection States
  const [dbStatus, setDbStatus] = useState<'loading' | 'connected' | 'table_missing' | 'offline'>('loading');
  const [tableMissingMessage, setTableMissingMessage] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load: Fetch from database or fall back to localStorage
  useEffect(() => {
    if (!isOpen) return;

    // Load from local storage immediately for SWR (Stale-While-Revalidate) instant load!
    const stored = localStorage.getItem('apple_site_notepad_notes');
    let hasLoadedLocal = false;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
          setActiveNoteId(parsed[0].id);
          hasLoadedLocal = true;
        }
      } catch { }
    }
    if (!hasLoadedLocal) {
      createDefaultNoteFallback();
    }

    const loadNotes = async () => {
      try {
        const res = await fetch('/api/notepad?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          const dbNotes = data.notes.map((n: any) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            updatedAt: n.updated_at || n.created_at
          }));
          setNotes(dbNotes);
          
          // Only update active note if the current active note ID is no longer present
          if (dbNotes.length > 0) {
            setActiveNoteId((prevId) => {
              if (prevId && dbNotes.some((dn: any) => dn.id === prevId)) {
                return prevId;
              }
              return dbNotes[0].id;
            });
          }
          setDbStatus('connected');
          
          // Sync to local storage as backup cache
          localStorage.setItem('apple_site_notepad_notes', JSON.stringify(dbNotes));
        } else if (res.status === 404) {
          const data = await res.json();
          if (data.error === 'database_table_missing') {
            setDbStatus('table_missing');
            setTableMissingMessage(data.message);
          } else {
            setDbStatus('offline');
          }
        } else {
          setDbStatus('offline');
        }
      } catch (err) {
        console.error('Error fetching notes from cloud:', err);
        setDbStatus('offline');
      }
    };

    loadNotes();
  }, [isOpen]);



  // Create default fallback notes
  const createDefaultNoteFallback = () => {
    const defaultNote: Note = {
      id: 'default-note-1',
      title: 'Quick Scratchpad',
      content: 'Welcome to your premium Notepad!\n\nUse this space to log site details, material measurements, customer requests, or quick reminders without navigating away.\n\n💡 Try using the formatting helper buttons below to add task checklists or timestamps instantly!',
      updatedAt: new Date().toISOString()
    };
    setNotes([defaultNote]);
    setActiveNoteId(defaultNote.id);
  };

  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  // Auto-switch to editor view on mobile if a note becomes active
  useEffect(() => {
    if (activeNoteId && typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileView('editor');
    }
  }, [activeNoteId]);

  // Focus title input when editing
  useEffect(() => {
    if (editingTitleId && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [editingTitleId]);

  // Handle keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Create a new note
  const handleCreateNote = async () => {
    const newNoteObj = {
      title: `Note ${notes.length + 1}`,
      content: ''
    };

    // 1. Optimistic UI update locally
    const tempId = `temp-note-${Date.now()}`;
    const optimisticNote: Note = {
      id: tempId,
      title: newNoteObj.title,
      content: newNoteObj.content,
      updatedAt: new Date().toISOString()
    };
    const updated = [optimisticNote, ...notes];
    setNotes(updated);
    setActiveNoteId(tempId);
    setMobileView('editor');
    setEditingTitleId(tempId);
    setTempTitle(newNoteObj.title);

    // 2. Sync to Database
    if (dbStatus === 'connected') {
      try {
        const res = await fetch('/api/notepad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newNoteObj)
        });
        if (res.ok) {
          const data = await res.json();
          // Update temp ID with real DB UUID
          const savedNote: Note = {
            id: data.note.id,
            title: data.note.title,
            content: data.note.content,
            updatedAt: data.note.updated_at || data.note.created_at
          };
          const syncedList = updated.map(n => n.id === tempId ? savedNote : n);
          setNotes(syncedList);
          setActiveNoteId(savedNote.id);
          setEditingTitleId(savedNote.id);
          localStorage.setItem('apple_site_notepad_notes', JSON.stringify(syncedList));
        }
      } catch (err) {
        console.error('Failed to sync new note to DB:', err);
      }
    } else {
      localStorage.setItem('apple_site_notepad_notes', JSON.stringify(updated));
    }
  };

  // Debounced auto-save content changes to database
  const handleContentChange = (content: string) => {
    if (!activeNoteId) return;

    // 1. Update local state instantly
    const updated = notes.map(n => {
      if (n.id === activeNoteId) {
        return { ...n, content, updatedAt: new Date().toISOString() };
      }
      return n;
    });
    setNotes(updated);
    localStorage.setItem('apple_site_notepad_notes', JSON.stringify(updated));

    // 2. Debounce database cloud save
    if (dbStatus === 'connected' && !activeNoteId.startsWith('temp-')) {
      setSaveStatus('saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch('/api/notepad', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: activeNoteId, content })
          });
          if (res.ok) {
            setSaveStatus('saved');
          } else {
            setSaveStatus(null);
          }
        } catch {
          setSaveStatus(null);
        }
      }, 600); // 600ms delay after user stops typing
    } else {
      setSaveStatus('saved');
    }
  };

  // Delete note
  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = notes.filter(n => n.id !== id);
    setShowDeleteConfirm(null);

    // 1. Optimistic UI update locally
    if (remaining.length > 0) {
      setNotes(remaining);
      if (activeNoteId === id) {
        setActiveNoteId(remaining[0].id);
      }
      localStorage.setItem('apple_site_notepad_notes', JSON.stringify(remaining));
    } else {
      // Re-create default if all deleted
      const defaultNote: Note = {
        id: `note-${Date.now()}`,
        title: 'Quick Scratchpad',
        content: '',
        updatedAt: new Date().toISOString()
      };
      setNotes([defaultNote]);
      setActiveNoteId(defaultNote.id);
      localStorage.setItem('apple_site_notepad_notes', JSON.stringify([defaultNote]));
    }
    setMobileView('list');

    // 2. DB delete sync
    if (dbStatus === 'connected' && !id.startsWith('temp-')) {
      try {
        await fetch(`/api/notepad?id=${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete note in database:', err);
      }
    }
  };

  // Start renaming note title
  const startRenaming = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(note.id);
    setTempTitle(note.title);
  };

  // Save renamed note title
  const saveTitle = async (id: string) => {
    if (!tempTitle.trim()) {
      setEditingTitleId(null);
      return;
    }

    const updated = notes.map(n => {
      if (n.id === id) {
        return { ...n, title: tempTitle.trim(), updatedAt: new Date().toISOString() };
      }
      return n;
    });
    setNotes(updated);
    setEditingTitleId(null);
    localStorage.setItem('apple_site_notepad_notes', JSON.stringify(updated));

    // DB rename sync
    if (dbStatus === 'connected' && !id.startsWith('temp-')) {
      setSaveStatus('saving');
      try {
        const res = await fetch('/api/notepad', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, title: tempTitle.trim() })
        });
        if (res.ok) {
          setSaveStatus('saved');
        } else {
          setSaveStatus(null);
        }
      } catch {
        setSaveStatus(null);
      }
    }
  };

  // Text inserting helpers for tactile typing on mobile
  const insertTextAtCursor = (textToInsert: string) => {
    if (!activeNote || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent =
      activeNote.content.substring(0, start) +
      textToInsert +
      activeNote.content.substring(end);

    handleContentChange(newContent);

    // Restore focus and cursor selection position
    setTimeout(() => {
      textarea.focus();
      const newPos = start + textToInsert.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 50);
  };

  // Format Helper: Timestamp
  const handleAddTimestamp = () => {
    const now = new Date();
    const formatted = now.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    insertTextAtCursor(`[${formatted}] `);
  };

  // Copy Clipboard
  const [copied, setCopied] = useState(false);
  const handleCopyNote = () => {
    if (!activeNote) return;
    navigator.clipboard.writeText(activeNote.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Export File
  const handleDownloadNote = () => {
    if (!activeNote) return;
    const element = document.createElement('a');
    const file = new Blob([activeNote.content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `${activeNote.title.toLowerCase().replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Search Filter
  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[100] transition-opacity duration-300 animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Main Drawer Container - Full screen on mobile, elegant drawer on desktop */}
      <div
        className={`
          fixed inset-y-0 right-0 w-full md:w-[640px] bg-white shadow-2xl z-[101] flex flex-col
          transition-transform duration-300 ease-in-out h-[100dvh] overflow-hidden
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header bar */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500 text-white flex items-center justify-center">
              <FiFileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Scratchpad Notepad</h2>
              <p className="text-[10px] font-semibold text-gray-400">
                {dbStatus === 'connected' ? 'Cloud database synced' : 'Local browser fallback'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-save Badge */}
            {saveStatus === 'saving' && (
              <span className="text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full animate-pulse border border-yellow-100">
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-[10px] font-extrabold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-0.5">
                <FiCheck className="w-2.5 h-2.5" /> Synced
              </span>
            )}

            <button
              onClick={onClose}
              className="no-touch-target min-w-0 flex items-center justify-center w-8 h-8 p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Close notepad"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Database Connectivity Banners */}
        {dbStatus === 'table_missing' && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 flex flex-col gap-1 text-rose-700 text-[10px] shrink-0 font-medium select-none animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5 font-bold">
              <FiDatabase /> Cloud sync unavailable: Table missing in database
            </div>
            <p className="leading-relaxed text-rose-600">
              Please execute the SQL script in <code className="bg-rose-100/60 px-1 rounded font-bold font-mono">supabase/migrations/notepad_notes.sql</code> in your Supabase SQL Editor. Notes will save locally in your browser for now!
            </p>
          </div>
        )}

        {/* Dual Layout Panel: Sidebar (Note Directory) + Editor */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Note List / Directory (Shown on Desktop, toggled on Mobile) */}
          <div
            className={`
              w-full md:w-56 border-r border-gray-100 bg-gray-50/50 flex flex-col shrink-0 overflow-y-auto
              absolute md:relative inset-0 z-10 transition-transform duration-300 md:translate-x-0
              ${mobileView === 'list' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
          >
            {/* Search Input */}
            <div className="p-3 border-b border-gray-150 shrink-0">
              <div className="relative">
                <FiSearch className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 font-medium"
                />
              </div>
            </div>

            {/* Note List Item */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                onClick={handleCreateNote}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-yellow-600 bg-yellow-50/50 hover:bg-yellow-50 border border-dashed border-yellow-300 rounded-lg transition-colors mb-2 touch-target"
              >
                <FiPlus className="w-3.5 h-3.5" />
                New Note Entry
              </button>

              {filteredNotes.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No notes found.
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isActive = note.id === activeNoteId;
                  const isRenaming = note.id === editingTitleId;
                  const isConfirmingDelete = showDeleteConfirm === note.id;

                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        setActiveNoteId(note.id);
                        setMobileView('editor');
                      }}
                      className={`
                        w-full text-left p-2.5 rounded-lg transition-all duration-200 cursor-pointer flex flex-col gap-1 relative border select-none group
                        ${isActive
                          ? 'bg-white border-yellow-200 shadow-xs ring-1 ring-yellow-400/20'
                          : 'border-transparent hover:bg-gray-100 hover:border-gray-200'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {isRenaming ? (
                          <input
                            ref={titleInputRef}
                            type="text"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={() => saveTitle(note.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveTitle(note.id);
                              if (e.key === 'Escape') setEditingTitleId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold border border-yellow-500 rounded px-1.5 py-0.5 bg-white focus:outline-none w-full"
                          />
                        ) : (
                          <span className={`text-xs font-semibold truncate ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                            {note.title}
                          </span>
                        )}

                        {/* Inline renaming / deleting actions */}
                        {!isRenaming && !isConfirmingDelete && (
                          <div className="flex md:hidden md:group-hover:flex items-center gap-1 shrink-0 bg-transparent">
                            <button
                              onClick={(e) => startRenaming(note, e)}
                              className="no-touch-target min-w-0 flex items-center justify-center w-6 h-6 p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-800"
                              title="Rename note"
                            >
                              <FiEdit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(note.id);
                              }}
                              className="no-touch-target min-w-0 flex items-center justify-center w-6 h-6 p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                              title="Delete note"
                            >
                              <FiTrash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Delete confirmation helper overlay */}
                      {isConfirmingDelete && (
                        <div className="absolute inset-0 bg-red-50/95 backdrop-blur-xs flex items-center justify-between px-2.5 rounded-lg z-20">
                          <span className="text-[10px] font-extrabold text-red-600 flex items-center gap-0.5">
                            <FiAlertCircle className="w-3 h-3" /> Delete?
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => handleDeleteNote(note.id, e)}
                              className="px-2 py-0.5 text-[9px] font-bold text-white bg-red-500 hover:bg-red-600 rounded"
                            >
                              Yes
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(null);
                              }}
                              className="px-2 py-0.5 text-[9px] font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded"
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-gray-400 line-clamp-1 truncate font-medium">
                        {note.content.substring(0, 36) || '(Empty note)'}
                      </p>

                      <div className="flex items-center gap-1 mt-0.5 text-[8px] font-bold text-gray-400 shrink-0">
                        <FiClock className="w-2.5 h-2.5" />
                        <span>
                          {new Date(note.updatedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Note Editor View */}
          <div
            className={`
              flex-1 flex flex-col bg-white h-full relative overflow-hidden transition-transform duration-300
              ${mobileView === 'editor' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
            `}
          >
            {activeNote ? (
              <div className="flex-1 flex flex-col overflow-hidden h-full">
                
                {/* Editor Header controls */}
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white select-none">
                  {/* Mobile Back to List Button */}
                  <button
                    onClick={() => setMobileView('list')}
                    className="md:hidden flex items-center gap-1 text-xs font-bold text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100/80 px-2.5 py-1.5 rounded-lg transition-colors border border-yellow-200/50"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                    All Notes
                  </button>

                  {/* Desktop active note indicator */}
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-500">
                    <FiFileText className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="font-bold text-gray-700 max-w-[150px] truncate">{activeNote.title}</span>
                  </div>

                  {/* Quick Editor Actions */}
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={handleCopyNote}
                      className={`no-touch-target min-w-0 flex items-center justify-center w-8 h-8 hover:bg-gray-100 rounded-lg transition-colors ${copied ? 'text-green-600 bg-green-50 hover:bg-green-50' : 'text-gray-500 hover:text-gray-800'}`}
                      title="Copy to clipboard"
                    >
                      {copied ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={handleDownloadNote}
                      className="no-touch-target min-w-0 flex items-center justify-center w-8 h-8 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors"
                      title="Export as .txt"
                    >
                      <FiDownload className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete this note ("${activeNote.title}")?`)) {
                          handleDeleteNote(activeNote.id, e);
                        }
                      }}
                      className="no-touch-target min-w-0 flex items-center justify-center w-8 h-8 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete this note"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tactile Formatting Helper Toolbar - EXTREMELY mobile friendly */}
                <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-150 flex gap-2 overflow-x-auto shrink-0 select-none no-scrollbar">
                  <button
                    onClick={() => insertTextAtCursor('- ')}
                    className="shrink-0 px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-gray-600 flex items-center gap-1 shadow-2xs hover:shadow-xs active:bg-gray-150 active:translate-y-0.5"
                  >
                    • Bullet Point
                  </button>
                  <button
                    onClick={() => insertTextAtCursor('[ ] ')}
                    className="shrink-0 px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-gray-600 flex items-center gap-1 shadow-2xs hover:shadow-xs active:bg-gray-150 active:translate-y-0.5"
                  >
                    ☑ Checkbox
                  </button>
                  <button
                    onClick={handleAddTimestamp}
                    className="shrink-0 px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded text-[10px] font-bold text-gray-600 flex items-center gap-1 shadow-2xs hover:shadow-xs active:bg-gray-150 active:translate-y-0.5"
                  >
                    <FiCalendar className="w-3 h-3 text-yellow-500" /> Date Stamp
                  </button>
                </div>

                {/* Editor Text Area - Auto-fits viewport height */}
                <div className="flex-1 p-4 overflow-hidden flex flex-col bg-white">
                  <textarea
                    ref={textareaRef}
                    value={activeNote.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Start typing your details here..."
                    className="w-full flex-1 resize-none border-0 p-0 focus:outline-none focus:ring-0 text-sm leading-relaxed text-gray-800 placeholder-gray-400 font-medium"
                    style={{ minHeight: '0px' }}
                  />
                </div>

                {/* Editor Footer Info Bar */}
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-[9px] font-bold text-gray-400 shrink-0 select-none">
                  <div>
                    Last updated:{' '}
                    {new Date(activeNote.updatedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </div>
                  <div>
                    {activeNote.content.trim().split(/\s+/).filter(Boolean).length} Words •{' '}
                    {activeNote.content.length} Chars
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
                <FiFileText className="w-12 h-12 text-gray-200 mb-2" />
                <p className="text-xs">No active note selected.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
