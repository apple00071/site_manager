'use client';

import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { FiMoreVertical, FiEdit2, FiTrash2, FiX, FiPlus } from 'react-icons/fi';
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
  user_id: string | null;
  sender_name?: string | null;
  update_date: string;
  description: string;
  photos: string[];
  created_at: string;
  updated_at?: string;
  audio_url?: string | null;
  user?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
};

type UpdatesTabProps = {
  projectId: string;
  projectTitle?: string | null;
  projectAddress?: string | null;
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

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const openExternalLink = (url: string) => {
  if (!url) return;
  
  // Median / GoNative support
  // @ts-ignore
  if (typeof window !== 'undefined' && window.median && window.median.open && window.median.open.external) {
    // @ts-ignore
    window.median.open.external({ url });
    return;
  }
  
  // Capacitor support
  // @ts-ignore
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
    try {
      // @ts-ignore
      window.Capacitor.Plugins.Browser.open({ url });
      return;
    } catch (e) {
      console.error('Capacitor browser open failed', e);
    }
  }
  
  // Standard window.open fallback
  if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
};

export function UpdatesTab({
  projectId,
  projectTitle: initialProjectTitle,
  projectAddress: initialProjectAddress,
}: UpdatesTabProps) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [showMediaMenu, setShowMediaMenu] = useState(false);

  // Refs for audio recording & photo inputs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [showAll, setShowAll] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const updatesListRef = useRef<HTMLDivElement | null>(null);
  const { hasPermission, isAdmin } = useUserPermissions();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Edit Update state
  const [editingUpdate, setEditingUpdate] = useState<ProjectUpdate | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingEditPhotos, setUploadingEditPhotos] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const canEditUpdate = (up: ProjectUpdate) => Boolean(isAdmin || hasPermission('updates.edit') || (user && up.user_id === user.id));
  const canDeleteUpdate = (up: ProjectUpdate) => Boolean(isAdmin || hasPermission('updates.delete') || (user && up.user_id === user.id));

  // Close kebab menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    if (activeMenuId) {
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  }, [activeMenuId]);

  const [form, setForm] = useState({
    update_date: getTodayDateString(),
    description: '',
    photos: [] as string[],
  });
  const [projectUsers, setProjectUsers] = useState<any[]>([]);
  const [projectTitle, setProjectTitle] = useState<string>(initialProjectTitle || '');
  const [projectAddress, setProjectAddress] = useState<string>(initialProjectAddress || '');

  useEffect(() => {
    if (initialProjectTitle) setProjectTitle(initialProjectTitle);
    if (initialProjectAddress) setProjectAddress(initialProjectAddress);
  }, [initialProjectTitle, initialProjectAddress]);
  const [deviceLocation, setDeviceLocation] = useState<{
    coords: { latitude: number; longitude: number };
    address: string;
    formattedCoords: string;
  } | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const refreshDeviceLocation = async () => {
    try {
      const { getLocationDetails } = await import('@/lib/locationUtils');
      const details = await getLocationDetails({ timeout: 6000 });
      if (details) {
        setDeviceLocation(details);
      }
    } catch {
      // silent background acquisition
    }
  };

  useEffect(() => {
    fetchUpdates();
    fetchProjectUsers();
    // Proactively acquire device location on tab mount
    refreshDeviceLocation();
  }, [projectId, user]);

  // Restore draft if WebView reloads on mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      const saved = sessionStorage.getItem(`update_draft_${projectId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.description || (parsed.photos && parsed.photos.length > 0))) {
            setForm(prev => ({
              ...prev,
              description: parsed.description || '',
              photos: Array.isArray(parsed.photos) ? parsed.photos : [],
            }));
          }
        } catch (e) {
          console.warn('Failed to restore draft:', e);
        }
      }
    }
  }, [projectId]);

  // Auto-save form draft on change
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      if (form.description.trim() || form.photos.length > 0) {
        sessionStorage.setItem(`update_draft_${projectId}`, JSON.stringify(form));
      } else {
        sessionStorage.removeItem(`update_draft_${projectId}`);
      }
    }
  }, [form, projectId]);

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


  const fetchProjectUsers = async () => {
    try {
      // 1. Fetch project members
      const response = await fetch(`/api/admin/project-members?project_id=${projectId}`);
      const result = await response.json();

      // 2. Fetch project details to get assigned employee
      const projResponse = await fetch(`/api/admin/projects?id=${projectId}`);
      const projectData = await projResponse.json();
      const project = Array.isArray(projectData) ? projectData[0] : projectData;

      if (project?.title) {
        setProjectTitle(project.title);
      }
      if (project?.address || project?.apartment_name) {
        setProjectAddress(project.address || project.apartment_name);
      }

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

  const handlePhotoUpload = async (input: React.ChangeEvent<HTMLInputElement> | FileList | File[]) => {
    let files: File[] = [];
    if (input && 'target' in input && (input.target as HTMLInputElement).files) {
      files = Array.from((input.target as HTMLInputElement).files!);
    } else if (input && Array.isArray(input)) {
      files = input;
    } else if (input && 'length' in input) {
      files = Array.from(input as FileList);
    }

    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    setUploadStatusText('Verifying device location (GPS)...');

    try {
      // 1. Strict GPS policy: Require active device GPS coordinates
      let locDetails = null;
      try {
        const { getLocationDetails } = await import('@/lib/locationUtils');
        locDetails = await getLocationDetails({ forceFresh: true, throwOnError: true, timeout: 8000 });
        if (locDetails) setDeviceLocation(locDetails);
      } catch (locErr: any) {
        let msg = 'Could not acquire your location. Please ensure device location is enabled.';
        if (locErr?.message === 'PERMISSION_DENIED') {
          msg = '📍 Location Permission Blocked: Please allow location access in your browser or device settings to upload site progress photos.';
        } else if (locErr?.message === 'GPS_DISABLED') {
          msg = '📍 Device Location (GPS) is turned OFF: You must turn ON Location in your device settings to upload site progress photos.';
        } else if (locErr?.message === 'INSECURE_CONTEXT') {
          msg = '📍 Location tracking requires a secure (HTTPS) connection.';
        } else if (locErr?.message === 'LOCATION_UNAVAILABLE') {
          msg = '📍 Location Unavailable: Could not detect your GPS coordinates. Please ensure you have GPS signal and device location turned ON.';
        }
        alert(msg);
        return;
      }

      if (!locDetails || !locDetails.coords?.latitude || !locDetails.coords?.longitude) {
        alert('📍 Device Location (GPS) is required to upload site progress photos. Please turn ON location and try again.');
        return;
      }

      // 2. Watermark photos with verified site location, GPS, timestamp & project info
      setUploadStatusText('Stamping location on photos...');
      const { watermarkPhotoWithLocation } = await import('@/lib/photoWatermark');

      const stampedFiles: File[] = [];
      for (const file of files) {
        try {
          const stamped = await watermarkPhotoWithLocation(file, {
            projectTitle: projectTitle || undefined,
            projectAddress: projectAddress || undefined,
            locationName: locDetails.address,
            coords: locDetails.coords,
            timestamp: new Date()
          });
          stampedFiles.push(stamped);
        } catch (stampErr) {
          console.warn(`Failed to stamp ${file.name}, uploading original:`, stampErr);
          stampedFiles.push(file);
        }
      }

      // 3. Upload stamped files
      setUploadStatusText('Uploading photos...');
      const { uploadFile } = await import('@/lib/uploadUtils');
      const folder = user?.id || 'anonymous';

      const uploadPromises = stampedFiles.map(async (file) => {
        try {
          const url = await uploadFile(file, 'project-update-photos', folder);
          return { url, error: null };
        } catch (err: any) {
          console.error(`Error uploading ${file.name}:`, err);
          return { url: null, error: err?.message || JSON.stringify(err) };
        }
      });

      const results = await Promise.all(uploadPromises);
      const successfulUrls = results.filter((r): r is { url: string; error: null } => r.url !== null).map(r => r.url);
      const errors = results.filter((r): r is { url: null; error: string } => r.error !== null).map(r => r.error);

      if (successfulUrls.length > 0) {
        setForm(prev => ({ ...prev, photos: [...prev.photos, ...successfulUrls] }));
      }

      if (successfulUrls.length < stampedFiles.length) {
        const failedCount = stampedFiles.length - successfulUrls.length;
        const errorDetails = errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : '';
        alert(`Successfully uploaded ${successfulUrls.length} files. ${failedCount} file(s) failed.${errorDetails}`);
      }
    } catch (error: any) {
      console.error('Error processing and uploading files:', error);
      alert(`Failed to upload files: ${error?.message || 'Unknown error'}`);
    } finally {
      setUploadingPhotos(false);
      setUploadStatusText('');
      if (input && 'target' in input && input.target) {
        (input.target as HTMLInputElement).value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleOpenEdit = (up: ProjectUpdate) => {
    setEditingUpdate(up);
    setEditDescription(up.description);
    setEditPhotos([...(up.photos || [])]);
    setActiveMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingUpdate) return;
    if (!editDescription.trim() && editPhotos.length === 0) {
      alert('Description or photos required.');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch('/api/project-updates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUpdate.id,
          description: editDescription,
          photos: editPhotos,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update');
      }
      const data = await res.json();
      const updated = data.update;
      setUpdates(prev => prev.map(u => u.id === editingUpdate.id ? { ...u, ...updated, photos: updated.photos || [] } : u));
      setEditingUpdate(null);
    } catch (err: any) {
      alert('Error updating: ' + (err?.message || 'Unknown error'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUpdate = async (id: string) => {
    setActiveMenuId(null);
    if (!confirm('Are you sure you want to delete this project update? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/project-updates?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete update');
      }
      setUpdates(prev => prev.filter(u => u.id !== id));
    } catch (err: any) {
      alert('Error deleting update: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setUploadingEditPhotos(true);
    try {
      // Strict GPS policy: Require active device GPS coordinates
      let locDetails = null;
      try {
        const { getLocationDetails } = await import('@/lib/locationUtils');
        locDetails = await getLocationDetails({ forceFresh: true, throwOnError: true, timeout: 8000 });
        if (locDetails) setDeviceLocation(locDetails);
      } catch (locErr: any) {
        let msg = 'Could not acquire your location. Please ensure device location is enabled.';
        if (locErr?.message === 'PERMISSION_DENIED') {
          msg = '📍 Location Permission Blocked: Please allow location access in your browser or device settings to upload site progress photos.';
        } else if (locErr?.message === 'GPS_DISABLED') {
          msg = '📍 Device Location (GPS) is turned OFF: You must turn ON Location in your device settings to upload site progress photos.';
        } else if (locErr?.message === 'INSECURE_CONTEXT') {
          msg = '📍 Location tracking requires a secure (HTTPS) connection.';
        } else if (locErr?.message === 'LOCATION_UNAVAILABLE') {
          msg = '📍 Location Unavailable: Could not detect your GPS coordinates. Please ensure you have GPS signal and device location turned ON.';
        }
        alert(msg);
        return;
      }

      if (!locDetails || !locDetails.coords?.latitude || !locDetails.coords?.longitude) {
        alert('📍 Device Location (GPS) is required to upload site progress photos. Please turn ON location and try again.');
        return;
      }

      const { watermarkPhotoWithLocation } = await import('@/lib/photoWatermark');
      const { uploadFile } = await import('@/lib/uploadUtils');
      const folder = user?.id || 'anonymous';

      const stampedFiles: File[] = [];
      for (const file of files) {
        try {
          const stamped = await watermarkPhotoWithLocation(file, {
            projectTitle: projectTitle || undefined,
            projectAddress: projectAddress || undefined,
            locationName: locDetails.address,
            coords: locDetails.coords,
            timestamp: new Date(),
          });
          stampedFiles.push(stamped);
        } catch {
          stampedFiles.push(file);
        }
      }

      const uploadPromises = stampedFiles.map(f => uploadFile(f, 'project-update-photos', folder));
      const urls = await Promise.all(uploadPromises);
      setEditPhotos(prev => [...prev, ...urls.filter(Boolean)]);
    } catch (err: any) {
      alert('Error uploading photos: ' + (err?.message || 'Unknown error'));
    } finally {
      setUploadingEditPhotos(false);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
    }
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
      if (typeof window !== 'undefined' && projectId) {
        sessionStorage.removeItem(`update_draft_${projectId}`);
      }
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

  const downloadPhotos = async (urls: string[]): Promise<File[]> => {
    const files: File[] = [];
    // Limit to sharing max 10 photos to prevent system share sheet crash and high download time
    const limitedUrls = urls.slice(0, 10);
    
    for (let i = 0; i < limitedUrls.length; i++) {
      const url = limitedUrls[i];
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const blob = await response.blob();
        
        const mimeType = blob.type || 'image/jpeg';
        let extension = 'jpg';
        if (mimeType === 'image/png') extension = 'png';
        else if (mimeType === 'image/webp') extension = 'webp';
        
        const file = new File([blob], `update_photo_${i + 1}.${extension}`, { type: mimeType });
        files.push(file);
      } catch (err) {
        console.error('CORS or fetch error downloading image for sharing:', url, err);
      }
    }
    return files;
  };

  const shareToWhatsApp = async (update: ProjectUpdate) => {
    if (sharingId) return;
    
    setSharingId(update.id);
    
    // Clean up description - ignore system generated placeholders like "Photos", "Voice note"
    const isDefaultLabel = update.description === 'Photos' || update.description === 'Voice note' || update.description === 'Voice note with photos';
    const cleanDescription = isDefaultLabel ? '' : update.description;

    try {
      const hasPhotos = update.photos && update.photos.length > 0;
      
      // 1. Try native Capacitor sharing first if running inside mobile app
      if (hasPhotos && Capacitor.isNativePlatform()) {
        try {
          const { Filesystem, Directory } = await import('@capacitor/filesystem');
          const { Share } = await import('@capacitor/share');
          
          const nativeFileUris: string[] = [];
          const limitedUrls = update.photos.slice(0, 10);
          
          for (let i = 0; i < limitedUrls.length; i++) {
            const url = limitedUrls[i];
            try {
              // Parse extension from URL
              let extension = 'jpg';
              const cleanUrl = url.split('?')[0].toLowerCase();
              if (cleanUrl.endsWith('.png')) extension = 'png';
              else if (cleanUrl.endsWith('.webp')) extension = 'webp';
              else if (cleanUrl.endsWith('.pdf')) extension = 'pdf';
              
              const filename = `share_photo_${i + 1}_${Date.now()}.${extension}`;
              
              // Fetch file as Blob, convert to base64, and write via native Filesystem
              // This avoids using the deprecated Filesystem.downloadFile which throws errors in v8.
              const response = await fetch(url);
              if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`);
              }
              const blob = await response.blob();
              const base64Data = await blobToBase64(blob);
              
              await Filesystem.writeFile({
                path: filename,
                data: base64Data,
                directory: Directory.Cache
              });
              
              const uriResult = await Filesystem.getUri({
                directory: Directory.Cache,
                path: filename
              });
              
              if (uriResult?.uri) {
                nativeFileUris.push(uriResult.uri);
              }
            } catch (err: any) {
              console.error('Error downloading image natively for share:', url, err);
              alert('Image download error: ' + (err?.message || JSON.stringify(err)));
            }
          }
          
          if (nativeFileUris.length > 0) {
            // Always copy description to clipboard as a reliable backup/helper
            if (cleanDescription) {
              try {
                await navigator.clipboard.writeText(cleanDescription);
              } catch (clipErr) {
                console.error('Failed to copy description to clipboard:', clipErr);
              }
            }

            const shareOptions: any = {
              files: nativeFileUris,
              dialogTitle: 'Share Update Photos'
            };

            // Android WhatsApp allows sharing both text (caption) and file when sharing exactly ONE image.
            // When sharing MULTIPLE images, WhatsApp has a bug where it ignores/discards the images if text is provided.
            if (nativeFileUris.length === 1 && cleanDescription) {
              shareOptions.text = cleanDescription;
            }
            
            await Share.share(shareOptions);
            setSharingId(null);
            return;
          }
        } catch (nativeErr: any) {
          console.error('Capacitor native share failed, trying Median/GoNative fallback:', nativeErr);
          alert('Capacitor share failed: ' + (nativeErr?.message || JSON.stringify(nativeErr)));
        }
      }

      // 1.5 Try Median/GoNative native file sharing if running inside Median/GoNative app
      // @ts-ignore
      const isMedianApp = typeof window !== 'undefined' && (window.median || window.gonative);
      if (hasPhotos && isMedianApp) {
        try {
          const medianShare = (window as any).median?.share || (window as any).gonative?.share;
          if (medianShare && typeof medianShare.downloadFile === 'function') {
            // Copy description to clipboard
            if (cleanDescription) {
              try {
                await navigator.clipboard.writeText(cleanDescription);
              } catch (e) {}
            }
            // Share the first photo natively (downloads it and triggers "Open with" system dialog on Android)
            await medianShare.downloadFile({
              url: update.photos[0],
              open: true
            });
            setSharingId(null);
            return;
          }
        } catch (medianErr: any) {
          console.error('Median native downloadFile failed, falling back to Web Share API:', medianErr);
          alert('Median downloadFile failed: ' + (medianErr?.message || JSON.stringify(medianErr)));
        }
      }

      // 2. Try to use native Web Share API with files if supported (Browser/PWA)
      if (hasPhotos && navigator.share && navigator.canShare) {
        const filesToShare = await downloadPhotos(update.photos);
        
        if (filesToShare.length > 0) {
          // Copy description to clipboard
          if (cleanDescription) {
            try {
              await navigator.clipboard.writeText(cleanDescription);
            } catch (e) {}
          }

          const shareData: ShareData = {
            files: filesToShare,
          };
          
          // Only include text for single file shares to prevent WhatsApp from discarding multi-file shares.
          if (filesToShare.length === 1 && cleanDescription) {
            shareData.text = cleanDescription;
          }
          
          if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
            setSharingId(null);
            return;
          }
        }
      }
      
      // 3. Fallback to direct WhatsApp link redirect (e.g. desktop/unsupported browser)
      let fallbackMessage = '';
      if (cleanDescription) {
        fallbackMessage += `${cleanDescription}\n\n`;
      }
      
      if (hasPhotos) {
        update.photos.forEach((url) => {
          fallbackMessage += `${url}\n`;
        });
      }
      
      if (update.audio_url) {
        fallbackMessage += `${update.audio_url}\n`;
      }
      
      fallbackMessage = fallbackMessage.trim();
      
      if (fallbackMessage) {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fallbackMessage)}`;
        openExternalLink(waUrl);
      }
    } catch (shareError) {
      console.error('Error sharing update:', shareError);
      
      if (cleanDescription) {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(cleanDescription)}`;
        openExternalLink(waUrl);
      }
    } finally {
      setSharingId(null);
    }
  };

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
              {/* Media Upload Menu Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMediaMenu(prev => !prev)}
                  disabled={uploadingPhotos}
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                  title="Add Photo or Take Photo"
                >
                  <svg
                    className="w-5 h-5 text-gray-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* Persistent hidden inputs so they stay mounted when menu closes */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {showMediaMenu && (
                  <div className="absolute bottom-12 left-0 z-30 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 flex flex-col text-sm">
                    {/* Option 1: Camera */}
                    <button
                      type="button"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-medium text-left w-full"
                      onClick={() => {
                        setShowMediaMenu(false);
                        if (!deviceLocation) refreshDeviceLocation();
                        cameraInputRef.current?.click();
                      }}
                    >
                      <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Take Photo</span>
                    </button>

                    {/* Option 2: Gallery */}
                    <button
                      type="button"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-gray-700 font-medium border-t border-gray-100 text-left w-full"
                      onClick={() => {
                        setShowMediaMenu(false);
                        if (!deviceLocation) refreshDeviceLocation();
                        galleryInputRef.current?.click();
                      }}
                    >
                      <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Choose from Gallery</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
            {uploadingPhotos && (
              <div className="flex items-center gap-2 text-xs text-yellow-600 font-medium animate-pulse">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {uploadStatusText || `Processing ${form.photos.length > 0 ? 'additional' : ''} files...`}
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || uploadingPhotos || isRecording || (!form.description.trim() && !audioBlobRef.current && form.photos.length === 0)}
              className={`px-4 py-2 rounded-md transition-colors ${isRecording
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
                }`}
            >
              {saving ? 'Posting...' : 'Post to Timeline'}
            </button>
          </div>

          {/* Status indicators */}
          {isRecording && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              Recording voice note...
            </div>
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
                        <div className="w-14 h-14 bg-gray-50 rounded-lg border border-gray-200 flex flex-col items-center justify-center p-1">
                          <span className="text-[10px] text-red-600 font-bold">PDF</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <img src={url} className="w-14 h-14 object-cover rounded-lg border border-gray-200 shadow-xs" />
                          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 text-[8px] text-amber-300 font-semibold px-1 py-0.5 rounded-b-lg flex items-center justify-center gap-0.5 truncate backdrop-blur-xs">
                            <span>📍 Stamped</span>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full !w-5 !h-5 flex items-center justify-center shadow-md z-10 !min-w-0 !min-h-0"
                        style={{ width: '20px', height: '20px', minWidth: '0', minHeight: '0' }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <p className="text-gray-500">No timeline updates yet. Add your first update!</p>
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
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                              update.sender_name && !update.user_id
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {(update.sender_name || update.user?.full_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900 truncate">
                                  {update.sender_name && !update.user_id ? update.sender_name : update.user?.full_name || 'Team'}
                                </h4>
                                {update.sender_name && !update.user_id && (
                                  <span className="text-[9px] font-bold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">Client</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{formatDateTimeReadable(update.created_at)}</p>
                            </div>
                          </div>
                          
                          {/* Actions: Share, Edit, Delete */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Share to WhatsApp Button */}
                            <button
                              type="button"
                              onClick={() => shareToWhatsApp(update)}
                              disabled={sharingId !== null}
                              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#25D366] hover:bg-[#20ba5a] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-full shadow-sm hover:shadow transition-all shrink-0 active:scale-95 cursor-pointer"
                              title="Share update to WhatsApp"
                            >
                              {sharingId === update.id ? (
                                <>
                                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  <span>Preparing...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.197 1.489 4.921 1.49 5.518 0 10.017-4.493 10.02-10.007.003-2.67-1.03-5.178-2.91-7.06C16.745 1.696 14.25 1.662 11.995 1.66c-5.521 0-10.02 4.494-10.022 10.009-.001 1.767.469 3.493 1.36 5.011L2.247 21.91l4.4-1.756zM16.96 13.43c-.27-.135-1.597-.788-1.845-.878-.248-.09-.43-.135-.61.135-.18.27-.698.878-.857 1.058-.158.18-.317.202-.587.067-.27-.135-1.14-.42-2.172-1.34-.803-.715-1.344-1.6-1.503-1.87-.158-.27-.017-.417.118-.552.122-.122.27-.315.405-.472.135-.158.18-.27.27-.45.09-.18.045-.337-.023-.472-.068-.135-.61-1.47-.837-2.013-.218-.527-.44-.456-.6-.464-.166-.008-.356-.01-.546-.01-.19 0-.5.07-.76.36-.26.29-1.02 1-1.02 2.43 0 1.43 1.04 2.81 1.18 3 .14.19 2.05 3.13 4.96 4.385.69.3 1.23.48 1.65.61.697.22 1.33.19 1.83.12.558-.08 1.598-.65 1.828-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.19-.52-.325z"/>
                                  </svg>
                                  <span>Share</span>
                                </>
                              )}
                            </button>

                            {/* Kebab Menu: Edit / Delete */}
                            {(canEditUpdate(update) || canDeleteUpdate(update)) && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(activeMenuId === update.id ? null : update.id);
                                  }}
                                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                                  title="Update actions"
                                >
                                  <FiMoreVertical className="w-4 h-4" />
                                </button>

                                {activeMenuId === update.id && (
                                  <div
                                    className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {canEditUpdate(update) && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEdit(update)}
                                        className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                                      >
                                        <FiEdit2 className="w-3.5 h-3.5 text-gray-500" />
                                        <span>Edit</span>
                                      </button>
                                    )}
                                    {canDeleteUpdate(update) && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteUpdate(update.id)}
                                        className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                                      >
                                        <FiTrash2 className="w-3.5 h-3.5 text-red-500" />
                                        <span>Delete</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
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

      {/* Edit Update Modal */}
      {editingUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Edit Project Update</h3>
              <button
                type="button"
                onClick={() => setEditingUpdate(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Description</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 resize-none"
                  placeholder="Update description..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-700">Photos ({editPhotos.length})</label>
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploadingEditPhotos}
                    className="text-xs font-semibold text-yellow-600 hover:text-yellow-700 flex items-center gap-1 cursor-pointer"
                  >
                    <FiPlus className="w-3.5 h-3.5" />
                    <span>Add Photos</span>
                  </button>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleEditPhotoUpload}
                    className="hidden"
                  />
                </div>

                {uploadingEditPhotos && (
                  <div className="text-xs text-yellow-600 font-medium py-1 animate-pulse flex items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-ping"></span>
                    <span>Watermarking and uploading new photos...</span>
                  </div>
                )}

                {editPhotos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {editPhotos.map((url, pIdx) => (
                      <div key={pIdx} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square">
                        <img src={url} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditPhotos(prev => prev.filter((_, i) => i !== pIdx))}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md hover:bg-red-700 cursor-pointer"
                          title="Remove photo"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No photos attached</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setEditingUpdate(null)}
                disabled={savingEdit}
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit || uploadingEditPhotos || (!editDescription.trim() && editPhotos.length === 0)}
                className="px-5 py-2 text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 rounded-xl shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UpdatesTab;

