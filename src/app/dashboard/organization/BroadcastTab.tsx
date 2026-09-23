'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  FiSend,
  FiAlertCircle,
  FiCheckCircle,
  FiSearch,
  FiUsers,
  FiInfo,
  FiAlertTriangle,
  FiGift,
  FiVolume2,
  FiTrash2,
  FiEye,
  FiPlus,
  FiX,
  FiExternalLink,
  FiCheck,
} from 'react-icons/fi';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { PERMISSION_NODES } from '@/lib/rbac-constants';

type PopupType = 'info' | 'warning' | 'celebration' | 'announcement';
type TargetType = 'all' | 'role' | 'users';

interface UserItem {
  id: string;
  full_name: string;
  designation?: string | null;
  role?: string;
  is_active?: boolean;
}

interface PopupItem {
  id: string;
  title: string;
  message: string;
  popup_type: PopupType;
  image_url: string | null;
  action_label: string | null;
  action_url: string | null;
  target_type: TargetType;
  target_roles: string[];
  target_user_ids: string[];
  is_active: boolean;
  dismissal_count?: number;
  created_at: string;
  creator?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

const POPUP_TYPES: { id: PopupType; label: string; icon: any; color: string; desc: string }[] = [
  { id: 'announcement', label: 'Announcement', icon: FiVolume2, color: 'border-indigo-200 bg-indigo-50 text-indigo-700', desc: 'General updates & news' },
  { id: 'celebration', label: 'Celebration', icon: FiGift, color: 'border-yellow-300 bg-yellow-50 text-yellow-800', desc: 'Festivals, wishes & achievements' },
  { id: 'warning', label: 'Urgent / Alert', icon: FiAlertTriangle, color: 'border-amber-300 bg-amber-50 text-amber-800', desc: 'Deadlines, outages & important alerts' },
  { id: 'info', label: 'Information', icon: FiInfo, color: 'border-blue-200 bg-blue-50 text-blue-700', desc: 'Policies & helpful notices' },
];

export default function BroadcastTab() {
  const { user } = useAuth();
  const { hasPermission } = useUserPermissions();
  const isAdmin = user?.role === 'admin' || (user?.designation?.toLowerCase().includes('it') ?? false);
  const canManage = isAdmin || hasPermission(PERMISSION_NODES.POPUPS_MANAGE);

  // Composer form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [popupType, setPopupType] = useState<PopupType>('announcement');
  const [imageUrl, setImageUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('Got it');
  const [actionUrl, setActionUrl] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [sendNotification, setSendNotification] = useState(false);

  // Management & history state
  const [popups, setPopups] = useState<PopupItem[]>([]);
  const [isLoadingPopups, setIsLoadingPopups] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Users & roles
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [showComposer, setShowComposer] = useState(true);

  // Fetch history and users on mount
  useEffect(() => {
    fetchUsers();
    fetchPopups();
  }, []);

  const fetchPopups = async () => {
    setIsLoadingPopups(true);
    try {
      const res = await fetch('/api/admin/popups');
      if (res.ok) {
        const data = await res.json();
        setPopups(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch popups:', err);
    } finally {
      setIsLoadingPopups(false);
    }
  };

  const fetchUsers = async () => {
    setIsFetchingUsers(true);
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data: UserItem[] = await response.json();
      setAllUsers(data || []);

      // Extract unique designations / roles
      const rolesSet = new Set<string>();
      (data || []).forEach((u) => {
        if (u.designation?.trim()) rolesSet.add(u.designation.trim());
        if (u.role?.trim()) rolesSet.add(u.role.trim());
      });
      setAvailableRoles(Array.from(rolesSet).sort());
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsFetchingUsers(false);
    }
  };

  const activeUsers = allUsers.filter((u) => u.is_active !== false);

  const filteredUsers = activeUsers.filter((u) =>
    (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.designation?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleCreatePopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setStatus({ type: 'error', text: 'Please provide both a title and message.' });
      return;
    }

    if (targetType === 'role' && selectedRoles.length === 0) {
      setStatus({ type: 'error', text: 'Please select at least one role/designation.' });
      return;
    }

    if (targetType === 'users' && selectedUserIds.length === 0) {
      setStatus({ type: 'error', text: 'Please select at least one recipient user.' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch('/api/admin/popups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          popup_type: popupType,
          image_url: imageUrl.trim() || null,
          action_label: actionLabel.trim() || 'Got it',
          action_url: actionUrl.trim() || null,
          target_type: targetType,
          target_roles: selectedRoles,
          target_user_ids: selectedUserIds,
          is_active: true,
          send_notification: sendNotification,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', text: 'Popup created and published successfully!' });
        // Reset form
        setTitle('');
        setMessage('');
        setImageUrl('');
        setActionLabel('Got it');
        setActionUrl('');
        setSelectedRoles([]);
        setSelectedUserIds([]);
        setTargetType('all');
        setSendNotification(false);
        fetchPopups();
      } else {
        setStatus({ type: 'error', text: result.error || 'Failed to publish popup.' });
      }
    } catch (err: any) {
      console.error('Error creating popup:', err);
      setStatus({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (popup: PopupItem) => {
    try {
      const res = await fetch('/api/admin/popups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: popup.id,
          is_active: !popup.is_active,
        }),
      });
      if (res.ok) {
        setPopups((prev) =>
          prev.map((p) => (p.id === popup.id ? { ...p, is_active: !p.is_active } : p))
        );
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDelete = async (popupId: string) => {
    if (!confirm('Are you sure you want to delete this popup? It will no longer appear for any user.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/popups?id=${popupId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPopups((prev) => prev.filter((p) => p.id !== popupId));
      }
    } catch (err) {
      console.error('Failed to delete popup:', err);
    }
  };

  // Preview configuration
  const currentTypeConfig = POPUP_TYPES.find((t) => t.id === popupType) || POPUP_TYPES[0];

  return (
    <div className="space-y-8">
      {/* Header with Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>📢</span> In-App Popups & Announcements
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Publish targeted modal popups that users see directly upon opening the app.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowComposer(!showComposer)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              showComposer
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-yellow-500 text-gray-900 hover:bg-yellow-600 shadow-yellow-200'
            }`}
          >
            {showComposer ? (
              <>
                <FiX className="w-4 h-4" /> Close Composer
              </>
            ) : (
              <>
                <FiPlus className="w-4 h-4" /> Create New Popup
              </>
            )}
          </button>
        )}
      </div>

      {status && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 transition-all ${
            status.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {status.type === 'success' ? (
            <FiCheckCircle className="mt-0.5 shrink-0 w-5 h-5" />
          ) : (
            <FiAlertCircle className="mt-0.5 shrink-0 w-5 h-5" />
          )}
          <p className="text-sm font-medium">{status.text}</p>
        </div>
      )}

      {/* COMPOSER SECTION */}
      {showComposer && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form: 7 cols */}
          <form
            onSubmit={handleCreatePopup}
            className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6"
          >
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-base font-bold text-gray-800">Compose New In-App Popup</h3>
              <p className="text-xs text-gray-400">Fill in details and preview in real-time on the right.</p>
            </div>

            {/* Popup Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Popup Type / Theme
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {POPUP_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = popupType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPopupType(t.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                        isSelected
                          ? `${t.color} ring-2 ring-yellow-500 shadow-sm font-semibold`
                          : 'border-gray-200 hover:border-gray-300 bg-white text-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs">{t.label}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-normal leading-tight">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="popup-title" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Popup Title <span className="text-red-500">*</span>
              </label>
              <input
                id="popup-title"
                type="text"
                required
                className="w-full rounded-xl border border-gray-200 shadow-xs focus:border-yellow-500 focus:ring-yellow-500 text-sm p-3.5 transition-all"
                placeholder="e.g. Office Closed for Dussehra, Safety Protocol Update..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Message Description */}
            <div>
              <label htmlFor="popup-message" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Message Content <span className="text-red-500">*</span>
              </label>
              <textarea
                id="popup-message"
                required
                rows={4}
                className="w-full rounded-xl border border-gray-200 shadow-xs focus:border-yellow-500 focus:ring-yellow-500 text-sm p-3.5 transition-all"
                placeholder="Write your announcement details here. Line breaks are preserved."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* Banner Image URL (Optional) */}
            <div>
              <label htmlFor="popup-image" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Banner Image URL (Optional)
              </label>
              <input
                id="popup-image"
                type="url"
                className="w-full rounded-xl border border-gray-200 shadow-xs focus:border-yellow-500 focus:ring-yellow-500 text-sm p-3 transition-all"
                placeholder="https://example.com/banner.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Paste any direct image link to display an eye-catching banner at the top of the popup.
              </p>
            </div>

            {/* Action Button Label & Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="popup-action-label" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Button Label
                </label>
                <input
                  id="popup-action-label"
                  type="text"
                  className="w-full rounded-xl border border-gray-200 shadow-xs focus:border-yellow-500 focus:ring-yellow-500 text-sm p-3"
                  placeholder="e.g. Got it, View Project, Acknowledge"
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="popup-action-url" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Action Link / URL (Optional)
                </label>
                <input
                  id="popup-action-url"
                  type="text"
                  className="w-full rounded-xl border border-gray-200 shadow-xs focus:border-yellow-500 focus:ring-yellow-500 text-sm p-3"
                  placeholder="e.g. /dashboard/projects or https://..."
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Target Audience
              </label>

              {/* Target Type Selector */}
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium">
                  <input
                    type="radio"
                    name="targetType"
                    value="all"
                    checked={targetType === 'all'}
                    onChange={() => setTargetType('all')}
                    className="text-yellow-500 focus:ring-yellow-500"
                  />
                  <span>All Active Users ({activeUsers.length})</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium">
                  <input
                    type="radio"
                    name="targetType"
                    value="role"
                    checked={targetType === 'role'}
                    onChange={() => setTargetType('role')}
                    className="text-yellow-500 focus:ring-yellow-500"
                  />
                  <span>By Role / Designation</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium">
                  <input
                    type="radio"
                    name="targetType"
                    value="users"
                    checked={targetType === 'users'}
                    onChange={() => setTargetType('users')}
                    className="text-yellow-500 focus:ring-yellow-500"
                  />
                  <span>Specific Users ({selectedUserIds.length} selected)</span>
                </label>
              </div>

              {/* Roles Chips */}
              {targetType === 'role' && (
                <div className="p-3 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                  <p className="text-[11px] text-gray-500 font-medium">Select roles to target:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableRoles.map((r) => {
                      const isSelected = selectedRoles.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => toggleRole(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-yellow-500 text-gray-900 border-yellow-500 font-semibold'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {isSelected && <FiCheck className="w-3.5 h-3.5" />}
                          <span>{r}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Users Multiselect */}
              {targetType === 'users' && (
                <div className="p-3 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      placeholder="Search users by name or role..."
                      className="w-full text-xs rounded-lg border-gray-200 focus:border-yellow-500 focus:ring-yellow-500 p-2"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={toggleAllUsers}
                      className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold ml-3 shrink-0"
                    >
                      {selectedUserIds.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-gray-100">
                    {isFetchingUsers ? (
                      <div className="p-3 text-center text-xs text-gray-400">Loading users...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-gray-400">No users match filter</div>
                    ) : (
                      filteredUsers.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-3 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 h-4 w-4"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={() => toggleUser(u.id)}
                          />
                          <span className="font-medium text-gray-800">{u.full_name}</span>
                          {u.designation && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {u.designation}
                            </span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notification Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 h-4 w-4 mt-0.5"
                />
                <div>
                  <span className="text-xs font-semibold text-gray-700">Also send push/system notification</span>
                  <p className="text-[11px] text-gray-400">
                    Dispatches a notification bell / device alert to all targeted users immediately.
                  </p>
                </div>
              </label>
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !message.trim()}
                className={`py-3 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  isSubmitting || !title.trim() || !message.trim()
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-500 text-gray-900 hover:bg-yellow-600 shadow-md shadow-yellow-200 active:scale-[0.98]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900/20 border-t-gray-900"></div>
                    Publishing...
                  </>
                ) : (
                  <>
                    <FiSend className="w-4 h-4" />
                    Publish Popup Now
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Right Live Preview: 5 cols */}
          <div className="lg:col-span-5 space-y-3 sticky top-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <FiEye className="w-3.5 h-3.5 text-gray-400" /> Live Recipient Preview
              </span>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Interactive Mockup
              </span>
            </div>

            {/* Mockup Card */}
            <div className="bg-gray-900/70 p-4 rounded-2xl shadow-xl backdrop-blur-sm border border-gray-800 flex items-center justify-center">
              <div className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 text-left">
                {/* Image */}
                {imageUrl ? (
                  <div className="w-full h-36 bg-gray-100 overflow-hidden relative">
                    <img
                      src={imageUrl}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).parentElement?.classList.add('hidden');
                      }}
                    />
                  </div>
                ) : null}

                {/* Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${currentTypeConfig.color}`}
                    >
                      {currentTypeConfig.label}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 leading-snug">
                    {title.trim() || 'Popup Announcement Title'}
                  </h3>

                  <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed line-clamp-6">
                    {message.trim() ||
                      'This is how your announcement description will look when a user opens the app. You can include multiline messages, guidance, or celebratory greetings!'}
                  </p>
                </div>

                {/* Footer */}
                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 ${
                      popupType === 'warning'
                        ? 'bg-amber-600 text-white'
                        : popupType === 'celebration'
                        ? 'bg-yellow-500 text-gray-900'
                        : popupType === 'info'
                        ? 'bg-blue-600 text-white'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <span>{actionLabel.trim() || 'Got it'}</span>
                    {actionUrl.trim() && <FiExternalLink className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 text-center">
              Targeted recipients see this popup once when logging into or navigating the app.
            </p>
          </div>
        </div>
      )}

      {/* POPUP HISTORY & MANAGEMENT SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FiVolume2 className="text-yellow-600" /> Active & Past Popups
            </h3>
            <p className="text-xs text-gray-400">
              Manage live status, track acknowledgments, or remove expired popups.
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {popups.length} {popups.length === 1 ? 'Popup' : 'Popups'} Total
          </span>
        </div>

        {isLoadingPopups ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading popups history...</div>
        ) : popups.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center mx-auto text-xl">
              📢
            </div>
            <p className="text-sm font-semibold text-gray-700">No popups published yet</p>
            <p className="text-xs text-gray-400">
              Use the composer above to create and broadcast your first in-app announcement.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-x-auto">
            {popups.map((p) => {
              const typeCfg = POPUP_TYPES.find((t) => t.id === p.popup_type) || POPUP_TYPES[0];
              const Icon = typeCfg.icon;

              let audienceLabel = 'All Users';
              if (p.target_type === 'role') {
                audienceLabel = `${p.target_roles?.length || 0} Roles: ${(p.target_roles || []).join(', ')}`;
              } else if (p.target_type === 'users') {
                audienceLabel = `${p.target_user_ids?.length || 0} Specific Users`;
              }

              return (
                <div
                  key={p.id}
                  className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50/50 p-3 rounded-xl transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${typeCfg.color}`}
                      >
                        <Icon className="w-3 h-3" />
                        {typeCfg.label}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          p.is_active
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {p.is_active ? 'Active / Visible' : 'Disabled'}
                      </span>

                      <span className="text-[11px] text-gray-400">
                        {new Date(p.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-gray-900 truncate">{p.title}</h4>
                    <p className="text-xs text-gray-500 line-clamp-1">{p.message}</p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400 pt-1">
                      <span className="flex items-center gap-1 font-medium text-gray-600">
                        <FiUsers className="w-3.5 h-3.5 text-gray-400" />
                        {audienceLabel}
                      </span>
                      <span>•</span>
                      <span className="text-yellow-700 font-medium bg-yellow-50 px-2 py-0.5 rounded">
                        {p.dismissal_count || 0} Acknowledged
                      </span>
                      {p.creator?.full_name && (
                        <>
                          <span>•</span>
                          <span>Created by {p.creator.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canManage ? (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          p.is_active
                            ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            : 'border-green-200 text-green-700 hover:bg-green-50'
                        }`}
                        title={p.is_active ? 'Disable this popup' : 'Enable this popup'}
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Delete popup"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-medium px-2 py-1 bg-gray-100 rounded-lg">
                      View only
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
