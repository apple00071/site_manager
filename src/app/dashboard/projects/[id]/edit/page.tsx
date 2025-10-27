'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import Link from 'next/link';
import BackButton from '@/components/BackButton';

const projectSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  customer_name: z.string().min(2, 'Customer name is required'),
  phone_number: z.string().min(10, 'Phone number is required'),
  alt_phone_number: z.string().optional().nullable(),
  address: z.string().min(5, 'Address is required'),
  start_date: z.string().min(1, 'Start date is required'),
  estimated_completion_date: z.string().min(1, 'Estimated completion date is required'),
  assigned_employee_id: z.string().uuid('Please select an employee'),
  designer_name: z.string().min(2, 'Designer name is required'),
  designer_phone: z.string().min(10, 'Designer phone is required'),
  carpenter_name: z.string().optional().nullable(),
  carpenter_phone: z.string().optional().nullable(),
  electrician_name: z.string().optional().nullable(),
  electrician_phone: z.string().optional().nullable(),
  plumber_name: z.string().optional().nullable(),
  plumber_phone: z.string().optional().nullable(),
  painter_name: z.string().optional().nullable(),
  painter_phone: z.string().optional().nullable(),
  project_budget: z.string().optional().nullable(),
  project_notes: z.string().optional().nullable(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface Employee {
  id: string;
  name: string;
  email: string;
  designation: string;
}

export default function EditProjectPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projectError) throw projectError;
        setProject(projectData);

        // Fetch employees
        const { data: employeesData, error: employeesError } = await supabase
          .from('users')
          .select('id, full_name, email, designation')
          .eq('role', 'employee')
          .order('full_name', { ascending: true });

        if (employeesError) throw employeesError;
        setEmployees((employeesData || []).map(u => ({
          id: u.id,
          name: u.full_name,
          email: u.email,
          designation: u.designation
        })));

        // Reset form with project data
        reset({
          title: projectData.title,
          description: projectData.description || '',
          status: projectData.status,
          customer_name: projectData.customer_name,
          phone_number: projectData.phone_number,
          alt_phone_number: projectData.alt_phone_number || '',
          address: projectData.address,
          start_date: projectData.start_date ? new Date(projectData.start_date).toISOString().split('T')[0] : '',
          estimated_completion_date: projectData.estimated_completion_date ? new Date(projectData.estimated_completion_date).toISOString().split('T')[0] : '',
          assigned_employee_id: projectData.assigned_employee_id,
          designer_name: projectData.designer_name,
          designer_phone: projectData.designer_phone,
          carpenter_name: projectData.carpenter_name || '',
          carpenter_phone: projectData.carpenter_phone || '',
          electrician_name: projectData.electrician_name || '',
          electrician_phone: projectData.electrician_phone || '',
          plumber_name: projectData.plumber_name || '',
          plumber_phone: projectData.plumber_phone || '',
          painter_name: projectData.painter_name || '',
          painter_phone: projectData.painter_phone || '',
          project_budget: projectData.project_budget ? projectData.project_budget.toString() : '',
          project_notes: projectData.project_notes || '',
        });

      } catch (error) {
        console.error('Error fetching data:', error);
        router.push('/dashboard/projects');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchData();
    }
  }, [projectId, user, router, reset]);

  const onSubmit = async (data: ProjectFormValues) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          title: data.title,
          description: data.description || null,
          status: data.status,
          customer_name: data.customer_name,
          phone_number: data.phone_number,
          alt_phone_number: data.alt_phone_number || null,
          address: data.address,
          start_date: data.start_date,
          estimated_completion_date: data.estimated_completion_date,
          assigned_employee_id: data.assigned_employee_id,
          designer_name: data.designer_name,
          designer_phone: data.designer_phone,
          carpenter_name: data.carpenter_name || null,
          carpenter_phone: data.carpenter_phone || null,
          electrician_name: data.electrician_name || null,
          electrician_phone: data.electrician_phone || null,
          plumber_name: data.plumber_name || null,
          plumber_phone: data.plumber_phone || null,
          painter_name: data.painter_name || null,
          painter_phone: data.painter_phone || null,
          project_budget: data.project_budget ? parseFloat(data.project_budget) : null,
          project_notes: data.project_notes || null,
        })
        .eq('id', projectId);

      if (error) throw error;
      
      router.push('/dashboard/projects');
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Project not found</p>
        <Link href="/dashboard/projects" className="text-indigo-600 hover:text-indigo-900">
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Mobile header with back button */}
      <div className="lg:hidden flex items-center space-x-2 mb-4">
        <BackButton href="/dashboard/projects" />
        <h1 className="text-lg font-semibold text-gray-900">Edit Project</h1>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
          <Link
            href="/dashboard/projects"
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Project Title *
                  </label>
                  <input
                    id="title"
                    type="text"
                    {...register('title')}
                    placeholder="Enter project title"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    {...register('description')}
                    placeholder="Enter project description"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    id="status"
                    {...register('status')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  {errors.status && (
                    <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="assigned_employee_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Employee *
                  </label>
                  <select
                    id="assigned_employee_id"
                    {...register('assigned_employee_id')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select an employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} - {employee.designation}
                      </option>
                    ))}
                  </select>
                  {errors.assigned_employee_id && (
                    <p className="mt-1 text-sm text-red-600">{errors.assigned_employee_id.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    id="customer_name"
                    type="text"
                    {...register('customer_name')}
                    placeholder="Enter customer name"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.customer_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.customer_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    id="phone_number"
                    type="tel"
                    {...register('phone_number')}
                    placeholder="Enter phone number"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.phone_number && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="alt_phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                    Alternative Phone Number
                  </label>
                  <input
                    id="alt_phone_number"
                    type="tel"
                    {...register('alt_phone_number')}
                    placeholder="Enter alternative phone number"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.alt_phone_number && (
                    <p className="mt-1 text-sm text-red-600">{errors.alt_phone_number.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Address *
                  </label>
                  <textarea
                    id="address"
                    rows={3}
                    {...register('address')}
                    placeholder="Enter complete address"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Project Details */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Project Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    id="start_date"
                    type="date"
                    {...register('start_date')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.start_date && (
                    <p className="mt-1 text-sm text-red-600">{errors.start_date.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="estimated_completion_date" className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Completion Date *
                  </label>
                  <input
                    id="estimated_completion_date"
                    type="date"
                    {...register('estimated_completion_date')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.estimated_completion_date && (
                    <p className="mt-1 text-sm text-red-600">{errors.estimated_completion_date.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="project_budget" className="block text-sm font-medium text-gray-700 mb-1">
                    Project Budget
                  </label>
                  <input
                    id="project_budget"
                    type="number"
                    step="0.01"
                    {...register('project_budget')}
                    placeholder="Enter project budget in ₹"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.project_budget && (
                    <p className="mt-1 text-sm text-red-600">{errors.project_budget.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Team Details */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Team Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="designer_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Designer Name *
                  </label>
                  <input
                    id="designer_name"
                    type="text"
                    {...register('designer_name')}
                    placeholder="Enter designer name"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.designer_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.designer_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="designer_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Designer Phone *
                  </label>
                  <input
                    id="designer_phone"
                    type="tel"
                    {...register('designer_phone')}
                    placeholder="Enter designer phone"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.designer_phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.designer_phone.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="carpenter_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Carpenter Name
                  </label>
                  <input
                    id="carpenter_name"
                    type="text"
                    {...register('carpenter_name')}
                    placeholder="Enter carpenter name"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.carpenter_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.carpenter_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="carpenter_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Carpenter Phone
                  </label>
                  <input
                    id="carpenter_phone"
                    type="tel"
                    {...register('carpenter_phone')}
                    placeholder="Enter carpenter phone"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.carpenter_phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.carpenter_phone.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="electrician_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Electrician Name
                  </label>
                  <input
                    id="electrician_name"
                    type="text"
                    {...register('electrician_name')}
                    placeholder="Enter electrician name"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.electrician_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.electrician_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="electrician_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Electrician Phone
                  </label>
                  <input
                    id="electrician_phone"
                    type="tel"
                    {...register('electrician_phone')}
                    placeholder="Enter electrician phone"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.electrician_phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.electrician_phone.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="plumber_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Plumber Name
                  </label>
                  <input
                    id="plumber_name"
                    type="text"
                    {...register('plumber_name')}
                    placeholder="Enter plumber name"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.plumber_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.plumber_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="plumber_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Plumber Phone
                  </label>
                  <input
                    id="plumber_phone"
                    type="tel"
                    {...register('plumber_phone')}
                    placeholder="Enter plumber phone"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.plumber_phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.plumber_phone.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="painter_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Painter Name
                  </label>
                  <input
                    id="painter_name"
                    type="text"
                    {...register('painter_name')}
                    placeholder="Enter painter name"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.painter_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.painter_name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="painter_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Painter Phone
                  </label>
                  <input
                    id="painter_phone"
                    type="tel"
                    {...register('painter_phone')}
                    placeholder="Enter painter phone"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.painter_phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.painter_phone.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
              
              <div>
                <label htmlFor="project_notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Project Notes
                </label>
                <textarea
                  id="project_notes"
                  rows={4}
                  {...register('project_notes')}
                  placeholder="Enter any additional notes or comments"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.project_notes && (
                  <p className="mt-1 text-sm text-red-600">{errors.project_notes.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Link
                href="/dashboard/projects"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
              >
                <FiSave className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
