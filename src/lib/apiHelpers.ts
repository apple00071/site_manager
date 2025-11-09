import { NextResponse } from 'next/server';

/**
 * Helper function to add no-cache headers to API responses
 * This prevents aggressive caching of dynamic API data
 */
export function addNoCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  return response;
}

/**
 * Create a JSON response with no-cache headers
 */
export function createNoCacheResponse(data: any, options?: ResponseInit) {
  const response = NextResponse.json(data, options);
  return addNoCacheHeaders(response);
}

/**
 * Route segment config for dynamic API routes
 * Export this from your API route files
 */
export const dynamicApiConfig = {
  dynamic: 'force-dynamic',
  revalidate: 0,
} as const;

