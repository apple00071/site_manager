'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';

const projectSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional(),
  client_id: z.string().uuid('Please select a client'),
  deadline: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function NewProjectPage() {
  const { isAdmin, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    mode: 'onChange',
    defaultValues: {
      status: 'pending',
    },
  });

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    // If we've already initialized, don't run this effect again
    if (isInitialized) return;

    console.log('Auth state loaded. isAdmin:', isAdmin, 'User:', user?.email);

    // If not an admin, redirect to dashboard
    if (isAdmin === false) {
      console.log('User is not an admin, redirecting to dashboard');
      router.push('/dashboard');
      return;
    }

    // Only fetch clients if we're an admin
    const fetchClients = async () => {
      try {
        console.log('Fetching clients...');
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;
        console.log('Clients loaded:', data?.length);
        setClients(data || []);
      } catch (err) {
        console.error('Error fetching clients:', err);
        setError('Failed to load clients');
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    fetchClients();
  }, [isAdmin, router, authLoading, isInitialized, user]);

  // Show loading state while checking auth or loading data
  if (authLoading || (!isInitialized && isAdmin !== false)) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const onSubmit = async (data: ProjectFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Submitting project:', data);
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      console.log('API Response:', json);
      
      if (!res.ok) {
        const errorMessage = json.error?.message || json.error || 'Failed to create project';
        console.error('API Error:', errorMessage);
        throw new Error(errorMessage);
      }

      router.push('/dashboard/projects');
    } catch (err: any) {
      console.error('Error in onSubmit:', err);
      const errorMessage = err.message || 'An error occurred while creating the project';
      setError(errorMessage);
      
      // Show a more detailed error in the UI
      if (errorMessage.includes('permission denied')) {
        setError('Permission denied. Please ensure you have admin access.');
      } else if (errorMessage.includes('duplicate key')) {
        setError('A project with this name already exists.');
      } else if (errorMessage.includes('foreign key')) {
        setError('Invalid client selected. Please select a valid client.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(onSubmit)();
          }} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Project Title
              </label>
              <input
                id="title"
                type="text"
                {...register('title')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                {...register('description')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="client_id" className="block text-sm font-medium text-gray-700">
                Client
              </label>
              <select
                id="client_id"
                {...register('client_id')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              {errors.client_id && (
                <p className="mt-1 text-sm text-red-600">{errors.client_id.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
                Deadline
              </label>
              <input
                id="deadline"
                type="date"
                {...register('deadline')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.deadline && (
                <p className="mt-1 text-sm text-red-600">{errors.deadline.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                {...register('status')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              {errors.status && (
                <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}