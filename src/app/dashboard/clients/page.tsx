'use client';

import Link from 'next/link';

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Clients Removed</h1>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="px-4 py-12 sm:px-6 text-center">
          <p className="text-sm text-gray-500">
            The separate Clients section has been removed. All customer information is now managed inside each project.
          </p>
          <Link
            href="/dashboard/projects"
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-900 bg-yellow-500 hover:bg-yellow-600"
          >
            Go to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}