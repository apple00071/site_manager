'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';

export default function ClientsPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not admin
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }

    const fetchClients = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('name');

        if (error) throw error;
        setClients(data || []);
      } catch (error) {
        console.error('Error fetching clients:', error);
        setError('Failed to load clients');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [isAdmin, router]);

  const handleDeleteClient = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client? This will also delete all associated projects.')) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', id);

        if (error) throw error;

        // Update local state
        setClients(clients.filter(client => client.id !== id));
      } catch (error) {
        console.error('Error deleting client:', error);
        setError('Failed to delete client. Make sure there are no active projects for this client.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Link
          href="/dashboard/clients/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center hover:bg-indigo-700"
        >
          <FiPlus className="mr-2" /> Add Client
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b">
          <h3 className="text-lg font-medium text-gray-900">Client List</h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {clients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projects
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{client.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{client.email}</div>
                        <div className="text-sm text-gray-500">{client.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{client.address || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/dashboard/projects?client=${client.id}`} className="text-indigo-600 hover:text-indigo-900">
                          View Projects
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <Link
                            href={`/dashboard/clients/${client.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <FiEdit2 className="h-5 w-5" />
                          </Link>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <FiTrash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">No clients found</p>
              <Link
                href="/dashboard/clients/new"
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <FiPlus className="mr-2 -ml-1 h-5 w-5" />
                Add Your First Client
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}