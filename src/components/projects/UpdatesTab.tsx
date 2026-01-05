'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateReadable, formatDateTimeReadable, formatTimeIST, getTodayDateString } from '@/lib/dateUtils';
import { ImageModal } from '@/components/ui/ImageModal';
import { MentionTextarea } from '@/components/ui/MentionTextarea';

declare global {
  interface Window {
    MSStream?: any;
  }
}

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
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);

  // Project state
  const [selectedStageId, setSelectedStageId] = useState('all');
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const updatesListRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    update_date: getTodayDateString(),
    description: '',
    photos: [] as string[],
  });
  const [projectUsers, setProjectUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUpdates();
    fetchStages();
    fetchProjectUsers();
  }, [projectId, user]);

  // Removed auto-scrolling to prevent jumping to bottom

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/project-updates?project_id=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch updates');
      const { updates: fetchedUpdates } = await response.json();

      // Helper to normalize photos to always be an array
      const normalizePhotos = (photos: any): string[] => {
        if (!photos) return [];

        // If it's already an array, filter out non-strings
        if (Array.isArray(photos)) {
          return photos.filter(p => typeof p === 'string' && p.trim().length > 0);
        }

        if (typeof photos === 'string') {
          const trimmed = photos.trim();
          // Check if it's a JSON array string
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const parsed = JSON.parse(trimmed);
              return Array.isArray(parsed)
                ? parsed.filter((p: any) => typeof p === 'string' && p.length > 0)
                : [];
            } catch (e) {
              console.warn('Failed to parse photos JSON:', trimmed);
              return [];
            }
          }
          // Treat as single URL if it looks like one (basic check) or just non-empty
          return trimmed.length > 0 ? [trimmed] : [];
        }

        return [];
      };

      // Normalize photos for each update
      const normalizedUpdates = (fetchedUpdates || []).map((update: any) => ({
        ...update,
        photos: normalizePhotos(update.photos),
      }));

      // Sort newest -> oldest for latest first display
      const sortedUpdates = normalizedUpdates.slice().sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Always ensure newest updates are at the top
      setUpdates(prev => {
        // If no existing updates or the first update is the same as the first new one, just return the new ones
        if (prev.length === 0 || (prev[0] && sortedUpdates[0] && prev[0].id === sortedUpdates[0].id)) {
          return sortedUpdates;
        }
        // Otherwise merge and sort
        const merged = [...prev, ...sortedUpdates];
        return merged
          .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // Remove duplicates
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStages = async () => {
    try {
      // Fetch unique work descriptions from site_logs to use as stages
      const response = await fetch(`/api/site-logs?project_id=${projectId}`);
      if (!response.ok) {
        console.error('Failed to fetch site logs for stages');
        return;
      }

      const data = await response.json();
      const logs = data.logs || [];

      // Extract unique work descriptions as stages
      const uniqueDescriptions = new Map<string, string>();
      logs.forEach((log: any) => {
        if (log.work_description && log.id) {
          // Use first occurrence of each work description
          const desc = log.work_description.trim();
          if (!uniqueDescriptions.has(desc)) {
            uniqueDescriptions.set(desc, log.id);
          }
        }
      });

      const mapped = Array.from(uniqueDescriptions.entries()).map(([title, id]) => ({
        id,
        title
      }));

      setStages(mapped);
    } catch (error) {
      console.error('Error fetching stages from site logs:', error);
    }
  };

  const fetchProjectUsers = async () => {
    try {
      // 1. Fetch project members
      const response = await fetch(`/api/admin/project-members?project_id=${projectId}`);
      const result = await response.json();

      // 2. Fetch project details to get assigned employee
      const projResponse = await fetch(`/api/admin/projects?id=${projectId}`);
      const projectData = await projResponse.json();
      const project = Array.isArray(projectData) ? projectData[0] : projectData;

      const combinedUsers: any[] = [];
      const userIds = new Set<string>();

      // Helper to add user if not duplicate and not current user
      const addUser = (u: any) => {
        if (!u || !u.id || u.id === user?.id || userIds.has(u.id)) return;

        const name = u.full_name || u.name || 'Unknown';
        const fallbackUsername = name !== 'Unknown'
          ? name.toLowerCase().replace(/\s+/g, '')
          : u.email?.split('@')[0] || 'user';

        combinedUsers.push({
          id: u.id,
          full_name: name,
          username: u.username || fallbackUsername
        });
        userIds.add(u.id);
      };

      // Add Project Members from API
      if (result.success && result.members) {
        result.members.forEach((m: any) => {
          if (m.users) addUser(m.users);
        });
      }

      // Add Assigned Employee if they exist
      if (project?.assigned_employee) {
        addUser({
          id: project.assigned_employee.id,
          full_name: project.assigned_employee.name,
          email: project.assigned_employee.email,
        });
      }

      // Add Project Creator (Admin) if they exist - use the creator field from project data
      if (project?.creator) {
        const creator = project.creator;
        addUser({
          id: creator.id,
          full_name: creator.full_name || creator.name,
          email: creator.email,
          username: creator.username,
        });
      }

      setProjectUsers(combinedUsers);
    } catch (err) {
      console.error('Error fetching project users:', err);
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
          console.error('Error uploading file:', error);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('project-update-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      setForm(prev => ({ ...prev, photos: [...prev.photos, ...uploadedUrls] }));
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload some files');
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
    console.log('Starting recording process...');

    // Enhanced error handler with more context
    const showError = (message: string, error?: any) => {
      console.error('Recording Error:', { message, error });
      // More user-friendly error message
      const userMessage = error?.message
        ? `${message}\n\n(Error: ${error.message})`
        : message;
      alert(userMessage);
    };

    try {
      // Basic environment checks
      if (typeof window === 'undefined') {
        throw new Error('This feature is only available in the browser.');
      }

      // Check if we're on a mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('Device type:', isMobile ? 'Mobile' : 'Desktop');

      // Check for required APIs
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        const missingApis = [];
        if (!navigator.mediaDevices?.getUserMedia) missingApis.push('getUserMedia');
        if (!window.MediaRecorder) missingApis.push('MediaRecorder');

        throw new Error(
          `Your browser doesn't support required audio recording features.\n` +
          `Missing: ${missingApis.join(', ')}.\n\n` +
          'Please try using the latest version of Chrome or Firefox on your device.'
        );
      }

      console.log('Requesting microphone access...');

      // Configure audio constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      // Request microphone access with better error handling
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error: any) {
        console.error('Microphone access error:', error);

        if (error.name === 'NotAllowedError') {
          // Check if this is a mobile device that might need HTTPS
          if (isMobile && window.location.protocol !== 'https:') {
            throw new Error(
              'Microphone access requires a secure (HTTPS) connection on mobile devices. ' +
              'Please ensure you are using a secure connection.'
            );
          }
          throw new Error(
            'Microphone access was denied. ' +
            (isMobile
              ? 'Please check your browser settings and ensure the app has microphone permissions.'
              : 'Please allow microphone access in your browser settings.'
            )
          );
        }

        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          throw new Error('No microphone found. Please ensure your device has a working microphone.');
        }

        if (error.name === 'NotReadableError') {
          throw new Error('Could not access the microphone. It might be in use by another application.');
        }

        throw new Error(`Could not access microphone: ${error.message || 'Unknown error'}`);
      }

      console.log('Microphone access granted');

      console.log('Microphone access granted, initializing recorder...');

      // Try to create MediaRecorder with fallback options
      let recorder: MediaRecorder;
      try {
        // Try different MIME types in order of preference
        const mimeTypes = [
          'audio/webm;codecs=opus',  // Most common and widely supported
          'audio/webm',              // Fallback to basic webm
          'audio/mp4',               // For Safari
          'audio/ogg;codecs=opus',   // For older browsers
          'audio/ogg',               // Basic ogg fallback
          ''                         // Let the browser decide
        ];

        // Find the first supported MIME type
        const supportedType = mimeTypes.find(type => !type || MediaRecorder.isTypeSupported(type));
        console.log('Using MIME type:', supportedType || 'browser default');

        const options = supportedType ? { mimeType: supportedType } : undefined;
        recorder = new MediaRecorder(stream, options);

        // Check for iOS-specific issues
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        if (isIOS) {
          console.log('iOS device detected - applying workarounds');
          // iOS may need additional handling
        }

      } catch (error) {
        console.error('Error initializing MediaRecorder:', error);
        // Clean up the stream
        stream.getTracks().forEach(track => {
          track.stop();
        });

        // Provide more specific error for iOS
        if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream) {
          throw new Error(
            'Audio recording on iOS has some limitations. ' +
            'Please ensure you are using Safari and have granted microphone permissions.'
          );
        }

        throw new Error('This browser or device does not support audio recording: ' + (error as Error).message);
      }

      // Set up recording
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      audioBlobRef.current = null;
      setAudioPreviewUrl(null);

      // Handle data available event
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          console.log('Audio data received:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      recorder.onstop = () => {
        console.log('Recording stopped');

        // Stop all tracks in the stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        if (!audioChunksRef.current.length) {
          console.log('No audio data was recorded');
          setIsRecording(false);
          return;
        }

        try {
          // Create audio blob with the correct MIME type
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mimeType });

          audioBlobRef.current = blob;
          setAudioPreviewUrl(URL.createObjectURL(blob));
          console.log('Audio recording created successfully');
        } catch (error) {
          console.error('Error creating audio blob:', error);
          showError('Failed to process recording. Please try again.');
        } finally {
          setIsRecording(false);
          audioChunksRef.current = [];
        }
      };

      // Handle errors
      recorder.onerror = (event: Event) => {
        console.error('Recording error:', event);

        // Stop all tracks in the stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        setIsRecording(false);
        showError('An error occurred while recording. Please try again.');
      };

      // Start recording
      try {
        // Start recording and request data every second
        recorder.start(1000);
        setIsRecording(true);
        console.log('Recording started');
      } catch (error) {
        console.error('Error starting recording:', error);

        // Stop all tracks in the stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        throw new Error('Could not start recording. Please try again.');
      }
    } catch (error: any) {
      console.error('Recording failed:', error);
      showError(error.message || 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    try {
      // Stop the MediaRecorder
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Make sure to clean up the stream
      const stream = mediaRecorderRef.current.stream;
      if (stream) {
        setTimeout(() => {
          stream.getTracks().forEach(track => {
            if (track.readyState === 'live') {
              track.stop();
            }
          });
        }, 1000);
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
    setAudioPreviewUrl(null);
    audioBlobRef.current = null;
    audioChunksRef.current = [];
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

      // Prepend selected work name if a specific work is selected
      if (selectedStageId && selectedStageId !== 'all') {
        const selectedWork = stages.find(s => s.id === selectedStageId);
        if (selectedWork) {
          descriptionToSend = `[${selectedWork.title}] ${descriptionToSend}`;
        }
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

      // Helper to normalize photos to always be an array
      const normalizePhotos = (photos: any): string[] => {
        if (!photos) return [];
        if (Array.isArray(photos)) return photos;
        if (typeof photos === 'string') {
          if (photos.startsWith('[')) {
            try {
              const parsed = JSON.parse(photos);
              return Array.isArray(parsed) ? parsed : [photos];
            } catch {
              return [photos];
            }
          }
          return [photos];
        }
        return [];
      };

      // Normalize photos in the returned update
      const normalizedUpdate = {
        ...update,
        photos: normalizePhotos(update.photos),
      };

      // Add new update to the top of the list
      setUpdates(prev => [normalizedUpdate, ...prev]);
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
    <div className="bg-white shadow sm:rounded-lg">
      {/* Add Update Section */}
      <div className="border-b border-gray-200 p-4">
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
            <MentionTextarea
              value={form.description}
              onChange={(val) => setForm(prev => ({ ...prev, description: val }))}
              users={projectUsers}
              placeholder="What's the progress on this project? (Use @ to mention)"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none min-h-[100px]"
            />
          </div>

          {/* Media upload and actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRecording ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-5 h-5 bg-red-500 rounded-full animate-ping opacity-75"></div>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
                      disabled={uploadingPhotos || saving}
                      aria-label="Stop recording"
                    >
                      <div className="w-4 h-4 bg-white rounded-sm"></div>
                    </button>
                  </div>
                  <span className="text-sm font-medium text-red-700">Recording...</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
                  disabled={uploadingPhotos || saving}
                  aria-label="Record voice note"
                >
                  <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V22h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </button>
              )}
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
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhotos}
                  className="hidden"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || uploadingPhotos || isRecording || (!form.description.trim() && !audioBlobRef.current && form.photos.length === 0)}
              className={`px-4 py-2 rounded-md transition-colors ${isRecording
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
                }`}
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
            <div className="flex flex-col gap-3 p-3 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">{form.photos.length} file(s) selected</span>
                </div>
                <button
                  onClick={() => setForm(prev => ({ ...prev, photos: [] }))}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.photos.map((url, idx) => {
                  const isPDF = url.toLowerCase().endsWith('.pdf');
                  return (
                    <div key={idx} className="relative group">
                      {isPDF ? (
                        <div className="w-12 h-12 bg-gray-50 rounded border border-gray-200 flex flex-col items-center justify-center p-1">
                          <span className="text-[10px] text-red-600 font-bold">PDF</span>
                        </div>
                      ) : (
                        <img src={url} className="w-12 h-12 object-cover rounded border border-gray-200" />
                      )}
                      <button
                        onClick={() => setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"
                      >
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Updates Feed */}
      <div ref={updatesListRef} className="p-4">
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
                              {update.photos.map((photo: string, photoIndex: number) => {
                                const isPDF = photo.toLowerCase().endsWith('.pdf');
                                return (
                                  <div
                                    key={photoIndex}
                                    className="aspect-square rounded-sm overflow-hidden cursor-pointer border border-gray-200 bg-gray-50"
                                    onClick={() => {
                                      if (isPDF) {
                                        window.open(photo, '_blank');
                                      } else {
                                        setCurrentImages(update.photos);
                                        setSelectedImageIndex(photoIndex);
                                        setSelectedImage(photo);
                                      }
                                    }}
                                  >
                                    {isPDF ? (
                                      <div className="w-full h-full flex flex-col items-center justify-center p-1">
                                        <svg className="w-6 h-6 text-red-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-[8px] text-gray-500 font-bold uppercase">PDF</span>
                                      </div>
                                    ) : (
                                      <img
                                        src={photo}
                                        alt={`Update photo ${photoIndex + 1}`}
                                        className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                                      />
                                    )}
                                  </div>
                                );
                              })}
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

export default UpdatesTab;

