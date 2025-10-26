'use client';

import { useParams } from 'next/navigation';

// This ensures the page is always rendered on the server
// and never statically generated
export const dynamic = 'force-dynamic';

export default function ProjectMembersPage() {
  const { id: projectId } = useParams();
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Project Members</h1>
      <p className="text-gray-600">Project ID: {projectId}</p>
      <p className="mt-4">Members functionality will be implemented here.</p>
    </div>
  );
}