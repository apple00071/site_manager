'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiBell, FiCheckCircle, FiClipboard, FiFolder, FiInfo, FiMessageSquare, FiPackage, FiXCircle } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
import { getRelativeTime } from '@/lib/dateUtils';
import { cacheInvalidation, notificationCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase-client-helper';

const DEBUG_NOTIFICATIONS = false;

const debugLog = (...args: unknown[]) => {
  if (DEBUG_NOTIFICATIONS) {
    console.log(...args);
  }
};

const getNotificationUrl = (type: string, relatedId?: string | null, relatedType?: string | null) => {
  const baseUrl = '/dashboard';
  switch (type) {
    case 'task_assigned':
      return relatedId ? `${baseUrl}/tasks?taskId=${relatedId}` : `${baseUrl}/tasks`;
    case 'snag_created':
    case 'snag_assigned':
    case 'snag_resolved':
    case 'snag_verified':
      if (relatedType === 'project' && relatedId) {
        return `${baseUrl}/projects/${relatedId}?stage=snag`;
      }
      return relatedId ? `${baseUrl}/snags?snagId=${relatedId}` : `${baseUrl}/snags`;
    case 'design_approved':
    case 'design_rejected':
    case 'design_uploaded':
      return relatedId ? `${baseUrl}/projects/${relatedId}?stage=design` : undefined;
    case 'project_update':
    case 'mention':
      return relatedId ? `${baseUrl}/projects/${relatedId}?stage=work_progress&tab=updates` : undefined;
    case 'inventory_added':
      return relatedId ? `${baseUrl}/projects/${relatedId}?stage=work_progress&tab=inventory` : undefined;
    case 'bill_approved':
    case 'bill_rejected':
    case 'invoice_created':
    case 'invoice_approved':
    case 'invoice_rejected':
    case 'proposal_sent':
    case 'proposal_approved':
    case 'proposal_rejected':
      return relatedId ? `${baseUrl}/projects/${relatedId}?stage=orders` : `${baseUrl}/tasks?category=proposals`;
    default:
      return undefined;
  }
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'task_assigned':
      return <FiClipboard className="w-6 h-6 text-blue-500" />;
    case 'design_approved':
      return <FiCheckCircle className="w-6 h-6 text-green-500" />;
    case 'design_rejected':
      return <FiXCircle className="w-6 h-6 text-red-500" />;
    case 'design_uploaded':
      return <FiFolder className="w-6 h-6 text-yellow-500" />;
    case 'project_update':
      return <FiInfo className="w-6 h-6 text-indigo-500" />;
    case 'inventory_added':
      return <FiPackage className="w-6 h-6 text-purple-500" />;
    case 'comment_added':
      return <FiMessageSquare className="w-6 h-6 text-gray-500" />;
    default:
      return <FiBell className="w-6 h-6 text-gray-400" />;
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
  const userId = user?.id;
  const router = useRouter();

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
    } catch (audioError) {
      console.error('Error playing notification sound:', audioError);
    }
  };

  const fetchNotifications = async (forceRefresh = false) => {
    if (!userId) {
      return;
    }

    const now = Date.now();
    const cacheKey = `notifications_${userId}`;

    if (!forceRefresh && now - lastFetchTime.current < 30000) {
      debugLog('Notification fetch rate limited');
      return;
    }

    try {
      setError(null);

      if (!forceRefresh) {
        const cached = notificationCache.get<Notification[]>(cacheKey);
        if (cached) {
          setNotifications(cached);
          setUnreadCount(cached.filter((n) => !n.is_read).length);
          return;
        }
      }

      setIsLoading(true);
      lastFetchTime.current = now;

      const response = await fetch('/api/notifications?limit=20', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok) {
        const data: Notification[] = await response.json();
        notificationCache.set(cacheKey, data, 2 * 60 * 1000);

        const newCount = data.filter((n) => !n.is_read).length;
        const hasNewNotifications = newCount > lastNotificationCount.current;

        setNotifications(data);
        setUnreadCount(newCount);

        if (hasNewNotifications && mounted && isActiveTab.current) {
          playNotificationSound();
        }

        lastNotificationCount.current = newCount;
      } else if (response.status === 401) {
        setError('Session expired. Please refresh the page.');
        setNotifications([]);
        setUnreadCount(0);
      } else {
        setError('Failed to load notifications');
      }
    } catch (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      return;
    }

    setMounted(true);

    const handleVisibilityChange = () => {
      isActiveTab.current = !document.hidden;
    };

    const initAudioContext = () => {
      if (!audioContextRef.current) {
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
        } catch (audioError) {
          console.error('Failed to initialize audio context:', audioError);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', initAudioContext, { once: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void fetchNotifications(true);

    const setupSmartPolling = (interval: number) => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      pollIntervalRef.current = setInterval(() => {
        if (isActiveTab.current) {
          void fetchNotifications();
        }
      }, interval);
    };

    try {
      const channel = supabase
        .channel(`notifications-optimized-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload: { new: Notification }) => {
            const newNotification = payload.new;
            setNotifications((prev) => [newNotification, ...prev]);
            setUnreadCount((prev) => prev + 1);
            cacheInvalidation.invalidateNotifications();

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
            filter: `user_id=eq.${userId}`,
          },
          (payload: { new: Notification }) => {
            const updatedNotification = payload.new;

            setNotifications((prev) => {
              const nextNotifications = prev.map((notification) =>
                notification.id === updatedNotification.id ? updatedNotification : notification
              );
              setUnreadCount(nextNotifications.filter((notification) => !notification.is_read).length);
              return nextNotifications;
            });

            cacheInvalidation.invalidateNotifications();
          }
        )
        .subscribe((status: string) => {
          debugLog('Realtime status:', status);

          if (status === 'SUBSCRIBED') {
            setupSmartPolling(5 * 60 * 1000);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setupSmartPolling(2 * 60 * 1000);
          }
        });

      realtimeChannelRef.current = channel;
    } catch (realtimeError) {
      console.error('Realtime setup failed:', realtimeError);
      setupSmartPolling(2 * 60 * 1000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [mounted, userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId, is_read: true }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId ? { ...notification, is_read: true } : notification
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        cacheInvalidation.invalidateNotifications();
      }
    } catch (markError) {
      console.error('Error marking notification as read:', markError);
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
        setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
        setUnreadCount(0);
        cacheInvalidation.invalidateNotifications();
      }
    } catch (markAllError) {
      console.error('Error marking all as read:', markAllError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    const url = getNotificationUrl(notification.type, notification.related_id, notification.related_type);
    if (url) {
      router.push(url);
    }

    setIsOpen(false);
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
        setUnreadCount((prev) => {
          const notification = notifications.find((item) => item.id === notificationId);
          return notification && !notification.is_read ? Math.max(0, prev - 1) : prev;
        });
        cacheInvalidation.invalidateNotifications();
      }
    } catch (deleteError) {
      console.error('Error deleting notification:', deleteError);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed left-4 right-4 top-16 bottom-auto sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[70vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
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
                  Refresh
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
                        void fetchNotifications(true);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 font-medium mt-1"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`px-4 py-3 hover:bg-gray-50 transition-colors pointer-cursor ${!notification.is_read ? 'bg-yellow-50' : ''}`}
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
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteNotification(notification.id);
                              }}
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
                              onClick={(event) => {
                                event.stopPropagation();
                                void markAsRead(notification.id);
                              }}
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
        </>
      )}
    </div>
  );
}
