/**
 * Composition Cache Service
 * Handles local caching of compositions using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Composition } from '../models';

const CACHE_KEY = '@lyric-chord-composer:compositions';
const CACHE_METADATA_KEY = '@lyric-chord-composer:cache-metadata';

interface CacheMetadata {
  lastUpdated: string;
  compositionCount: number;
}

export class CompositionCache {
  /**
   * Save compositions to cache
   */
  async saveToCache(compositions: Composition[]): Promise<void> {
    try {
      const data = JSON.stringify(compositions);
      await AsyncStorage.setItem(CACHE_KEY, data);

      // Update metadata
      const metadata: CacheMetadata = {
        lastUpdated: new Date().toISOString(),
        compositionCount: compositions.length,
      };
      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to save to cache:', error);
      throw new Error('Failed to save compositions to local cache');
    }
  }

  /**
   * Load compositions from cache
   */
  async loadFromCache(): Promise<Composition[]> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEY);
      if (!data) {
        return [];
      }

      return JSON.parse(data) as Composition[];
    } catch (error) {
      console.error('Failed to load from cache:', error);
      return [];
    }
  }

  /**
   * Get cache metadata
   */
  async getCacheMetadata(): Promise<CacheMetadata | null> {
    try {
      const data = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      if (!data) {
        return null;
      }

      return JSON.parse(data) as CacheMetadata;
    } catch (error) {
      console.error('Failed to get cache metadata:', error);
      return null;
    }
  }

  /**
   * Clear all cached compositions
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([CACHE_KEY, CACHE_METADATA_KEY]);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw new Error('Failed to clear local cache');
    }
  }

  /**
   * Check if cache exists
   */
  async hasCache(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEY);
      return data !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get cache size (approximate)
   */
  async getCacheSize(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEY);
      if (!data) {
        return 0;
      }

      // Return size in bytes
      return new Blob([data]).size;
    } catch {
      return 0;
    }
  }
}
