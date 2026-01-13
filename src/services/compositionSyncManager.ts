import type { Composition } from '../models';
import type { FileMetadata } from './fileStorage/types';
import { CompositionStorageService } from './compositionService';

/**
 * Composition Sync Manager
 * Handles syncing compositions with cloud storage
 */
export class CompositionSyncManager {
  private storageService: CompositionStorageService;
  private syncMap: Map<string, { provider: string; fileId: string; lastSyncedAt: Date }> = new Map();

  constructor() {
    this.storageService = new CompositionStorageService();
  }

  /**
   * Register a composition for syncing with cloud storage
   */
  registerSync(compositionId: string, provider: string, fileId: string): void {
    this.syncMap.set(compositionId, {
      provider,
      fileId,
      lastSyncedAt: new Date(),
    });
  }

  /**
   * Unregister a composition from syncing
   */
  unregisterSync(compositionId: string): void {
    this.syncMap.delete(compositionId);
  }

  /**
   * Get sync information for a composition
   */
  getSyncInfo(compositionId: string): {
    provider: string;
    fileId: string;
    lastSyncedAt: Date;
  } | null {
    return this.syncMap.get(compositionId) || null;
  }

  /**
   * Check if a composition is synced with cloud
   */
  isSynced(compositionId: string): boolean {
    return this.syncMap.has(compositionId);
  }

  /**
   * Sync a composition to its cloud provider
   */
  async syncCompositionToCloud(
    composition: Composition,
    providerName?: string
  ): Promise<FileMetadata | undefined> {
    try {
      // Get existing sync info or use provided provider
      const syncInfo = this.getSyncInfo(composition.id);
      const provider = providerName || syncInfo?.provider;

      if (!provider) {
        throw new Error('No provider specified or registered for this composition');
      }

      // Set provider
      await this.storageService.setProvider(provider);

      // Sync composition
      const metadata = await this.storageService.syncComposition(
        composition,
        syncInfo?.fileId
      );

      // Update sync info
      if (metadata) {
        this.registerSync(composition.id, provider, metadata.id);
      }

      return metadata;
    } catch (error) {
      console.error('Failed to sync composition to cloud:', error);
      throw error;
    }
  }

  /**
   * Sync a composition from cloud to local
   */
  async syncCompositionFromCloud(compositionId: string): Promise<Composition | null> {
    try {
      const syncInfo = this.getSyncInfo(compositionId);
      if (!syncInfo) {
        throw new Error('Composition is not synced with cloud');
      }

      // Set provider
      await this.storageService.setProvider(syncInfo.provider);

      // Read file from cloud
      const provider = this.storageService.getCurrentProvider();
      const content = await provider.readFile(syncInfo.fileId);

      // Deserialize composition
      const composition = JSON.parse(content);

      // Update sync time
      this.registerSync(compositionId, syncInfo.provider, syncInfo.fileId);

      return composition;
    } catch (error) {
      console.error('Failed to sync composition from cloud:', error);
      throw error;
    }
  }

  /**
   * Upload a new composition to cloud storage
   */
  async uploadCompositionToCloud(
    composition: Composition,
    providerName: string
  ): Promise<FileMetadata | undefined> {
    try {
      await this.storageService.setProvider(providerName);

      // Export composition to cloud
      const metadata = await this.storageService.syncComposition(composition);

      // Register sync
      if (metadata) {
        this.registerSync(composition.id, providerName, metadata.id);
      }

      return metadata;
    } catch (error) {
      console.error('Failed to upload composition to cloud:', error);
      throw error;
    }
  }

  /**
   * Batch sync multiple compositions
   */
  async batchSyncToCloud(compositions: Composition[], providerName: string): Promise<void> {
    try {
      await this.storageService.setProvider(providerName);

      for (const composition of compositions) {
        const syncInfo = this.getSyncInfo(composition.id);
        const metadata = await this.storageService.syncComposition(
          composition,
          syncInfo?.fileId
        );

        if (metadata) {
          this.registerSync(composition.id, providerName, metadata.id);
        }
      }
    } catch (error) {
      console.error('Batch sync failed:', error);
      throw error;
    }
  }

  /**
   * Get all synced compositions
   */
  getSyncedCompositions(): Array<{
    compositionId: string;
    provider: string;
    fileId: string;
    lastSyncedAt: Date;
  }> {
    return Array.from(this.syncMap.entries()).map(([compositionId, info]) => ({
      compositionId,
      ...info,
    }));
  }

  /**
   * Clear all sync information
   */
  clearAllSync(): void {
    this.syncMap.clear();
  }
}
