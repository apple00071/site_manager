/**
 * Client-side caching system to reduce API requests
 * Implements memory cache with TTL and localStorage persistence
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheConfig {
  defaultTTL: number;
  maxMemoryItems: number;
  enablePersistence: boolean;
}

class ClientCache {
  private memoryCache = new Map<string, CacheItem<any>>();
  private config: CacheConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes default
    maxMemoryItems: 100,
    enablePersistence: true
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    // Check memory cache first
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && this.isValid(memoryItem)) {
      console.log(`✅ Cache HIT (memory): ${key}`);
      return memoryItem.data;
    }

    // Check localStorage if enabled
    if (this.config.enablePersistence && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`cache_${key}`);
        if (stored) {
          const item: CacheItem<T> = JSON.parse(stored);
          if (this.isValid(item)) {
            // Restore to memory cache
            this.memoryCache.set(key, item);
            console.log(`✅ Cache HIT (storage): ${key}`);
            return item.data;
          } else {
            // Remove expired item
            localStorage.removeItem(`cache_${key}`);
          }
        }
      } catch (error) {
        console.warn('Cache storage error:', error);
      }
    }

    console.log(`❌ Cache MISS: ${key}`);
    return null;
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL
    };

    // Store in memory
    this.memoryCache.set(key, item);

    // Cleanup old items if needed
    if (this.memoryCache.size > this.config.maxMemoryItems) {
      this.cleanup();
    }

    // Store in localStorage if enabled
    if (this.config.enablePersistence && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify(item));
      } catch (error) {
        console.warn('Cache storage error:', error);
      }
    }

    console.log(`💾 Cache SET: ${key} (TTL: ${ttl || this.config.defaultTTL}ms)`);
  }

  /**
   * Check if cache item is still valid
   */
  private isValid<T>(item: CacheItem<T>): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }

  /**
   * Remove expired items from memory cache
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp >= item.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`cache_${key}`);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      // Clear all cache items from localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memoryItems: this.memoryCache.size,
      maxItems: this.config.maxMemoryItems
    };
  }
}

// Create cache instances for different data types
export const apiCache = new ClientCache({
  defaultTTL: 5 * 60 * 1000, // 5 minutes for API data
  maxMemoryItems: 50,
  enablePersistence: true
});

export const notificationCache = new ClientCache({
  defaultTTL: 2 * 60 * 1000, // 2 minutes for notifications
  maxMemoryItems: 20,
  enablePersistence: false // Don't persist notifications
});

export const userCache = new ClientCache({
  defaultTTL: 15 * 60 * 1000, // 15 minutes for user data
  maxMemoryItems: 10,
  enablePersistence: true
});

/**
 * Cached fetch wrapper
 */
export async function cachedFetch<T>(
  url: string, 
  options: RequestInit = {},
  cacheKey?: string,
  ttl?: number
): Promise<T> {
  const key = cacheKey || `fetch_${url}`;
  
  // Try cache first
  const cached = apiCache.get<T>(key);
  if (cached) {
    return cached;
  }

  // Fetch from API
  console.log(`🌐 API Request: ${url}`);
  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Cache the result
  apiCache.set(key, data, ttl);
  
  return data;
}

/**
 * Cache invalidation helpers
 */
export const cacheInvalidation = {
  // Invalidate all project-related cache
  invalidateProject(projectId: string) {
    const patterns = [
      `projects_${projectId}`,
      `project_members_${projectId}`,
      `project_tasks_${projectId}`,
      `project_updates_${projectId}`,
      'projects_list'
    ];
    patterns.forEach(pattern => apiCache.delete(pattern));
  },

  // Invalidate notification cache
  invalidateNotifications() {
    notificationCache.clear();
  },

  // Invalidate user cache
  invalidateUser() {
    userCache.clear();
  }
};
