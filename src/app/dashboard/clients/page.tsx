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
            className="btn-primary mt-4 inline-flex shadow-sm"
          >
            Go to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}