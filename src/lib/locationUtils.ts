import { Capacitor } from '@capacitor/core';

interface CachedPosition {
  latitude: number;
  longitude: number;
  timestamp: number;
}

// Session-level memory cache so GPS fix is instantly reused without cold delays
let sessionLocationCache: CachedPosition | null = null;
let activeLocationPromise: Promise<CachedPosition | null> | null = null;
const addressCache = new Map<string, string>();

/**
 * Acquire GPS location using Capacitor Geolocation on native devices
 * or navigator.geolocation in browser/PWA.
 */
export async function acquireLocation(options: { forceFresh?: boolean; timeout?: number } = {}): Promise<{ latitude: number; longitude: number } | null> {
  const timeoutMs = options.timeout ?? 4500;

  // 1. If we have a warm fix within the last 3 minutes (180,000ms), return immediately!
  if (!options.forceFresh && sessionLocationCache && (Date.now() - sessionLocationCache.timestamp < 180000)) {
    return {
      latitude: sessionLocationCache.latitude,
      longitude: sessionLocationCache.longitude
    };
  }

  // Reuse in-flight promise if one is already running
  if (activeLocationPromise && !options.forceFresh) {
    const cached = await activeLocationPromise;
    if (cached) return { latitude: cached.latitude, longitude: cached.longitude };
  }

  if (typeof window === 'undefined') return null;

  activeLocationPromise = (async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');

        // Check and request permissions proactively
        let permissions = await Geolocation.checkPermissions();
        if (permissions.location !== 'granted') {
          permissions = await Geolocation.requestPermissions();
          if (permissions.location !== 'granted') {
            throw new Error('PERMISSION_DENIED');
          }
        }

        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: timeoutMs,
            maximumAge: 60000
          });
          sessionLocationCache = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: Date.now()
          };
          return sessionLocationCache;
        } catch (gpsErr: any) {
          // Fallback to coarse/network location (critical inside concrete buildings)
          try {
            const coarse = await Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              timeout: timeoutMs + 1500,
              maximumAge: 180000
            });
            sessionLocationCache = {
              latitude: coarse.coords.latitude,
              longitude: coarse.coords.longitude,
              timestamp: Date.now()
            };
            return sessionLocationCache;
          } catch (fallbackErr: any) {
            const msg = (gpsErr?.message || fallbackErr?.message || '').toLowerCase();
            if (msg.includes('disabled') || msg.includes('unavailable') || msg.includes('location services')) {
              throw new Error('GPS_DISABLED');
            }
            throw fallbackErr;
          }
        }
      } catch (err: any) {
        throw err;
      }
    } else {
      // Web / PWA browser environment
      if (!('geolocation' in navigator)) {
        throw new Error('NOT_SUPPORTED');
      }

      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        throw new Error('INSECURE_CONTEXT');
      }

      const getWebPos = (opts: PositionOptions) =>
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, opts);
        });

      try {
        const pos = await getWebPos({
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 60000
        });
        sessionLocationCache = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: Date.now()
        };
        return sessionLocationCache;
      } catch (err: any) {
        if (err?.code === 1) throw new Error('PERMISSION_DENIED');
        try {
          const coarse = await getWebPos({
            enableHighAccuracy: false,
            timeout: timeoutMs + 1500,
            maximumAge: 180000
          });
          sessionLocationCache = {
            latitude: coarse.coords.latitude,
            longitude: coarse.coords.longitude,
            timestamp: Date.now()
          };
          return sessionLocationCache;
        } catch (fallbackErr: any) {
          if (fallbackErr?.code === 1) throw new Error('PERMISSION_DENIED');
          if (fallbackErr?.code === 2) throw new Error('GPS_DISABLED');
          throw fallbackErr;
        }
      }
    }
  })();

  try {
    const result = await activeLocationPromise;
    return result ? { latitude: result.latitude, longitude: result.longitude } : null;
  } finally {
    activeLocationPromise = null;
  }
}

/**
 * Reverse-geocode latitude and longitude into human-readable locality, city, state.
 * Uses BigDataCloud reverse geocode client API with 2.5s timeout and memory cache.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const parts: string[] = [];
      if (data.locality && data.locality !== data.city) parts.push(data.locality);
      if (data.city) parts.push(data.city);
      if (data.principalSubdivision) parts.push(data.principalSubdivision);

      const address = parts.length > 0 ? parts.join(', ') : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      addressCache.set(cacheKey, address);
      return address;
    }
  } catch (_) {
    // Timeout or network error, fallback to coordinates
  }

  const fallback = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  return fallback;
}

export interface LocationDetails {
  coords: { latitude: number; longitude: number };
  address: string;
  formattedCoords: string;
}

/**
 * Convenience helper to get location coordinates and reverse-geocoded address
 */
export async function getLocationDetails(options: { timeout?: number } = {}): Promise<LocationDetails | null> {
  try {
    const coords = await acquireLocation(options);
    if (!coords) return null;

    const address = await reverseGeocode(coords.latitude, coords.longitude);
    const latDir = coords.latitude >= 0 ? 'N' : 'S';
    const lonDir = coords.longitude >= 0 ? 'E' : 'W';
    const formattedCoords = `${Math.abs(coords.latitude).toFixed(6)}° ${latDir}, ${Math.abs(coords.longitude).toFixed(6)}° ${lonDir}`;

    return {
      coords,
      address,
      formattedCoords
    };
  } catch (err) {
    console.warn('Location capture skipped:', err);
    return null;
  }
}
