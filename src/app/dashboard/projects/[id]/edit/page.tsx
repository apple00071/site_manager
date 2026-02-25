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
  // Basic Information
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'on_hold', 'completed', 'cancelled']),

  // Customer Details
  customer_name: z.string().min(2, 'Customer name is required'),
  phone_number: z.string().min(10, 'Phone number is required'),
  alt_phone_number: z.string().optional().nullable(),

  // Address Details
  address: z.string().min(5, 'Address is required'),

  // Property Details
  property_type: z.enum(['apartment', 'villa', 'independent_house', 'office', 'commercial', 'granite', 'glass', 'other']).optional().nullable(),
  apartment_name: z.string().optional().nullable(),
  block_number: z.string().optional().nullable(),
  flat_number: z.string().optional().nullable(),
  floor_number: z.string().optional().nullable(),
  area_sqft: z.string().optional().nullable(),

  // Project Details
  start_date: z.string().min(1, 'Start date is required'),
  estimated_completion_date: z.string().min(1, 'Estimated completion date is required'),

  // Financial Details
  project_budget: z.string().optional().nullable(),

  // Team Assignment
  assigned_employee_id: z.string().min(1, 'Please select a designer'),

  // Worker Details
  carpenter_name: z.string().optional().nullable(),
  carpenter_phone: z.string().optional().nullable(),
  electrician_name: z.string().optional().nullable(),
  electrician_phone: z.string().optional().nullable(),
  plumber_name: z.string().optional().nullable(),
  plumber_phone: z.string().optional().nullable(),
  painter_name: z.string().optional().nullable(),
  painter_phone: z.string().optional().nullable(),
  granite_worker_name: z.string().optional().nullable(),
  granite_worker_phone: z.string().optional().nullable(),
  glass_worker_name: z.string().optional().nullable(),
  glass_worker_phone: z.string().optional().nullable(),

  // Additional Information
  project_notes: z.string().optional().nullable(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface Employee {
  id: string;
  name: string;
  email: string;
  designation: string;
  role: string;
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
  const [requirementsFile, setRequirementsFile] = useState<File | null>(null);
  const [uploadingRequirements, setUploadingRequirements] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        // Fetch all users (for designer selection) using API route
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Failed to fetch employees');
        const employeesData = await response.json();
        setEmployees((employeesData || []).map((u: any) => ({
          id: u.id,
          name: u.full_name,
          email: u.email,
          designation: u.designation,
          role: u.role,
        })));

        // Reset form with project data
        reset({
          title: projectData.title,
          description: projectData.description || '',
          status: projectData.status || 'pending',
          customer_name: projectData.customer_name,
          phone_number: projectData.phone_number,
          alt_phone_number: projectData.alt_phone_number || '',
          address: projectData.address,
          property_type: projectData.property_type || null,
          apartment_name: projectData.apartment_name || '',
          block_number: projectData.block_number || '',
          flat_number: projectData.flat_number || '',
          floor_number: projectData.floor_number || '',
          area_sqft: projectData.area_sqft || '',
          start_date: projectData.start_date ? new Date(projectData.start_date).toISOString().split('T')[0] : '',
          estimated_completion_date: projectData.estimated_completion_date ? new Date(projectData.estimated_completion_date).toISOString().split('T')[0] : '',
          assigned_employee_id: projectData.assigned_employee_id || '',
          carpenter_name: projectData.carpenter_name || '',
          carpenter_phone: projectData.carpenter_phone || '',
          electrician_name: projectData.electrician_name || '',
          electrician_phone: projectData.electrician_phone || '',
          plumber_name: projectData.plumber_name || '',
          plumber_phone: projectData.plumber_phone || '',
          painter_name: projectData.painter_name || '',
          painter_phone: projectData.painter_phone || '',
          granite_worker_name: projectData.granite_worker_name || '',
          granite_worker_phone: projectData.granite_worker_phone || '',
          glass_worker_name: projectData.glass_worker_name || '',
          glass_worker_phone: projectData.glass_worker_phone || '',
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

  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setRequirementsFile(null);
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF or image file (JPG, PNG, or WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setRequirementsFile(file);
    setError(null);
  };

  const onSubmit = async (data: ProjectFormValues) => {
    setSaving(true);
    setError(null);

    try {
      let requirementsUrl = project?.requirements_pdf_url || null;

      if (requirementsFile) {
        try {
          setUploadingRequirements(true);
          const fileExt = requirementsFile.name.split('.').pop();
          const fileName = `${projectId}-requirements-${Date.now()}.${fileExt}`;
          const filePath = `requirements/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('project-requirements')
            .upload(filePath, requirementsFile);

          if (uploadError) {
            throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('project-requirements')
            .getPublicUrl(filePath);

          requirementsUrl = publicUrl;
        } catch (uploadError: any) {
          console.error('Error uploading requirements file:', uploadError);
          setError('Failed to upload requirements file. Please try again.');
          setUploadingRequirements(false);
          setSaving(false);
          return;
        } finally {
          setUploadingRequirements(false);
        }
      }

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
          property_type: data.property_type || null,
          apartment_name: data.apartment_name || null,
          block_number: data.block_number || null,
          flat_number: data.flat_number || null,
          floor_number: data.floor_number || null,
          area_sqft: data.area_sqft || null,
          start_date: data.start_date,
          estimated_completion_date: data.estimated_completion_date,
          assigned_employee_id: data.assigned_employee_id,
          carpenter_name: data.carpenter_name || null,
          carpenter_phone: data.carpenter_phone || null,
          electrician_name: data.electrician_name || null,
          electrician_phone: data.electrician_phone || null,
          plumber_name: data.plumber_name || null,
          plumber_phone: data.plumber_phone || null,
          painter_name: data.painter_name || null,
          painter_phone: data.painter_phone || null,
          granite_worker_name: data.granite_worker_name || null,
          granite_worker_phone: data.granite_worker_phone || null,
          glass_worker_name: data.glass_worker_name || null,
          glass_worker_phone: data.glass_worker_phone || null,
          project_budget: data.project_budget ? parseFloat(data.project_budget) : null,
          project_notes: data.project_notes || null,
          requirements_pdf_url: requirementsUrl,
        })
        .eq('id', projectId);

      if (error) throw error;

      router.refresh();
      router.push(`/dashboard/projects/${projectId}`);
    } catch (error: any) {
      console.error('Error updating project:', error);
      setError('Failed to update project. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Project not found</p>
        <Link href="/dashboard/projects" className="text-yellow-600 hover:text-yellow-700">
          Back to Projects
        </Link>
      </div>
    );
  }

  // Filter designers from employees
  const designers = employees.filter(emp => emp.designation && emp.designation.toLowerCase().includes('designer'));

  return (
    <div className="space-y-4 sm:space-y-6 safe-area-inset-bottom">
      {/* Mobile header with back button */}
      <div className="lg:hidden flex items-center space-x-2 mb-4">
        <BackButton href={`/dashboard/projects/${projectId}`} />
        <h1 className="text-lg font-semibold text-gray-900">Edit Project</h1>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Link>
        </div>
      </div>

      <div className="bg-white shadow-card overflow-hidden rounded-2xl border border-gray-100">
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
              <p className="text-yellow-800 font-semibold mb-2">Please fix the following errors:</p>
              <ul className="list-disc list-inside text-sm text-yellow-700">
                {Object.entries(errors).map(([field, error]) => (
                  <li key={field}>
                    <strong>{field.replace(/_/g, ' ')}:</strong> {error?.message?.toString()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Project Details Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Project Details</h3>

              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="sm:col-span-2">
                    <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
                      Project Title *
                    </label>
                    <input
                      id="title"
                      type="text"
                      {...register('title')}
                      placeholder="Enter project title"
                      className="block w-full px-4 py-3 sm:py-4 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
                    />
                    {errors.title && (
                      <p className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                        <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                        {errors.title.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="status" className="block text-sm font-semibold text-gray-700 mb-2">
                      Status *
                    </label>
                    <select
                      id="status"
                      {...register('status')}
                      className="block w-full px-4 py-3 sm:py-4 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="on_hold">On Hold</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    {errors.status && (
                      <p className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                        <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                        {errors.status.message}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="customer_name" className="block text-sm font-semibold text-gray-700 mb-2">
                      Customer Name *
                    </label>
                    <input
                      id="customer_name"
                      type="text"
                      {...register('customer_name')}
                      placeholder="Enter customer full name"
                      className="block w-full px-4 py-3 sm:py-4 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
                      autoComplete="name"
                    />
                    {errors.customer_name && (
                      <p className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                        <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                        {errors.customer_name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone_number" className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      id="phone_number"
                      type="tel"
                      {...register('phone_number')}
                      placeholder="1234567890"
                      className="block w-full px-4 py-3 sm:py-4 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    {errors.phone_number && (
                      <p className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                        <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                        {errors.phone_number.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="alt_phone_number" className="block text-sm font-semibold text-gray-700 mb-2">
                      Alternative Phone
                    </label>
                    <input
                      id="alt_phone_number"
                      type="tel"
                      {...register('alt_phone_number')}
                      placeholder="Optional"
                      className="block w-full px-4 py-3 sm:py-4 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    {errors.alt_phone_number && (
                      <p className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                        <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                        {errors.alt_phone_number.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Property Details Section */}
                <div className="bg-gray-50 rounded-xl p-4 sm:p-6 space-y-4">
                  <h4 className="text-md font-semibold text-gray-800 mb-3">Property Details</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="property_type" className="block text-sm font-medium text-gray-700 mb-2">
                        Property Type
                      </label>
                      <select
                        id="property_type"
                        {...register('property_type')}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-white touch-target"
                      >
                        <option value="">Select property type</option>
                        <option value="apartment">Apartment</option>
                        <option value="villa">Villa</option>
                        <option value="independent_house">Independent House</option>
                        <option value="office">Office</option>
                        <option value="commercial">Commercial</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="apartment_name" className="block text-sm font-medium text-gray-700 mb-2">
                        Apartment/Building Name
                      </label>
                      <input
                        id="apartment_name"
                        type="text"
                        {...register('apartment_name')}
                        placeholder="e.g., Green Valley Apartments"
                        className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-white touch-target"
                      />
                    </div>

                    <div>
                      <label htmlFor="area_sqft" className="block text-sm font-medium text-gray-700 mb-2">
                        Area (sq ft)
                      </label>
                      <input
                        id="area_sqft"
                        type="number"
                        {...register('area_sqft')}
                        placeholder="e.g., 1200"
                        className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-white touch-target"
                        inputMode="numeric"
                      />
                    </div>

                    <div>
                      <label htmlFor="block_number" className="block text-sm font-medium text-gray-700 mb-2">
                        Block Number
                      </label>
                      <input
                        id="block_number"
                        type="text"
                        {...register('block_number')}
                        placeholder="e.g., A, B1, Tower 2"
                        className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-white touch-target"
                      />
                    </div>

                    <div>
                      <label htmlFor="flat_number" className="block text-sm font-medium text-gray-700 mb-2">
                        Flat Number
                      </label>
                      <input
                        id="flat_number"
                        type="text"
                        {...register('flat_number')}
                        placeholder="e.g., 101, A-205"
                        className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-white touch-target"
                      />
                    </div>

                    <div>
                      <label htmlFor="floor_number" className="block text-sm font-medium text-gray-700 mb-2">
                        Floor Number
                      </label>
                      <input
                        id="floor_number"
                        type="text"
                        {...register('floor_number')}
                        placeholder="e.g., 2nd, Ground"
                        className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-white touch-target"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">
                    Complete Address *
                  </label>
                  <textarea
                    id="address"
                    rows={3}
                    {...register('address')}
                    placeholder="Enter full address with landmarks"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
                  />
                  {errors.address && (
                    <p className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                      <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                      {errors.address.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline & Budget Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Timeline & Budget</h3>

              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label htmlFor="start_date" className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      id="start_date"
                      type="date"
                      {...register('start_date')}
                      className="block w-full px-4 py-3 sm:py-4 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
                    />
                    {errors.start_date && (
                      <p className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                        <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                        {errors.start_date.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="estimated_completion_date" className="block text-sm font-semibold text-gray-700 mb-2">
                      Estimated Completion Date *
                    </label>
                    <input
                      id="estimated_completion_date"
                      type="date"
                      {...register('estimated_completion_date')}
                      className="block w-full px-4 py-3 sm:py-4 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
                    />
                    {errors.estimated_completion_date && (
                      <p className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                        <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                        {errors.estimated_completion_date.message}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="project_budget" className="block text-sm font-semibold text-gray-700 mb-2">
                      Project Budget
                    </label>
                    <input
                      id="project_budget"
                      type="text"
                      {...register('project_budget')}
                      placeholder="Enter project budget (e.g., 1500000, 15,00,000, or 15L)"
                      className="block w-full px-4 py-3 sm:py-4 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white touch-target"
                    />
                    {errors.project_budget && (
                      <p className="mt-2 text-xs sm:text-sm text-red-600 flex items-center">
                        <span className="inline-block w-1 h-1 bg-red-600 rounded-full mr-2"></span>
                        {errors.project_budget.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Assign Designer Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Assign Designer</h3>
              <p className="text-sm text-gray-600 mb-4">Select a designer from your team to create the project design.</p>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Designer *
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {designers.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">No designers found.</p>
                      <p className="text-xs text-gray-400 mt-1">Please add users whose designation contains 'designer' in User Management.</p>
                    </div>
                  ) : (
                    designers.map((employee) => (
                      <label
                        key={employee.id}
                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-white hover:border-yellow-400 cursor-pointer transition-all duration-200 mb-2"
                      >
                        <input
                          type="radio"
                          value={employee.id}
                          {...register('assigned_employee_id')}
                          className="h-4 w-4 text-yellow-500 focus:ring-yellow-400 border-gray-300"
                        />
                        <span className="ml-3 flex-1">
                          <span className="block text-sm font-medium text-gray-900">
                            {employee.name}
                          </span>
                          {employee.designation && (
                            <span className="block text-xs text-gray-500">
                              {employee.designation}
                            </span>
                          )}
                          {employee.email && (
                            <span className="block text-xs text-gray-500 truncate">
                              {employee.email}
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {errors.assigned_employee_id && (
                  <p className="mt-2 text-xs text-red-600">{errors.assigned_employee_id.message}</p>
                )}
              </div>
            </div>

            {/* Vendor Details Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Vendor Details</h3>
              <p className="text-sm text-gray-600 mb-4">Enter contact details for vendors who will be assigned to this project.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Carpenter */}
                <div>
                  <label htmlFor="carpenter_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Carpenter Vendor
                  </label>
                  <input
                    id="carpenter_name"
                    type="text"
                    {...register('carpenter_name')}
                    placeholder="Enter carpenter name"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="carpenter_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Carpenter Vendor Phone
                  </label>
                  <input
                    id="carpenter_phone"
                    type="tel"
                    {...register('carpenter_phone')}
                    placeholder="1234567890"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Electrician */}
                <div>
                  <label htmlFor="electrician_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Electrician Vendor
                  </label>
                  <input
                    id="electrician_name"
                    type="text"
                    {...register('electrician_name')}
                    placeholder="Enter electrician name"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="electrician_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Electrician Vendor Phone
                  </label>
                  <input
                    id="electrician_phone"
                    type="tel"
                    {...register('electrician_phone')}
                    placeholder="1234567890"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Plumber */}
                <div>
                  <label htmlFor="plumber_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Plumber Vendor
                  </label>
                  <input
                    id="plumber_name"
                    type="text"
                    {...register('plumber_name')}
                    placeholder="Enter plumber name"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="plumber_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Plumber Vendor Phone
                  </label>
                  <input
                    id="plumber_phone"
                    type="tel"
                    {...register('plumber_phone')}
                    placeholder="1234567890"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Painter */}
                <div>
                  <label htmlFor="painter_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Painter Vendor
                  </label>
                  <input
                    id="painter_name"
                    type="text"
                    {...register('painter_name')}
                    placeholder="Enter painter name"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="painter_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Painter Vendor Phone
                  </label>
                  <input
                    id="painter_phone"
                    type="tel"
                    {...register('painter_phone')}
                    placeholder="1234567890"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Granite */}
                <div>
                  <label htmlFor="granite_worker_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Granite Vendor
                  </label>
                  <input
                    id="granite_worker_name"
                    type="text"
                    {...register('granite_worker_name')}
                    placeholder="Enter granite worker name"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="granite_worker_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Granite Vendor Phone
                  </label>
                  <input
                    id="granite_worker_phone"
                    type="tel"
                    {...register('granite_worker_phone')}
                    placeholder="1234567890"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Glass */}
                <div>
                  <label htmlFor="glass_worker_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Glass Vendor
                  </label>
                  <input
                    id="glass_worker_name"
                    type="text"
                    {...register('glass_worker_name')}
                    placeholder="Enter glass worker name"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="glass_worker_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Glass Vendor Phone
                  </label>
                  <input
                    id="glass_worker_phone"
                    type="tel"
                    {...register('glass_worker_phone')}
                    placeholder="1234567890"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Requirements Document
                  </label>
                  {project.requirements_pdf_url && (
                    <div className="mb-2">
                      <a
                        href={project.requirements_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-yellow-600 hover:text-yellow-700 hover:underline"
                      >
                        📄 View current requirements file
                      </a>
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handlePDFUpload}
                    disabled={uploadingRequirements}
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 disabled:opacity-50"
                  />
                  {requirementsFile && (
                    <p className="mt-2 text-sm text-green-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {requirementsFile.name} ({(requirementsFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Upload a new requirements document to replace the existing one (PDF or JPG/PNG/WebP image, max 10MB)
                  </p>
                </div>

                <div>
                  <label htmlFor="project_notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Project Notes
                  </label>
                  <textarea
                    id="project_notes"
                    rows={4}
                    {...register('project_notes')}
                    placeholder="Enter any additional notes or special requirements for this project"
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full sm:w-auto btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploadingRequirements}
                className="w-full sm:w-auto btn-primary flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {uploadingRequirements ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : saving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <FiSave className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
