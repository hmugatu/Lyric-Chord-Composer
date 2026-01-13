import { useState, useCallback } from 'react';
import { CompositionSyncManager } from '../services/compositionSyncManager';
import type { Composition } from '../models';
import type { FileMetadata } from '../services/fileStorage/types';

export interface UseSyncReturn {
  isLoading: boolean;
  error: string | null;
  isSynced: (compositionId: string) => boolean;
  syncToCloud: (composition: Composition, provider?: string) => Promise<FileMetadata | undefined>;
  syncFromCloud: (compositionId: string) => Promise<Composition | null>;
  uploadToCloud: (composition: Composition, provider: string) => Promise<FileMetadata | undefined>;
  batchSync: (compositions: Composition[], provider: string) => Promise<void>;
  getSyncInfo: (compositionId: string) => {
    provider: string;
    fileId: string;
    lastSyncedAt: Date;
  } | null;
}

export function useCompositionSync(): UseSyncReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncManager = new CompositionSyncManager();

  const syncToCloud = useCallback(
    async (composition: Composition, provider?: string) => {
      try {
        setIsLoading(true);
        setError(null);
        return await syncManager.syncCompositionToCloud(composition, provider);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const syncFromCloud = useCallback(async (compositionId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      return await syncManager.syncCompositionFromCloud(compositionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadToCloud = useCallback(
    async (composition: Composition, provider: string) => {
      try {
        setIsLoading(true);
        setError(null);
        return await syncManager.uploadCompositionToCloud(composition, provider);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const batchSync = useCallback(
    async (compositions: Composition[], provider: string) => {
      try {
        setIsLoading(true);
        setError(null);
        await syncManager.batchSyncToCloud(compositions, provider);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Batch sync failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const isSynced = useCallback((compositionId: string) => {
    return syncManager.isSynced(compositionId);
  }, []);

  const getSyncInfo = useCallback((compositionId: string) => {
    return syncManager.getSyncInfo(compositionId);
  }, []);

  return {
    isLoading,
    error,
    isSynced,
    syncToCloud,
    syncFromCloud,
    uploadToCloud,
    batchSync,
    getSyncInfo,
  };
}
