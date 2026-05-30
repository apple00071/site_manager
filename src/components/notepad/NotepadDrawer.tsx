'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FiFileText, FiPlus, FiTrash2, FiCopy, FiDownload,
  FiCheck, FiSearch, FiX, FiChevronLeft, FiEdit3,
  FiCalendar, FiList, FiClock, FiAlertCircle
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // 1. Initialize notes from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('apple_site_notepad_notes');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotes(parsed);
            setActiveNoteId(parsed[0].id);
          } else {
            createDefaultNote();
          }
        } catch {
          createDefaultNote();
        }
      } else {
        createDefaultNote();
      }
    }
  }, []);

  // Create default initial note
  const createDefaultNote = () => {
    const defaultNote: Note = {
      id: 'default-note-1',
      title: 'Quick Scratchpad',
      content: 'Welcome to your premium Notepad!\n\nUse this space to log site details, material measurements, customer requests, or quick reminders without navigating away.\n\n💡 Try using the formatting helper buttons below to add task checklists or timestamps instantly!',
      updatedAt: new Date().toISOString()
    };
    setNotes([defaultNote]);
    setActiveNoteId(defaultNote.id);
    localStorage.setItem('apple_site_notepad_notes', JSON.stringify([defaultNote]));
  };

  // Find active note
  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  // Auto-switch to editor view on mobile if a note becomes active
  useEffect(() => {
    if (activeNoteId && window.innerWidth < 768) {
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
  const handleCreateNote = () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: `Note ${notes.length + 1}`,
      content: '',
      updatedAt: new Date().toISOString()
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    setActiveNoteId(newNote.id);
    setMobileView('editor');
    setEditingTitleId(newNote.id);
    setTempTitle(newNote.title);
    saveNotesToStorage(updated);
  };

  // Save notes helper
  const saveNotesToStorage = (updatedNotes: Note[]) => {
    setSaveStatus('saving');
    localStorage.setItem('apple_site_notepad_notes', JSON.stringify(updatedNotes));
    setTimeout(() => {
      setSaveStatus('saved');
    }, 400);
  };

  // Update note content
  const handleContentChange = (content: string) => {
    if (!activeNoteId) return;
    const updated = notes.map(n => {
      if (n.id === activeNoteId) {
        return { ...n, content, updatedAt: new Date().toISOString() };
      }
      return n;
    });
    setNotes(updated);
    saveNotesToStorage(updated);
  };

  // Delete a note
  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = notes.filter(n => n.id !== id);
    setShowDeleteConfirm(null);

    if (remaining.length > 0) {
      setNotes(remaining);
      if (activeNoteId === id) {
        setActiveNoteId(remaining[0].id);
      }
      saveNotesToStorage(remaining);
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
      saveNotesToStorage([defaultNote]);
    }
    setMobileView('list');
  };

  // Start renaming a note
  const startRenaming = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(note.id);
    setTempTitle(note.title);
  };

  // Save renamed note title
  const saveTitle = (id: string) => {
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
    saveNotesToStorage(updated);
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

  // Quick Copy
  const [copied, setCopied] = useState(false);
  const handleCopyNote = () => {
    if (!activeNote) return;
    navigator.clipboard.writeText(activeNote.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Quick Export
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

  // Filter notes based on search
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
              <p className="text-[10px] font-semibold text-gray-400">Offline-first local notes</p>
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
                <FiCheck className="w-2.5 h-2.5" /> Auto-saved
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
