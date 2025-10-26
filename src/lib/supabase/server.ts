import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore
          return cookie.get(name)?.value
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            const cookie = await cookieStore;
            cookie.set({ 
              name, 
              value, 
              ...options,
              // Ensure these are set for security
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            } as any) // Using 'as any' to bypass TypeScript error
          } catch (error) {
            console.error('Error setting cookie:', error)
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            const cookie = await cookieStore;
            cookie.set({ 
              name, 
              value: '',
              ...options,
              maxAge: 0,
              path: '/',
            } as any) // Using 'as any' to bypass TypeScript error
          } catch (error) {
            console.error('Error removing cookie:', error)
          }
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'X-Client-Info': 'apple-interior-manager/1.0.0'
        }
      }
    }
  )
}
