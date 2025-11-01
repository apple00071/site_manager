'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type ProjectUpdate = {
  id: string;
  project_id: string;
  user_id: string;
  update_date: string;
  description: string;
  photos: string[];
  created_at: string;
  user: {
    id: string;
    name: string;
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
  
  const [form, setForm] = useState({
    update_date: new Date().toISOString().split('T')[0],
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
        update_date: new Date().toISOString().split('T')[0],
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Project Updates</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold"
        >
          {showForm ? 'Cancel' : '+ Add Update'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3">New Update</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.update_date}
                onChange={(e) => setForm(prev => ({ ...prev, update_date: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                placeholder="What was done today?"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Photos</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                disabled={uploadingPhotos}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              {uploadingPhotos && (
                <p className="text-xs text-gray-500 mt-1">Uploading photos...</p>
              )}
              {form.photos.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {form.photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img src={photo} alt={`Upload ${index + 1}`} className="w-full h-20 object-cover rounded" />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="px-4 py-2 border rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || uploadingPhotos}
                className="px-4 py-2 bg-yellow-500 text-gray-900 rounded-md hover:bg-yellow-600 text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-6">
        {updates.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No updates yet. Add your first update!</p>
        ) : (
          updates.map((update, index) => (
            <div key={update.id} className="relative">
              {/* Timeline line */}
              {index !== updates.length - 1 && (
                <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gray-200"></div>
              )}
              
              <div className="flex gap-4">
                {/* Date circle */}
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-gray-900 text-xs font-bold">
                    {new Date(update.update_date).getDate()}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatDate(update.update_date)}</p>
                      <p className="text-xs text-gray-500">by {update.user.full_name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{update.description}</p>
                  
                  {/* Photos */}
                  {update.photos && update.photos.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {update.photos.map((photo, photoIndex) => (
                        <img
                          key={photoIndex}
                          src={photo}
                          alt={`Update photo ${photoIndex + 1}`}
                          className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80"
                          onClick={() => setSelectedImage(photo)}
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

      {/* Image modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-screen p-4">
            <img src={selectedImage} alt="Full size" className="max-w-full max-h-screen object-contain" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-white text-gray-900 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

