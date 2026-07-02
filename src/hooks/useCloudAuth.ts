import { useState, useCallback } from 'react';
import { CloudAuthManager } from '../services/cloudAuthManager';
import { GoogleDriveProvider } from '../services/fileStorage/GoogleDriveProvider';
import { OneDriveProvider } from '../services/fileStorage/OneDriveProvider';
import type { CloudProvider } from '../services/fileStorage/types';

export interface UseCloudAuthReturn {
  isLoading: boolean;
  error: string | null;
  authenticateProvider: (providerName: string) => Promise<void>;
  logoutProvider: (providerName: string) => Promise<void>;
  getProviderInfo: (providerName: string) => Promise<{ name: string; email: string } | undefined>;
  isAuthenticated: (providerName: string) => boolean;
}

const providerMap: Record<string, CloudProvider> = {

  'google-drive': new GoogleDriveProvider(),
  onedrive: new OneDriveProvider(),
};

export function useCloudAuth(): UseCloudAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authManager = CloudAuthManager.getInstance();

  const authenticateProvider = useCallback(
    async (providerName: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const provider = providerMap[providerName];
        if (!provider) {
          throw new Error(`Unknown provider: ${providerName}`);
        }

        await authManager.authenticate(provider, providerName);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [authManager]
  );

  const logoutProvider = useCallback(
    async (providerName: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const provider = providerMap[providerName];
        if (!provider) {
          throw new Error(`Unknown provider: ${providerName}`);
        }

        await authManager.logout(provider, providerName);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Logout failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [authManager]
  );

  const getProviderInfo = useCallback(
    async (providerName: string) => {
      try {
        setError(null);
        return await authManager.getUserInfo(providerName);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get provider info';
        setError(message);
        throw err;
      }
    },
    [authManager]
  );

  const isAuthenticated = useCallback(
    (providerName: string) => {
      return authManager.isAuthenticated(providerName);
    },
    [authManager]
  );

  return {
    isLoading,
    error,
    authenticateProvider,
    logoutProvider,
    getProviderInfo,
    isAuthenticated,
  };
}
