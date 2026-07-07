/**
 * Composition Cache Service (web)
 * Persists compositions in the browser via localStorage.
 * Async signatures are preserved so callers don't need to change.
 */

import type { Composition } from '../models';

const CACHE_KEY = '@lyric-chord-composer:compositions';
const CACHE_METADATA_KEY = '@lyric-chord-composer:cache-metadata';

interface CacheMetadata {
  lastUpdated: string;
  compositionCount: number;
}

export class CompositionCache {
  async saveToCache(compositions: Composition[]): Promise<void> {
    try {
      const data = JSON.stringify(compositions);
      localStorage.setItem(CACHE_KEY, data);

      const metadata: CacheMetadata = {
        lastUpdated: new Date().toISOString(),
        compositionCount: compositions.length,
      };
      localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to save to cache:', error);
      throw new Error('Failed to save compositions to local cache');
    }
  }

  async loadFromCache(): Promise<Composition[]> {
    try {
      const data = localStorage.getItem(CACHE_KEY);
      if (!data) {
        return [];
      }
      return JSON.parse(data) as Composition[];
    } catch (error) {
      console.error('Failed to load from cache:', error);
      return [];
    }
  }

  async getCacheMetadata(): Promise<CacheMetadata | null> {
    try {
      const data = localStorage.getItem(CACHE_METADATA_KEY);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as CacheMetadata;
    } catch (error) {
      console.error('Failed to get cache metadata:', error);
      return null;
    }
  }

  async clearCache(): Promise<void> {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_METADATA_KEY);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw new Error('Failed to clear local cache');
    }
  }

  async hasCache(): Promise<boolean> {
    return localStorage.getItem(CACHE_KEY) !== null;
  }

  async getCacheSize(): Promise<number> {
    const data = localStorage.getItem(CACHE_KEY);
    if (!data) {
      return 0;
    }
    return new Blob([data]).size;
  }
}
