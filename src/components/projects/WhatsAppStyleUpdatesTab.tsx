'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateReadable, formatTimeIST } from '@/lib/dateUtils';
import { format, isToday, isYesterday } from 'date-fns';
import { ImageModal } from '@/components/ui/ImageModal';

// Types
type ProjectUpdate = {
  id: string;
  project_id: string;
  user_id: string;
  update_date: string;
  description: string;
  photos: string[];
  created_at: string;
  updated_at?: string;
  audio_url?: string | null;
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  is_read?: boolean;
};

type UpdatesTabProps = {
  projectId: string;
  currentUserId: string;
};

// Avatar component
const Avatar = ({ name, src, size = 'md' }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-green-100 text-green-800 flex items-center justify-center font-medium`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

// Status indicator component
const StatusIndicator = ({ isRead, time }: { isRead?: boolean; time: string }) => (
  <div className="flex items-center gap-1">
    <span className="text-xs text-gray-500">{formatTimeIST(time)}</span>
    {isRead ? (
      <span className="text-blue-500">✓✓</span>
    ) : (
      <span className="text-gray-400">✓✓</span>
    )}
  </div>
);

export function WhatsAppStyleUpdatesTab({ projectId, currentUserId }: UpdatesTabProps) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<ProjectUpdate | null>(null);
  const [isOnline, setIsOnline] = useState(true); // Would come from a real-time status in a real app

  // Fetch updates
  const fetchUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/project-updates?project_id=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch updates');

      const { updates: fetchedUpdates } = await response.json();
      setUpdates(fetchedUpdates || []);
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Initial fetch and setup
  useEffect(() => {
    fetchUpdates();
    // In a real app, you'd set up WebSocket or similar for real-time updates
  }, [fetchUpdates]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [updates, scrollToBottom]);

  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && selectedImages.length === 0) || !user) return;

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('description', message);
    selectedImages.forEach((file) => {
      formData.append('photos', file);
    });

    try {
      const response = await fetch('/api/project-updates', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to send message');

      setMessage('');
      setSelectedImages([]);
      setReplyingTo(null);
      await fetchUpdates(); // Refresh messages
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedImages(Array.from(e.target.files));
    }
  };

  // Format message date header
  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'TODAY';
    if (isYesterday(date)) return 'YESTERDAY';
    return formatDateReadable(dateString);
  };

  // Group messages by date
  const groupedMessages = updates.reduce<Record<string, ProjectUpdate[]>>((groups, update) => {
    const date = formatMessageDate(update.update_date);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(update);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#e5ddd5] bg-opacity-30 bg-[url('https://web.whatsapp.com/img/bg-chat-tile-light_a4be8c74.png')]">
      {/* Header */}
      <div className="bg-yellow-500 text-white p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 pb-24"
        style={{
          scrollBehavior: 'smooth',
          paddingBottom: '6rem' /* Space for input */
        }}
      >
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date} className="w-full">
            <div className="text-center mb-4">
              <span className="bg-white text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm">
                {date}
              </span>
            </div>

            {dateMessages.map((update) => {
              const isMe = update.user_id === currentUserId;
              return (
                <div
                  key={update.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  {!isMe && (
                    <div className="flex-shrink-0 mr-2 self-end">
                      <Avatar name={update.user.full_name} src={update.user.avatar_url} size="md" />
                    </div>
                  )}

                  <div className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl ${isMe ? 'bg-[#d9fdd3]' : 'bg-white'} rounded-lg p-2 shadow`}>
                    {update.photos?.length > 0 && (
                      <div className="flex gap-3 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                        {update.photos.map((photo, idx) => {
                          const isPDF = photo.toLowerCase().endsWith('.pdf');
                          return (
                            <div
                              key={idx}
                              className="flex-shrink-0 relative group"
                              onClick={() => {
                                if (isPDF) {
                                  window.open(photo, '_blank');
                                } else {
                                  setSelectedImage(photo);
                                  setSelectedImageIndex(idx);
                                  setCurrentImages(update.photos);
                                }
                              }}
                            >
                              <div className="w-40 h-28 md:w-48 md:h-32 lg:w-56 lg:h-36 relative rounded-lg overflow-hidden border border-gray-200 cursor-pointer">
                                {isPDF ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-2 text-center">
                                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-1">
                                      <span className="text-red-600 font-bold text-xs">PDF</span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-medium truncate w-full">Document</span>
                                  </div>
                                ) : (
                                  <img
                                    src={photo}
                                    alt={`Update ${idx + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                    loading="lazy"
                                  />
                                )}
                                {update.photos.length > 1 && (
                                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                                    {idx + 1}/{update.photos.length}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-gray-800">{update.description}</p>

                    <div className={`flex items-center justify-end mt-1 space-x-1`}>
                      <StatusIndicator
                        isRead={update.is_read}
                        time={update.created_at}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Message Input */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 p-3">
        <form onSubmit={handleSendMessage} className="flex items-center max-w-4xl mx-auto w-full px-4">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            multiple
            accept="image/*,application/pdf"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="p-2 text-gray-500 hover:text-yellow-600 transition-colors"
            onClick={() => document.getElementById('file-upload')?.click()}
            title="Attach image"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <div className="relative flex-1 mx-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full py-3 px-4 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:bg-white transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as any);
                }
              }}
            />
          </div>
          <button
            type="submit"
            className="p-2 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!message.trim() && selectedImages.length === 0}
            title="Send message"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
