'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateReadable, formatDateTimeReadable, getTodayDateString } from '@/lib/dateUtils';
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
  user: {
    id: string;
    full_name: string;
    email: string;
  };
};

type UpdatesTabProps = {
  projectId: string;
};

export function UpdatesTab({ projectId }: UpdatesTabProps) {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  
  const [form, setForm] = useState({
    update_date: getTodayDateString(),
    description: '',
    photos: [] as string[],
  });

  useEffect(() => {
    fetchUpdates();
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
      setUpdates(fetchedUpdates || []);
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setLoading(false);
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

  const handleSubmit = async () => {
    if (!form.description.trim()) {
      alert('Please enter a description');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/project-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          update_date: form.update_date,
          description: form.description.trim(),
          photos: form.photos,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create update');
      }

      const { update } = await response.json();
      setUpdates(prev => [update, ...prev]);
      setShowForm(false);
      setForm({
        update_date: getTodayDateString(),
        description: '',
        photos: [],
      });
    } catch (error: any) {
      console.error('Error creating update:', error);
      alert(error.message || 'Failed to create update');
    } finally {
      setSaving(false);
    }
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 md:mb-6">
        <h3 className="text-base sm:text-lg font-medium leading-6 text-gray-900">Project Updates</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold w-full sm:w-auto"
        >
          {showForm ? 'Cancel' : '+ Add Update'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 md:mb-6 p-3 md:p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3">New Update</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.update_date}
                onChange={(e) => setForm(prev => ({ ...prev, update_date: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                placeholder="What was done today?"
                className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Photos (Multiple)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                disabled={uploadingPhotos}
                className="w-full border rounded-md px-3 py-2 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
              />
              {uploadingPhotos && (
                <p className="text-xs text-gray-500 mt-1">Uploading photos...</p>
              )}
              {form.photos.length > 0 && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
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
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || uploadingPhotos}
                className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold disabled:opacity-50 w-full sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4 md:space-y-6">
        {updates.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No updates yet. Add your first update!</p>
        ) : (
          updates.map((update, index) => (
            <div key={update.id} className="relative">
              {/* Timeline line - hidden on mobile */}
              {index !== updates.length - 1 && (
                <div className="hidden md:block absolute left-4 top-10 bottom-0 w-0.5 bg-gray-200"></div>
              )}

              <div className="flex gap-3 md:gap-4">
                {/* Date circle - removed, was duplicate */}

                {/* Content */}
                <div className="flex-1 bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{formatDateReadable(update.update_date)}</p>
                      <p className="text-xs text-gray-500">by {update.user.full_name}</p>
                    </div>
                    <div className="text-xs text-gray-400 space-y-0.5">
                      <div>Created: {formatDateTimeReadable(update.created_at)}</div>
                      {update.updated_at && update.updated_at !== update.created_at && (
                        <div>Updated: {formatDateTimeReadable(update.updated_at)}</div>
                      )}
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
                </div>
              </div>
            </div>
          ))
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

