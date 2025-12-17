'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getRelativeTime } from '@/lib/dateUtils';
import { notificationCache, cacheInvalidation } from '@/lib/cache';
import { supabase } from '@/lib/supabase-client-helper';
import { FiClipboard, FiCheckCircle, FiXCircle, FiFolder, FiMic, FiPackage, FiMessageSquare, FiBell, FiInfo } from 'react-icons/fi';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'task_assigned': return <FiClipboard className="w-6 h-6 text-blue-500" />;
    case 'design_approved': return <FiCheckCircle className="w-6 h-6 text-green-500" />;
    case 'design_rejected': return <FiXCircle className="w-6 h-6 text-red-500" />;
    case 'design_uploaded': return <FiFolder className="w-6 h-6 text-yellow-500" />;
    case 'project_update': return <FiInfo className="w-6 h-6 text-indigo-500" />;
    case 'inventory_added': return <FiPackage className="w-6 h-6 text-purple-500" />;
    case 'comment_added': return <FiMessageSquare className="w-6 h-6 text-gray-500" />;
    default: return <FiBell className="w-6 h-6 text-gray-400" />;
  }
};

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  related_id: string | null;
  related_type: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

export function OptimizedNotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const realtimeChannelRef = useRef<any>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNotificationCount = useRef(0);
  const isActiveTab = useRef(true);
  const lastFetchTime = useRef(0);

  // Early return AFTER all hooks
  if (!user) return null;

  // Smart fetch with caching and activity detection
  const fetchNotifications = async (forceRefresh = false) => {
    if (!user) return;

    const now = Date.now();
    const cacheKey = `notifications_${user.id}`;

    // Rate limiting - don't fetch more than once per 30 seconds unless forced
    if (!forceRefresh && (now - lastFetchTime.current) < 30000) {
      console.log('⏭️ Notification fetch rate limited');
      return;
    }

    try {
      setError(null);

      // Try cache first (unless forced refresh)
      if (!forceRefresh) {
        const cached = notificationCache.get<Notification[]>(cacheKey);
        if (cached) {
          console.log('✅ Using cached notifications');
          setNotifications(cached);
          setUnreadCount(cached.filter(n => !n.is_read).length);
          return;
        }
      }

      console.log('🔔 Fetching notifications from API...');
      setIsLoading(true);
      lastFetchTime.current = now;

      console.log('Initiating fetch for notifications...');
      const response = await fetch('/api/notifications?limit=20', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      console.log('Fetch response received:', response.status, response.ok);

      if (response.ok) {
        const data: Notification[] = await response.json();

        // Cache for 2 minutes
        notificationCache.set(cacheKey, data, 2 * 60 * 1000);

        // Detect new notifications for sound
        const newCount = data.filter(n => !n.is_read).length;
        const hasNewNotifications = newCount > lastNotificationCount.current;

        setNotifications(data);
        setUnreadCount(newCount);

        // Play sound for new notifications (only if tab is active)
        if (hasNewNotifications && mounted && isActiveTab.current) {
          console.log(`🔔 ${newCount - lastNotificationCount.current} new notification(s)`);
          playNotificationSound();
        }

        lastNotificationCount.current = newCount;

        console.log(`✅ Fetched ${data.length} notifications (${newCount} unread)`);
      } else if (response.status === 401) {
        console.error('❌ Unauthorized - session expired');
        setError('Session expired. Please refresh the page.');
        setNotifications([]);
        setUnreadCount(0);
      } else {
        console.error('❌ Failed to fetch notifications:', response.status);
        setError('Failed to load notifications');
      }
    } catch (error) {
      console.error('💥 Error fetching notifications:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Tab visibility detection to pause polling when inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('handleVisibilityChange triggered. document.hidden:', document.hidden);
      isActiveTab.current = !document.hidden;

      if (isActiveTab.current) {
        console.log('👁️ Tab became active - refreshing notifications');
        fetchNotifications(true);
      } else {
        console.log('👁️ Tab became inactive - pausing polling');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    setMounted(true);

    // Initialize audio context
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
        } catch (error) {
          console.error('❌ Failed to initialize audio context:', error);
        }
      }
    };

    document.addEventListener('click', initAudioContext, { once: true });
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Optimized notification system with smart polling
  useEffect(() => {
    if (!user) return;

    console.log('🔌 Setting up optimized notification system. User ID:', user.id);

    // Initial fetch
    fetchNotifications(true);

    // Setup real-time subscription (if available)
    const setupRealtime = async () => {
      try {
        const channel = supabase
          .channel('notifications-optimized')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`
            },
            (payload: { new: Notification; old: Notification | null }) => {
              console.log('🔔 Real-time notification received');
              const newNotification = payload.new as Notification;

              // Update local state immediately
              setNotifications(prev => [newNotification, ...prev]);
              setUnreadCount(prev => prev + 1);

              // Invalidate cache
              cacheInvalidation.invalidateNotifications();

              // Play sound
              if (mounted && isActiveTab.current) {
                playNotificationSound();
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`
            },
            (payload: { new: Notification; old: Notification | null }) => {
              console.log('🔄 Notification updated via real-time');
              const updatedNotification = payload.new as Notification;

              setNotifications(prev =>
                prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
              );

              // Recalculate unread count
              setNotifications(prev => {
                const newUnreadCount = prev.filter(n => !n.is_read).length;
                setUnreadCount(newUnreadCount);
                return prev;
              });

              // Invalidate cache
              cacheInvalidation.invalidateNotifications();
            }
          )
          .subscribe((status: string) => {
            console.log('📡 Realtime status:', status);

            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time notifications active');
              // Reduce polling frequency since real-time is working
              setupSmartPolling(5 * 60 * 1000); // 5 minutes
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn('⚠️ Real-time failed, using frequent polling');
              // Increase polling frequency as fallback
              setupSmartPolling(2 * 60 * 1000); // 2 minutes
            }
          });

        realtimeChannelRef.current = channel;
      } catch (error) {
        console.error('💥 Real-time setup failed:', error);
        // Fallback to polling
        setupSmartPolling(2 * 60 * 1000);
      }
    };

    // Smart polling function
    const setupSmartPolling = (interval: number) => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      pollIntervalRef.current = setInterval(() => {
        // Only poll if tab is active
        if (isActiveTab.current) {
          console.log('🔄 Smart polling for notifications...');
          fetchNotifications();
        } else {
          console.log('⏭️ Skipping poll - tab inactive');
        }
      }, interval);
    };

    setupRealtime();

    return () => {
      console.log('🧹 Cleaning up notification system...');

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const playNotificationSound = async () => {
    try {
      let audioContext = audioContextRef.current;

      if (!audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;
      }

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create pleasant notification sound
      const createBeep = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext!.createOscillator();
        const gainNode = audioContext!.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext!.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      createBeep(800, now, 0.15);
      createBeep(600, now + 0.2, 0.15);

    } catch (error) {
      console.error('❌ Error playing notification sound:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId, is_read: true }),
      });

      if (response.ok) {
        // Update local state immediately
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));

        // Invalidate cache
        cacheInvalidation.invalidateNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        cacheInvalidation.invalidateNotifications();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setUnreadCount(prev => {
          const notification = notifications.find(n => n.id === notificationId);
          return notification && !notification.is_read ? Math.max(0, prev - 1) : prev;
        });
        cacheInvalidation.invalidateNotifications();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned': return <FiClipboard className="w-6 h-6 text-blue-500" />;
      case 'design_approved': return <FiCheckCircle className="w-6 h-6 text-green-500" />;
      case 'design_rejected': return <FiXCircle className="w-6 h-6 text-red-500" />;
      case 'design_uploaded': return <FiFolder className="w-6 h-6 text-yellow-500" />;
      case 'project_update': return <FiInfo className="w-6 h-6 text-indigo-500" />;
      case 'inventory_added': return <FiPackage className="w-6 h-6 text-purple-500" />;
      case 'comment_added': return <FiMessageSquare className="w-6 h-6 text-gray-500" />;
      default: return <FiBell className="w-6 h-6 text-gray-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications {!isActiveTab.current && '(Paused)'}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => fetchNotifications(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                disabled={isLoading}
              >
                🔄 Refresh
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={isLoading}
                  className="text-xs text-yellow-600 hover:text-yellow-700 font-medium disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border-b border-red-100">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-800">{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      fetchNotifications(true);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-medium mt-1"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {isLoading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 hover:bg-gray-50 transition-colors ${!notification.is_read ? 'bg-yellow-50' : ''
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="text-gray-400 hover:text-red-600 flex-shrink-0"
                            aria-label="Delete notification"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {getRelativeTime(notification.created_at)}
                        </p>
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-yellow-600 hover:text-yellow-700 font-medium mt-1"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
