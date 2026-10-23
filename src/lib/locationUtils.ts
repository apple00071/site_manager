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
 * Detects mock locations / Fake GPS apps on Android (Capacitor) or browser.
 * Real GPS sensor fixes always have positive variance (accuracy > 0) and lack mock provider flags.
 */
export function isMockLocation(pos: any): boolean {
  if (!pos) return false;
  // Android Capacitor / Native mock location flags
  if (
    pos.isMock === true ||
    pos.coords?.isMock === true ||
    pos.coords?.mocked === true ||
    pos.coords?.isFromMockProvider === true
  ) {
    return true;
  }
  return false;
}

/**
 * Acquire GPS location using Capacitor Geolocation on native devices
 * or navigator.geolocation in browser/PWA.
 * Prioritizes warm session cache (< 3 minutes) so punch in succeeds on the 1st tap.
 */
export async function acquireLocation(options: { forceFresh?: boolean; timeout?: number } = {}): Promise<{ latitude: number; longitude: number } | null> {
  const timeoutMs = options.timeout ?? 12000;

  // 1. If we have a warm fix within the last 3 minutes (180,000ms), return immediately!
  if (!options.forceFresh && sessionLocationCache && (Date.now() - sessionLocationCache.timestamp < 180000)) {
    return {
      latitude: sessionLocationCache.latitude,
      longitude: sessionLocationCache.longitude
    };
  }

  // 2. Even if forceFresh is requested, if we have a fix within the last 60 seconds, reuse it!
  if (sessionLocationCache && (Date.now() - sessionLocationCache.timestamp < 60000)) {
    return {
      latitude: sessionLocationCache.latitude,
      longitude: sessionLocationCache.longitude
    };
  }

  // Reuse in-flight promise if one is already running
  if (activeLocationPromise) {
    const cached = await activeLocationPromise;
    if (cached) return { latitude: cached.latitude, longitude: cached.longitude };
  }

  if (typeof window === 'undefined') return null;

  activeLocationPromise = (async () => {
    // Allow up to 60s cached position from device OS to avoid cold satellite lock delays
    const maxAge = 60000;

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

        // 1. Try fast coarse/network location first (returns in <1s on mobile networks)
        try {
          const coarse = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 6000,
            maximumAge: maxAge
          });
          if (isMockLocation(coarse)) {
            sessionLocationCache = null;
            throw new Error('MOCK_LOCATION_DETECTED');
          }
          sessionLocationCache = {
            latitude: coarse.coords.latitude,
            longitude: coarse.coords.longitude,
            timestamp: Date.now()
          };

          // Try upgrading to high accuracy in background without blocking
          Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 })
            .then(pos => {
              if (isMockLocation(pos)) return;
              sessionLocationCache = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                timestamp: Date.now()
              };
            })
            .catch(() => {});

          return sessionLocationCache;
        } catch (coarseErr: any) {
          if (coarseErr?.message === 'MOCK_LOCATION_DETECTED') throw coarseErr;

          // 2. If coarse failed, try high accuracy with full timeout
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: timeoutMs,
            maximumAge: maxAge
          });
          if (isMockLocation(pos)) {
            sessionLocationCache = null;
            throw new Error('MOCK_LOCATION_DETECTED');
          }
          sessionLocationCache = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: Date.now()
          };
          return sessionLocationCache;
        }
      } catch (err: any) {
        if (err?.message === 'MOCK_LOCATION_DETECTED') throw err;
        // Fallback to any recent session cache before failing
        if (sessionLocationCache && (Date.now() - sessionLocationCache.timestamp < 900000)) {
          return sessionLocationCache;
        }
        const msg = (err?.message || '').toLowerCase();
        if (msg.includes('disabled') || msg.includes('unavailable') || msg.includes('location services')) {
          throw new Error('GPS_DISABLED');
        }
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

      // 1. Try fast coarse positioning first (Wi-Fi / Cell tower / IP) - works in 200ms
      try {
        const coarse = await getWebPos({
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: maxAge
        });

        if (isMockLocation(coarse)) {
          sessionLocationCache = null;
          throw new Error('MOCK_LOCATION_DETECTED');
        }

        sessionLocationCache = {
          latitude: coarse.coords.latitude,
          longitude: coarse.coords.longitude,
          timestamp: Date.now()
        };

        // In background, upgrade to high-accuracy GPS if satellite fix is available
        getWebPos({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 })
          .then(high => {
            if (isMockLocation(high)) return;
            sessionLocationCache = {
              latitude: high.coords.latitude,
              longitude: high.coords.longitude,
              timestamp: Date.now()
            };
          })
          .catch(() => {});

        return sessionLocationCache;
      } catch (coarseErr: any) {
        if (coarseErr?.message === 'MOCK_LOCATION_DETECTED') throw coarseErr;
        if (coarseErr?.code === 1) throw new Error('PERMISSION_DENIED');

        // 2. If coarse failed, try high-accuracy GPS
        try {
          const highPos = await getWebPos({
            enableHighAccuracy: true,
            timeout: timeoutMs,
            maximumAge: maxAge
          });
          if (isMockLocation(highPos)) {
            sessionLocationCache = null;
            throw new Error('MOCK_LOCATION_DETECTED');
          }
          sessionLocationCache = {
            latitude: highPos.coords.latitude,
            longitude: highPos.coords.longitude,
            timestamp: Date.now()
          };
          return sessionLocationCache;
        } catch (highErr: any) {
          if (highErr?.message === 'MOCK_LOCATION_DETECTED') throw highErr;
          if (highErr?.code === 1) throw new Error('PERMISSION_DENIED');
          if (highErr?.code === 2) throw new Error('GPS_DISABLED');

          // Fallback to recent session cache before failing
          if (sessionLocationCache && (Date.now() - sessionLocationCache.timestamp < 900000)) {
            return sessionLocationCache;
          }
          throw highErr;
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
  // Reject Null Island / dummy (0,0) coordinates
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) {
    return '';
  }

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
      if (address.toLowerCase().includes('atlantic ocean')) return '';
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
export async function getLocationDetails(options: { timeout?: number; forceFresh?: boolean; throwOnError?: boolean } = {}): Promise<LocationDetails | null> {
  try {
    const coords = await acquireLocation(options);
    if (!coords || !coords.latitude || !coords.longitude || (Math.abs(coords.latitude) < 0.0001 && Math.abs(coords.longitude) < 0.0001)) {
      if (options.throwOnError) throw new Error('LOCATION_UNAVAILABLE');
      return null;
    }

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
    if (options.throwOnError) throw err;
    console.warn('Location capture skipped:', err);
    return null;
  }
}
