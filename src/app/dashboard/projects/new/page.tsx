'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';

const projectSchema = z.object({
  // Basic Information
  title: z.string().min(2, 'Title is required'),
  description: z.string().optional().nullable(),

  // Customer Details
  customer_name: z.string().min(2, 'Customer name is required'),
  phone_number: z.string().min(10, 'Phone number is required'),
  alt_phone_number: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),

  // Address Details
  address: z.string().min(5, 'Address is required'),
  landmark: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),

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
  project_type: z.string().optional().nullable(),

  // Financial Details
  project_budget: z.string().optional().nullable(),
  advance_payment: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),

  // Team Assignment
  assigned_employee_id: z.string().min(1, 'Please select a designer'),
  team_members: z.array(z.string()).optional().nullable(),

  // Design Specifications
  design_style: z.string().optional().nullable(),
  room_types: z.string().optional().nullable(),
  special_requirements: z.string().optional().nullable(),

  // Worker Details (all optional - can be assigned later)

  // Tradespeople
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
  internal_notes: z.string().optional().nullable(),

  // Attachments
  requirements_pdf_url: z.string().optional().nullable(),
  attachments: z.array(z.string()).optional().nullable(),

  // System Fields
  status: z.string().optional().nullable(),
  created_by: z.string().optional(),
  updated_by: z.string().optional()
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function NewProjectPage() {
  const { isAdmin, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPDF, setUploadingPDF] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    mode: 'onChange',
    defaultValues: {
      status: 'pending',
    },
  });

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      console.log('Auth still loading...');
      return;
    }

    // If we've already initialized, don't run this effect again
    if (isInitialized) {
      console.log('Already initialized, skipping...');
      return;
    }

    console.log('Auth state loaded. isAdmin:', isAdmin, 'User:', user?.email);

    // If not an admin, redirect to dashboard
    if (isAdmin === false) {
      console.log('User is not an admin, redirecting to dashboard');
      router.push('/dashboard');
      return;
    }

    // Only fetch if we have a user (admin check passed or still loading)
    if (!user) {
      console.log('No user found, waiting...');
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch team members from users table (all roles)
        console.log('Fetching employees...');
        const { data: employeesData, error: employeesError } = await supabase
          .from('users')
          .select('id, full_name, email, designation, role')
          .order('full_name', { ascending: true });

        if (employeesError) {
          console.error('Error fetching employees:', employeesError);
          throw employeesError;
        }

        console.log('Employees loaded:', employeesData?.length, employeesData);

        // Map to the expected format with 'name' field and include role for logic
        const mappedEmployees = (employeesData || []).map((u: { id: string; full_name: string | null; email: string | null; designation: string | null; role: string | null }) => ({
          id: u.id,
          name: u.full_name,
          email: u.email,
          designation: u.designation,
          role: u.role,
        }));

        console.log('Mapped employees:', mappedEmployees);
        setEmployees(mappedEmployees);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load required data');
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    fetchData();
  }, [isAdmin, router, authLoading, isInitialized, user]);

  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB');
      return;
    }

    setPdfFile(file);
    setError(null);
  };

  const onSubmit = async (data: ProjectFormValues) => {
    console.log('=== FORM SUBMISSION STARTED ===');
    console.log('Form data received:', data);
    console.log('Form errors:', errors);

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Submitting project:', data);

      // Upload PDF to Supabase Storage if file is selected
      let pdfUrl = null;
      if (pdfFile) {
        try {
          setUploadingPDF(true);
          const fileExt = pdfFile.name.split('.').pop();
          const fileName = `requirements-${Date.now()}.${fileExt}`;
          const filePath = `requirements/${fileName}`;

          console.log('Uploading PDF to storage:', filePath);

          const { error: uploadError } = await supabase.storage
            .from('project-requirements')
            .upload(filePath, pdfFile);

          if (uploadError) {
            console.error('PDF upload error:', uploadError);
            throw new Error('Failed to upload PDF: ' + uploadError.message);
          }

          const { data: { publicUrl } } = supabase.storage
            .from('project-requirements')
            .getPublicUrl(filePath);

          pdfUrl = publicUrl;
          console.log('PDF uploaded successfully:', pdfUrl);
        } catch (uploadErr: any) {
          setUploadingPDF(false);
          throw new Error('PDF upload failed: ' + uploadErr.message);
        } finally {
          setUploadingPDF(false);
        }
      }

      // Prepare the project data with all fields
      const projectData = {
        title: data.title,
        status: data.status || 'pending',
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
        project_budget: data.project_budget || null,
        requirements_pdf_url: pdfUrl,
        project_notes: data.project_notes || null,
        created_by: user?.id,
      };

      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });

      const json = await res.json();
      console.log('API Response:', json);

      if (!res.ok) {
        const errorMessage = json.error?.message || json.error || 'Failed to create project';
        console.error('API Error:', errorMessage);
        throw new Error(errorMessage);
      }

      // Redirect to projects list on success
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
        setError('Invalid client or employee selected. Please check your selections.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking auth or loading data
  if (authLoading || (!isInitialized && isAdmin !== false)) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 safe-area-inset-bottom">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 lg:hidden">Create New Project</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Add a new interior design project with complete details</p>
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

          <form onSubmit={(e) => {
            console.log('Form onSubmit triggered!');
            e.preventDefault();
            console.log('Calling handleSubmit...');
            handleSubmit(onSubmit)();
          }} className="space-y-6">
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

            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Assign Designer</h3>
              <p className="text-sm text-gray-600 mb-4">Select a designer from your team to create the project design.</p>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Designer *
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-500"></div>
                      <span className="ml-2 text-sm text-gray-500">Loading designers...</span>
                    </div>
                  ) : !employees || employees.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">No team members found in the system.</p>
                      <p className="text-xs text-gray-400 mt-1">Please add team members and set their designations (e.g., 'Designer') first in User Management.</p>
                    </div>
                  ) : employees.filter(emp => emp.designation && emp.designation.toLowerCase().includes('designer')).length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">No designers found.</p>
                      <p className="text-xs text-gray-400 mt-1">Please add users whose designation contains 'designer' in User Management.</p>
                      <p className="text-xs text-gray-400 mt-2">Total team members loaded: {employees.length}</p>
                    </div>
                  ) : (
                    employees
                      .filter(emp => emp.designation && emp.designation.toLowerCase().includes('designer'))
                      .map((employee) => (
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
                  {errors.carpenter_name && (
                    <p className="mt-1 text-xs text-red-600">{errors.carpenter_name.message}</p>
                  )}
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
                  {errors.carpenter_phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.carpenter_phone.message}</p>
                  )}
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
                  {errors.electrician_name && (
                    <p className="mt-1 text-xs text-red-600">{errors.electrician_name.message}</p>
                  )}
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
                  {errors.electrician_phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.electrician_phone.message}</p>
                  )}
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
                  {errors.plumber_name && (
                    <p className="mt-1 text-xs text-red-600">{errors.plumber_name.message}</p>
                  )}
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
                  {errors.plumber_phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.plumber_phone.message}</p>
                  )}
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
                  {errors.painter_name && (
                    <p className="mt-1 text-xs text-red-600">{errors.painter_name.message}</p>
                  )}
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
                  {errors.painter_phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.painter_phone.message}</p>
                  )}
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
                  {errors.granite_worker_name && (
                    <p className="mt-1 text-xs text-red-600">{errors.granite_worker_name.message}</p>
                  )}
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
                  {errors.granite_worker_phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.granite_worker_phone.message}</p>
                  )}
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
                  {errors.glass_worker_name && (
                    <p className="mt-1 text-xs text-red-600">{errors.glass_worker_name.message}</p>
                  )}
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
                  {errors.glass_worker_phone && (
                    <p className="mt-1 text-xs text-red-600">{errors.glass_worker_phone.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="requirements_pdf" className="block text-sm font-medium text-gray-700 mb-1">
                    Requirements File (PDF or Image, Optional)
                  </label>
                  <input
                    id="requirements_pdf"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={handlePDFUpload}
                    disabled={uploadingPDF}
                    className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 disabled:opacity-50"
                  />
                  {pdfFile && (
                    <p className="mt-2 text-sm text-green-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Upload project requirements document (PDF or JPG/PNG/WebP image, max 10MB)
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
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.project_notes && (
                    <p className="mt-1 text-sm text-red-600">{errors.project_notes.message}</p>
                  )}
                </div>
              </div>
            </div>

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
                disabled={isSubmitting || uploadingPDF}
                onClick={() => console.log('Submit button clicked!')}
                className="w-full sm:w-auto btn-primary flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {uploadingPDF ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading PDF...
                  </>
                ) : isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Project...
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