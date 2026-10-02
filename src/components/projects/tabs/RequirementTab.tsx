'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FiCheck, FiCopy, FiLoader } from 'react-icons/fi';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface RequirementTabProps {
  projectId: string;
  projectName?: string;
  activeSubTab?: string;
}

export function RequirementTab({ projectId, projectName, activeSubTab = 'notes' }: RequirementTabProps) {
  const { hasPermission, isAdmin } = useUserPermissions();
  const canEdit = isAdmin || hasPermission('requirements.edit') || hasPermission('projects.edit');

  const [loading, setLoading] = useState(true);
  const [notesContent, setNotesContent] = useState('');
  const [notesTitle, setNotesTitle] = useState('Site Notes');
  const [noteSaveStatus, setNoteSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [copiedNotes, setCopiedNotes] = useState(false);
  const noteSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch requirement notes
  const fetchNotes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/requirements?t=${Date.now()}`);
      if (!res.ok) throw new Error('Failed to load requirement notes');
      const data = await res.json();

      if (data.notes && data.notes.length > 0) {
        setNotesContent(data.notes[0].content || '');
        setNotesTitle(data.notes[0].title || 'Site Notes');
      }
    } catch (err) {
      console.error('Error fetching requirement notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchNotes();
    }
    return () => {
      if (noteSaveTimerRef.current) {
        clearTimeout(noteSaveTimerRef.current);
      }
    };
  }, [projectId]);

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

  return (
    <div key="notes" className="w-full p-3 sm:p-6 space-y-4 animate-tab-enter">
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
