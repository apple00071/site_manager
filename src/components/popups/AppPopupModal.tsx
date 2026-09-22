'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FiX, FiInfo, FiAlertTriangle, FiGift, FiVolume2, FiArrowRight, FiCheck } from 'react-icons/fi';

export interface AppPopup {
  id: string;
  title: string;
  message: string;
  popup_type: 'info' | 'warning' | 'celebration' | 'announcement';
  image_url?: string | null;
  action_label?: string | null;
  action_url?: string | null;
  created_at: string;
}

export default function AppPopupModal() {
  const { user } = useAuth();
  const router = useRouter();
  const [activePopup, setActivePopup] = useState<AppPopup | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const checkActivePopup = async () => {
      try {
        const res = await fetch('/api/popups/active');
        if (!res.ok) return;
        const data = await res.json();

        if (isMounted && data?.popup) {
          const popup = data.popup as AppPopup;
          // Check localStorage fallback for instant client-side dedup
          const storageKey = `dismissed_popup_${popup.id}_${user.id}`;
          if (!localStorage.getItem(storageKey)) {
            setActivePopup(popup);
          }
        }
      } catch (err) {
        console.error('Failed to fetch active popup:', err);
      }
    };

    checkActivePopup();

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (!activePopup || !user) return null;

  const handleDismiss = async () => {
    setIsDismissing(true);
    const popupId = activePopup.id;

    // Immediately hide from UI and mark in localStorage
    setActivePopup(null);
    localStorage.setItem(`dismissed_popup_${popupId}_${user.id}`, 'true');

    try {
      await fetch('/api/popups/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ popup_id: popupId }),
      });
    } catch (e) {
      console.error('Failed to send dismissal to server:', e);
    }
  };

  const handleActionClick = () => {
    const actionUrl = activePopup.action_url;
    handleDismiss();

    if (actionUrl) {
      if (actionUrl.startsWith('http://') || actionUrl.startsWith('https://')) {
        window.open(actionUrl, '_blank', 'noopener,noreferrer');
      } else {
        router.push(actionUrl);
      }
    }
  };

  // Styling configurations per popup type
  const typeConfigs = {
    info: {
      badge: 'Information',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: <FiInfo className="w-5 h-5 text-blue-600" />,
      accentBg: 'bg-blue-50 border-blue-100',
      btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
      accentGlow: 'from-blue-500/10 to-transparent',
    },
    warning: {
      badge: 'Important Notice',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: <FiAlertTriangle className="w-5 h-5 text-amber-600" />,
      accentBg: 'bg-amber-50 border-amber-200',
      btnClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200',
      accentGlow: 'from-amber-500/10 to-transparent',
    },
    celebration: {
      badge: 'Special Announcement 🎉',
      badgeClass: 'bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-900 border-amber-300',
      icon: <FiGift className="w-5 h-5 text-yellow-600" />,
      accentBg: 'bg-amber-50/60 border-amber-200',
      btnClass: 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-gray-900 font-semibold shadow-yellow-200',
      accentGlow: 'from-yellow-400/20 via-pink-400/10 to-transparent',
    },
    announcement: {
      badge: 'Announcement',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      icon: <FiVolume2 className="w-5 h-5 text-indigo-600" />,
      accentBg: 'bg-indigo-50 border-indigo-100',
      btnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200',
      accentGlow: 'from-indigo-500/10 to-transparent',
    },
  };

  const config = typeConfigs[activePopup.popup_type] || typeConfigs.announcement;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
      >
        {/* Glow ambient background banner */}
        <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b ${config.accentGlow} pointer-events-none`} />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          disabled={isDismissing}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-gray-500 hover:text-gray-800 shadow-sm border border-gray-200/60 transition-all hover:scale-105 active:scale-95"
          aria-label="Close popup"
        >
          <FiX className="w-5 h-5" />
        </button>

        {/* Optional Banner Image */}
        {activePopup.image_url && (
          <div className="relative w-full h-44 sm:h-52 bg-gray-100 overflow-hidden shrink-0">
            <img
              src={activePopup.image_url}
              alt={activePopup.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // If image fails to load, gracefully hide container
                (e.target as HTMLElement).parentElement?.classList.add('hidden');
              }}
            />
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-4">
          {/* Header row with badge & type icon */}
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${config.accentBg} shrink-0`}>
              {config.icon}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${config.badgeClass}`}
            >
              {config.badge}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
            {activePopup.title}
          </h2>

          {/* Description Message */}
          <div className="text-sm sm:text-base text-gray-600 whitespace-pre-line leading-relaxed">
            {activePopup.message}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isDismissing}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            Dismiss
          </button>

          <button
            type="button"
            onClick={handleActionClick}
            disabled={isDismissing}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${config.btnClass}`}
          >
            <span>{activePopup.action_label || 'Got it'}</span>
            {activePopup.action_url ? (
              <FiArrowRight className="w-4 h-4" />
            ) : (
              <FiCheck className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
