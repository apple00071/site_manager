/**
 * Client-side caching system to reduce API requests
 * Implements memory cache with TTL and localStorage persistence
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheConfig {
  defaultTTL: number;
  maxMemoryItems: number;
  enablePersistence: boolean;
}

class ClientCache {
  private memoryCache = new Map<string, CacheItem<any>>();
  private config: CacheConfig = {
    defaultTTL: 5 * 60 * 1000,
    maxMemoryItems: 100,
    enablePersistence: true,
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  private log(...args: unknown[]) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  }

  get<T>(key: string): T | null {
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && this.isValid(memoryItem)) {
      this.log(`Cache HIT (memory): ${key}`);
      return memoryItem.data;
    }

    if (this.config.enablePersistence && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`cache_${key}`);
        if (stored) {
          const item: CacheItem<T> = JSON.parse(stored);
          if (this.isValid(item)) {
            this.memoryCache.set(key, item);
            this.log(`Cache HIT (storage): ${key}`);
            return item.data;
          }

          localStorage.removeItem(`cache_${key}`);
        }
      } catch (error) {
        console.warn('Cache storage error:', error);
      }
    }

    this.log(`Cache MISS: ${key}`);
    return null;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
    };

    this.memoryCache.set(key, item);

    if (this.memoryCache.size > this.config.maxMemoryItems) {
      this.cleanup();
    }

    if (this.config.enablePersistence && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify(item));
      } catch (error) {
        console.warn('Cache storage error:', error);
      }
    }

    this.log(`Cache SET: ${key} (TTL: ${ttl || this.config.defaultTTL}ms)`);
  }

  private isValid<T>(item: CacheItem<T>): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp >= item.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }

  delete(key: string): void {
    this.memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`cache_${key}`);
    }
  }

  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  getStats() {
    return {
      memoryItems: this.memoryCache.size,
      maxItems: this.config.maxMemoryItems,
    };
  }
}

export const apiCache = new ClientCache({
  defaultTTL: 5 * 60 * 1000,
  maxMemoryItems: 50,
  enablePersistence: true,
});

export const notificationCache = new ClientCache({
  defaultTTL: 2 * 60 * 1000,
  maxMemoryItems: 20,
  enablePersistence: false,
});

export const userCache = new ClientCache({
  defaultTTL: 15 * 60 * 1000,
  maxMemoryItems: 10,
  enablePersistence: true,
});

export async function cachedFetch<T>(
  url: string,
  options: RequestInit = {},
  cacheKey?: string,
  ttl?: number
): Promise<T> {
  const key = cacheKey || `fetch_${url}`;

  const cached = apiCache.get<T>(key);
  if (cached) {
    return cached;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`API Request: ${url}`);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  apiCache.set(key, data, ttl);

  return data;
}

export const cacheInvalidation = {
  invalidateProject(projectId: string) {
    const patterns = [
      `projects_${projectId}`,
      `project_members_${projectId}`,
      `project_tasks_${projectId}`,
      `project_updates_${projectId}`,
      'projects_list',
    ];
    patterns.forEach((pattern) => apiCache.delete(pattern));
  },

  invalidateNotifications() {
    notificationCache.clear();
  },

  invalidateUser() {
    userCache.clear();
  },
};
