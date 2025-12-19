'use client';

import Link from 'next/link';

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Link
          href="/dashboard/projects"
          className="mr-4 text-gray-500 hover:text-gray-700"
        >
          Go back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Clients Removed</h1>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="px-4 py-12 sm:px-6 text-center">
          <p className="text-sm text-gray-500">
            Creating separate clients is no longer supported. Please add customer details directly when creating or editing a project.
          </p>
          <Link
            href="/dashboard/projects/new"
            className="btn-primary mt-4 inline-flex shadow-sm"
          >
            Create Project
          </Link>
        </div>
      </div>
    </div>
  );
}