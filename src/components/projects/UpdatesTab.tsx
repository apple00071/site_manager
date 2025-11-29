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

type ProjectStage = {
  id: string;
  title: string;
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
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('all');
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const updatesListRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    update_date: getTodayDateString(),
    description: '',
    photos: [] as string[],
  });

  useEffect(() => {
    fetchUpdates();
    fetchStages();
  }, [projectId]);

  useEffect(() => {
    const el = updatesListRef.current;
    if (!el) return;
    const toBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    toBottom();
    const raf = requestAnimationFrame(toBottom);
    const t = setTimeout(toBottom, 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [updates]);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/project-updates?project_id=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch updates');
      const { updates: fetchedUpdates } = await response.json();
      
      // Sort newest -> oldest for latest first display
      const sortedUpdates = (fetchedUpdates || []).slice().sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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

      // Check if mediaDevices.getUserMedia is available
      if (!navigator.mediaDevices.getUserMedia) {
        alert('Audio recording is not supported in this browser. Please try a different browser like Chrome or Firefox.');
        return;
      }

      // Request microphone access with better error handling
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          } 
        });
      } catch (error: any) {
        if (error.name === 'NotAllowedError') {
          alert('Microphone access was denied. Please allow microphone access to record voice notes.');
        } else if (error.name === 'NotFoundError') {
          alert('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError') {
          alert('Microphone is being used by another application. Please close other apps using the microphone and try again.');
        } else {
          alert('Unable to access microphone: ' + error.message);
        }
        return;
      }

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
      // Append new update to the list
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  // Render Updates content with composer at top and messages below
  return (
    <>
      <div className="flex flex-col min-h-0 h-full bg-white overflow-hidden">
        {/* Add Update Section - Now at the top */}
        <div className="border-t border-gray-200 bg-gray-50 p-4 order-2">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Stage selector */}
              <div className="flex-1 sm:flex-none sm:w-48">
                <select
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
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
              </div>
            </div>

            {/* Description field */}
            <div>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What's the progress on this project?"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none"
              />
            </div>

            {/* Media upload and actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Photo upload */}
                <label className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white cursor-pointer hover:bg-gray-50 transition-colors">
                  <svg
                    className="w-5 h-5 text-gray-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                
                {/* Voice recording */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={saving || uploadingAudio || isRecording}
                  aria-label={isRecording ? 'Stop recording' : 'Record voice'}
                  className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <svg
                    className={`w-5 h-5 ${isRecording ? 'text-red-500' : 'text-gray-700'}`}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z" />
                    <path d="M7 11a1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0z" />
                  </svg>
                </button>
              </div>
              
              <button
                onClick={handleSubmit}
                disabled={saving || uploadingPhotos || uploadingAudio || isRecording}
                className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {saving ? 'Posting...' : 'Post Update'}
              </button>
            </div>
            
            {/* Status indicators */}
            {isRecording && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                Recording voice note...
              </div>
            )}
            
            {uploadingPhotos && (
              <p className="text-sm text-gray-500">Uploading photos...</p>
            )}
            
            {/* Photo previews */}
            {form.photos.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700">{form.photos.length} photo(s) selected</span>
                </div>
                <button
                  onClick={() => setForm(prev => ({ ...prev, photos: [] }))}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Updates Feed - Now below the composer */}
        <div ref={updatesListRef} className="flex-1 min-h-0 overflow-y-auto order-3">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
            </div>
          ) : updates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-4xl mb-4">📝</div>
              <p className="text-gray-500">No updates yet. Add your first update!</p>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {(showAll ? groupedUpdates : groupedUpdates.slice(0, 2)).map((group) => (
                  <div key={group.label}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{group.label}</h3>
                    <div className="space-y-4">
                      {group.items.map((update: ProjectUpdate) => (
                        <div
                          key={update.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {update.user.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900">{update.user.full_name}</h4>
                              <p className="text-sm text-gray-500">{formatDateTimeReadable(update.created_at)}</p>
                            </div>
                          </div>
                          
                          <div className="text-gray-700 mb-3 whitespace-pre-wrap">{update.description}</div>

                          {/* Photos Grid */}
                          {update.photos && update.photos.length > 0 && (
                            <div className="mb-3">
                              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-0.5">
                                {update.photos.map((photo: string, photoIndex: number) => (
                                  <div
                                    key={photoIndex}
                                    className="aspect-square rounded-sm overflow-hidden cursor-pointer border border-gray-200"
                                    onClick={() => {
                                      setCurrentImages(update.photos);
                                      setSelectedImageIndex(photoIndex);
                                      setSelectedImage(photo);
                                    }}
                                  >
                                    <img
                                      src={photo}
                                      alt={`Update photo ${photoIndex + 1}`}
                                      className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Voice Note */}
                          {update.audio_url && (
                            <div className="mb-3">
                              <VoiceNotePlayer src={update.audio_url} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Show More/Less Button */}
              {groupedUpdates.length > 2 && (
                <div className="text-center py-4">
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-semibold transition-colors"
                  >
                    {showAll ? 'Show Less' : `Show More (${groupedUpdates.length - 2} more groups)`}
                  </button>
                </div>
              )}
            </>
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
    </>
  );
}

export default UpdatesTab;

