'use client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404 - Page Not Found</h1>
        <p className="text-lg text-gray-600 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 transition-colors"
        >
          Go to Home Page
        </Link>
      </div>
    </div>
  );
}
