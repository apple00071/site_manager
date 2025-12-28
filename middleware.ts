import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  // Create a response object
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Track if cookies were modified to prevent unnecessary response recreation
  let cookiesModified = false;

  try {
    // Create a Supabase client configured to use cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            try {
              return request.cookies.get(name)?.value;
            } catch (error) {
              console.warn('Error getting cookie:', name, error);
              return undefined;
            }
          },
          set(name: string, value: string, options: any) {
            try {
              // Only recreate response if not already done
              if (!cookiesModified) {
                response = NextResponse.next({
                  request: {
                    headers: request.headers,
                  },
                });
                cookiesModified = true;
              }

              request.cookies.set({
                name,
                value,
                ...options,
              });
              response.cookies.set({
                name,
                value,
                ...options,
              });
            } catch (error) {
              console.warn('Error setting cookie:', name, error);
            }
          },
          remove(name: string, options: any) {
            try {
              // Only recreate response if not already done
              if (!cookiesModified) {
                response = NextResponse.next({
                  request: {
                    headers: request.headers,
                  },
                });
                cookiesModified = true;
              }

              request.cookies.set({
                name,
                value: '',
                ...options,
              });
              response.cookies.set({
                name,
                value: '',
                ...options,
              });
            } catch (error) {
              console.warn('Error removing cookie:', name, error);
            }
          },
        },
      }
    );

    // Get the current session with error handling
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn('Session error in middleware:', sessionError.message);
      // If there's a session error, clear the auth cookies and redirect to login
      const clearResponse = NextResponse.redirect(new URL('/login', request.url));
      // Clear auth cookies on error - use correct Supabase cookie names
      clearResponse.cookies.set('sb-uswdtcmemgfqlkzmfkxs-auth-token', '', { maxAge: 0 });
      clearResponse.cookies.set('sb-uswdtcmemgfqlkzmfkxs-auth-token.0', '', { maxAge: 0 });
      clearResponse.cookies.set('sb-uswdtcmemgfqlkzmfkxs-auth-token.1', '', { maxAge: 0 });
      return clearResponse;
    }

    // Define public routes that don't require authentication
    const publicRoutes = ['/', '/login', '/signup', '/forgot-password'];
    const isPublicRoute = publicRoutes.some(route =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith('/auth/')
    );

    // If the user is not signed in and the current URL is not public, redirect to login
    if (!session && !isPublicRoute) {
      // Prevent redirect loops by checking if we're already being redirected
      const redirectedFrom = request.nextUrl.searchParams.get('redirectedFrom');
      if (redirectedFrom === request.nextUrl.pathname) {
        console.warn('Redirect loop detected, clearing auth and redirecting to home');
        const clearResponse = NextResponse.redirect(new URL('/', request.url));
        clearResponse.cookies.set('sb-uswdtcmemgfqlkzmfkxs-auth-token', '', { maxAge: 0 });
        clearResponse.cookies.set('sb-uswdtcmemgfqlkzmfkxs-auth-token.0', '', { maxAge: 0 });
        clearResponse.cookies.set('sb-uswdtcmemgfqlkzmfkxs-auth-token.1', '', { maxAge: 0 });
        return clearResponse;
      }

      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // If the user is signed in and tries to access auth pages, redirect to dashboard
    if (session && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // For admin routes, check if the user is an admin using auth metadata
    const adminRoutes = ['/admin', '/dashboard/admin'];
    const isAdminRoute = adminRoutes.some(route =>
      request.nextUrl.pathname.startsWith(route)
    );

    if (session && isAdminRoute) {
      // Use user_metadata to match AuthContext implementation
      const userRole = session.user?.user_metadata?.role || 'employee';

      if (userRole !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    // On any middleware error, redirect to login to reset auth state
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .well-known (App Links verification files)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192x192.png|icon-512x512.png|\\.well-known|public).*)',
  ],
};
