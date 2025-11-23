'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateReadable, formatDateTimeReadable, formatTimeIST, getTodayDateString } from '@/lib/dateUtils';
import { ImageModal } from '@/components/ui/ImageModal';

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
  };
};

type UpdatesTabProps = {
  projectId: string;
};

type VoiceNotePlayerProps = {
  src: string;
};

function VoiceNotePlayer({ src }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to play voice note:', error);
      }
    }
  };

  return (
    <div className="inline-flex items-center gap-3 rounded-full bg-gray-100 px-3 py-2">
      <button
        type="button"
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-300"
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? (
          <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5a1 1 0 0 0-1 1v12a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1zm8 0a1 1 0 0 0-1 1v12a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-800" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <span className="text-xs text-gray-600">Voice note</span>
      <audio
        ref={audioRef}
        src={src}
        className="hidden"
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
      />
    </div>
  );
}

export function UpdatesTab({ projectId }: UpdatesTabProps) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [stages, setStages] = useState<{ id: string; title: string }[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  
  const [form, setForm] = useState({
    update_date: getTodayDateString(),
    description: '',
    photos: [] as string[],
  });

  useEffect(() => {
    fetchUpdates();
    fetchStages();
  }, [projectId]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/project-updates?project_id=${projectId}`);
      
      if (!response.ok) {
        console.error('Failed to fetch updates');
        return;
      }

      const { updates: fetchedUpdates } = await response.json();
      // Sort oldest -> newest so the latest messages are at the bottom like WhatsApp
      const sortedUpdates = (fetchedUpdates || []).slice().sort((a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setUpdates(sortedUpdates);
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStages = async () => {
    try {
      const response = await fetch(`/api/project-steps?project_id=${projectId}`);
      if (!response.ok) {
        console.error('Failed to fetch project stages');
        return;
      }

      const text = await response.text();
      if (!text) {
        setStages([]);
        return;
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error('Failed to parse project stages response:', err);
        setStages([]);
        return;
      }

      let stepsArray: any[] = [];
      if (Array.isArray(data)) {
        stepsArray = data;
      } else if (data && Array.isArray((data as any).steps)) {
        stepsArray = (data as any).steps;
      } else if (data && (data as any).error) {
        console.error('Project steps API error:', (data as any).error);
        return;
      }

      const mapped = stepsArray
        .filter((s: any) => s && s.id && s.title)
        .map((s: any) => ({ id: s.id as string, title: String(s.title) }));

      setStages(mapped);
    } catch (error) {
      console.error('Error fetching project stages:', error);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}_${i}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('project-update-photos')
          .upload(fileName, file);

        if (error) {
          console.error('Error uploading photo:', error);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('project-update-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      setForm(prev => ({ ...prev, photos: [...prev.photos, ...uploadedUrls] }));
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Failed to upload some photos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const startRecording = async () => {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        alert('Audio recording is not supported in this browser');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const MediaRecorderConstructor = (window as any).MediaRecorder;

      if (!MediaRecorderConstructor) {
        alert('Audio recording is not supported in this browser');
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        return;
      }

      const recorder = new MediaRecorderConstructor(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      audioBlobRef.current = null;
      setAudioPreviewUrl(null);

      recorder.ondataavailable = (event: any) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        if (audioChunksRef.current.length === 0) {
          setIsRecording(false);
          return;
        }
        const mimeType = (mediaRecorderRef.current && (mediaRecorderRef.current as any).mimeType) || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        setIsRecording(false);
        audioChunksRef.current = [];
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording');
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
    }
  };

  const clearAudio = () => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    audioBlobRef.current = null;
    audioChunksRef.current = [];
    setAudioPreviewUrl(null);
    setIsRecording(false);
  };

  const handleSubmit = async () => {
    const hasText = form.description.trim().length > 0;
    const hasAudio = !!audioBlobRef.current;
    const hasPhotos = form.photos.length > 0;

    if (!hasText && !hasAudio && !hasPhotos) {
      alert('Please enter a description, record a voice note, or attach photos');
      return;
    }

    setSaving(true);

    let audioUrl: string | null = null;

    try {
      if (hasAudio && audioBlobRef.current) {
        try {
          setUploadingAudio(true);
          const formData = new FormData();
          formData.append('file', audioBlobRef.current, 'voice-note.webm');

          const uploadResponse = await fetch('/api/project-updates/upload-voice', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errJson = await uploadResponse.json().catch(() => null);
            console.error('Error uploading audio via API:', errJson || uploadResponse.statusText);
            alert(errJson?.error || 'Failed to upload voice note');
          } else {
            const data = await uploadResponse.json();
            audioUrl = data.url || null;
          }
        } finally {
          setUploadingAudio(false);
        }
      }

      let descriptionToSend: string;
      if (hasText) {
        descriptionToSend = form.description.trim();
      } else if (hasAudio && hasPhotos) {
        descriptionToSend = 'Voice note with photos';
      } else if (hasAudio) {
        descriptionToSend = 'Voice note';
      } else if (hasPhotos) {
        descriptionToSend = 'Photos';
      } else {
        descriptionToSend = '';
      }

      const response = await fetch('/api/project-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          update_date: form.update_date,
          description: descriptionToSend,
          photos: form.photos,
          audio_url: audioUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create update');
      }

      const { update } = await response.json();
      // Append new update at the end so it appears at the bottom of the chat
      setUpdates(prev => [...prev, update]);
      setForm({
        update_date: getTodayDateString(),
        description: '',
        photos: [],
      });
      clearAudio();
    } catch (error: any) {
      console.error('Error creating update:', error);
      alert(error.message || 'Failed to create update');
    } finally {
      setSaving(false);
    }
  };

  const getGroupLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) {
        return formatDateReadable(dateStr);
      }

      const today = new Date();
      const normalize = (d: Date) => {
        const copy = new Date(d);
        copy.setHours(0, 0, 0, 0);
        return copy.getTime();
      };

      const todayStart = normalize(today);
      const targetStart = normalize(date);
      const diffDays = Math.round((todayStart - targetStart) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      return formatDateReadable(dateStr);
    } catch {
      return formatDateReadable(dateStr);
    }
  };

  const groupedUpdates = (() => {
    const groups: { label: string; items: ProjectUpdate[] }[] = [];
    const map = new Map<string, ProjectUpdate[]>();

    for (const update of updates) {
      const label = getGroupLabel(update.update_date);
      if (!map.has(label)) {
        map.set(label, []);
      }
      map.get(label)!.push(update);
    }

    for (const [label, items] of map.entries()) {
      groups.push({ label, items });
    }

    return groups;
  })();

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const updatesThisWeek = updates.filter((u) => {
    const d = new Date(u.update_date);
    if (Number.isNaN(d.getTime())) return false;
    return d >= sevenDaysAgo;
  }).length;

  const lastUpdate = updates.length > 0 ? updates[updates.length - 1] : null;

  // Scroll to bottom of the messages list when the tab opens
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    container.scrollTop = container.scrollHeight;
  }, []);

  // After new updates arrive (e.g. after sending), scroll messages to bottom smoothly
  useEffect(() => {
    if (!messagesContainerRef.current) return;
    if (updates.length === 0) return;
    const container = messagesContainerRef.current;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [updates.length]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-3 sm:p-4 md:p-6 flex flex-col h-[70vh]">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 md:mb-6">
        <h3 className="text-base sm:text-lg font-medium leading-6 text-gray-900">Project Updates</h3>
      </div>

      {updates.length > 0 && (
        <div className="mb-4 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm text-gray-600 gap-1">
          <div>
            Updates this week:{' '}
            <span className="font-semibold text-gray-800">{updatesThisWeek}</span>
          </div>
          {lastUpdate && (
            <div>
              Last update:{' '}
              <span className="font-semibold text-gray-800">
                {formatDateTimeReadable(lastUpdate.created_at)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Timeline / messages list */}
      <div
        ref={messagesContainerRef}
        className="mt-2 space-y-4 md:space-y-6 flex-1 overflow-y-auto pr-1"
      >
        {groupedUpdates.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No updates yet. Add your first update!</p>
        ) : (
          groupedUpdates.map((group) => (
            <div key={group.label}>
              <div className="mb-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{group.label}</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <div className="space-y-3">
                {group.items.map((update) => {
                  const isOwnUpdate = user && update.user.id === user.id;
                  return (
                    <div
                      key={update.id}
                      className={`flex md:gap-4 ${isOwnUpdate ? 'justify-end' : ''}`}
                    >
                      {!isOwnUpdate && (
                        <div className="flex-shrink-0 mr-2">
                          <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-800 flex items-center justify-center text-xs font-bold">
                            {update.user.full_name?.charAt(0).toUpperCase()}
                          </div>
                        </div>
                      )}

                      <div className={`flex-1 flex ${isOwnUpdate ? 'justify-end' : ''}`}>
                        <div
                          className={`inline-block max-w-full rounded-xl p-3 md:p-4 border shadow-sm ${
                            isOwnUpdate
                              ? 'bg-yellow-50 border-yellow-100 text-right'
                              : 'bg-gray-50 border-gray-100'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2 mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{update.user.full_name}</p>
                              <p className="text-xs text-gray-500">{formatTimeIST(update.created_at)}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{update.description}</p>

                          {/* Photos - responsive grid */}
                          {update.photos && update.photos.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {update.photos.map((photo, photoIndex) => (
                                <img
                                  key={photoIndex}
                                  src={photo}
                                  alt={`Update photo ${photoIndex + 1}`}
                                  className="w-full h-20 sm:h-24 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => {
                                    setCurrentImages(update.photos);
                                    setSelectedImageIndex(photoIndex);
                                    setSelectedImage(photo);
                                  }}
                                />
                              ))}
                            </div>
                          )}
                          {update.audio_url && (
                            <div className="mt-3">
                              <VoiceNotePlayer src={update.audio_url} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Send an update</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
            <select
              className="text-xs sm:text-sm rounded-md border border-gray-200 bg-white px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
            >
              <option value="all">All stages</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Write update for this project..."
              className="flex-1 bg-transparent border-none text-sm focus:outline-none focus:ring-0 px-1"
            />
            <label className="flex items-center justify-center w-9 h-9 rounded-md border border-gray-300 bg-white cursor-pointer hover:bg-gray-100">
              <span className="sr-only">Attach photos</span>
              <svg
                className="w-4 h-4 text-gray-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21.44 11.05 12.36 20.13a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95L10.64 17.66a2 2 0 0 1-2.83-2.83l7.07-7.07" />
              </svg>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                disabled={uploadingPhotos}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={saving || uploadingAudio}
              aria-label={isRecording ? 'Stop recording' : 'Record voice'}
              className="w-9 h-9 rounded-md border border-gray-300 flex items-center justify-center bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 ${isRecording ? 'text-red-500' : 'text-gray-700'}`}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z" />
                <path d="M7 11a1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0z" />
              </svg>
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || uploadingPhotos || uploadingAudio || isRecording}
              className="px-4 py-1.5 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Sending...' : 'Send'}
            </button>
          </div>
          {isRecording && (
            <p className="text-xs text-red-500">Recording...</p>
          )}
          {uploadingPhotos && (
            <p className="text-xs text-gray-500">Uploading photos...</p>
          )}
          {audioPreviewUrl && (
            <div className="mt-1 flex items-center gap-3">
              <audio controls src={audioPreviewUrl} className="w-full sm:w-auto" />
              <button
                type="button"
                onClick={clearAudio}
                className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50"
              >
                Remove audio
              </button>
            </div>
          )}
          {form.photos.length > 0 && (
            <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {form.photos.map((photo, index) => (
                <div key={index} className="relative">
                  <img src={photo} alt={`Upload ${index + 1}`} className="w-full h-20 object-cover rounded" />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-md hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Image Modal with Navigation */}
      <ImageModal
        images={currentImages}
        currentIndex={selectedImageIndex}
        isOpen={!!selectedImage}
        onClose={() => {
          setSelectedImage(null);
          setCurrentImages([]);
          setSelectedImageIndex(0);
        }}
        onNavigate={(index) => {
          setSelectedImageIndex(index);
          setSelectedImage(currentImages[index]);
        }}
      />
    </div>
  );
}

