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
    // Handle explicit logout request parameter immediately
    if (request.nextUrl.searchParams.get('logout') === 'true') {
      const logoutResponse = NextResponse.next();
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.includes('auth-token') || cookie.name.startsWith('sb-') || cookie.name.includes('supabase')) {
          logoutResponse.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
        }
      });
      return logoutResponse;
    }

    // Create a Supabase client configured to use cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Define public routes that don't require authentication
    const publicRoutes = ['/', '/login', '/signup', '/forgot-password', '/privacy-policy', '/account-deletion', '/admin/login'];
    const isPublicRoute = publicRoutes.some(route =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith('/auth/')
    );

    // Fast-path: Check if any auth cookie exists before doing expensive network calls
    const hasAuthCookie = request.cookies.getAll().some(cookie =>
      cookie.name.includes('auth-token') || cookie.name.startsWith('sb-') || cookie.name.includes('supabase')
    );

    // If it's a public route and user has no auth cookies, return immediately (0ms latency, zero network hops)
    if (isPublicRoute && !hasAuthCookie) {
      return response;
    }

    // Get the current user with error handling
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError && !isPublicRoute) {
      console.warn('Auth error in middleware for protected route:', authError.message);
      // If there's an auth error on a protected route, clear the auth cookies and redirect to login
      const clearResponse = NextResponse.redirect(new URL('/login', request.url));

      // Dynamically find and clear auth cookies instead of hardcoding project ID
      request.cookies.getAll().forEach(cookie => {
        if (cookie.name.includes('auth-token') || cookie.name.startsWith('sb-') || cookie.name.includes('supabase')) {
          clearResponse.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
        }
      });

      return clearResponse;
    }

    // If the user is not signed in and the current URL is not public, redirect to login
    if (!user && !isPublicRoute) {
      // Prevent redirect loops by checking if we're already being redirected
      const redirectedFrom = request.nextUrl.searchParams.get('redirectedFrom');
      if (redirectedFrom === request.nextUrl.pathname) {
        console.warn('Redirect loop detected, clearing auth and redirecting to home');
        const clearResponse = NextResponse.redirect(new URL('/', request.url));

        // Dynamically find and clear auth cookies
        request.cookies.getAll().forEach(cookie => {
          if (cookie.name.includes('auth-token') || cookie.name.startsWith('sb-') || cookie.name.includes('supabase')) {
            clearResponse.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
          }
        });

        return clearResponse;
      }

      const isForAdmin = request.nextUrl.pathname.startsWith('/admin');
      const targetLogin = isForAdmin ? '/admin/login' : '/login';
      const redirectUrl = new URL(targetLogin, request.url);
      redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // If the user is signed in and tries to access root, auth pages or portal/dashboard mismatch, redirect immediately
    if (user) {
      const userRole = user?.user_metadata?.role || 'employee';
      const isRootPage = request.nextUrl.pathname === '/';
      const isAuthPage = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup';
      const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard') && !request.nextUrl.pathname.startsWith('/dashboard/admin');

      if (isRootPage || isAuthPage || (userRole === 'client' && isDashboardPage)) {
        const target = userRole === 'client' ? '/portal' : '/dashboard';
        return NextResponse.redirect(new URL(target, request.url));
      }
    }

    // For admin routes, check if the user is an admin using auth metadata
    const adminRoutes = ['/admin', '/dashboard/admin'];
    const isAdminRoute = adminRoutes.some(route =>
      request.nextUrl.pathname.startsWith(route)
    );

    if (user && isAdminRoute) {
      // Use user_metadata to match AuthContext implementation
      const userRole = user?.user_metadata?.role || 'employee';

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
