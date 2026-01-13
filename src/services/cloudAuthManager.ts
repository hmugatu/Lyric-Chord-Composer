/**
 * Cloud Authentication Manager
 * Centralized OAuth token management across cloud providers
 */

import type { CloudProvider } from './fileStorage/types';

export class CloudAuthManager {
  private static instance: CloudAuthManager;
  private authStates: Map<string, boolean> = new Map();
  private providers: Map<string, CloudProvider> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): CloudAuthManager {
    if (!CloudAuthManager.instance) {
      CloudAuthManager.instance = new CloudAuthManager();
    }
    return CloudAuthManager.instance;
  }

  /**
   * Register a cloud provider
   */
  registerProvider(providerName: string, provider: CloudProvider): void {
    this.providers.set(providerName, provider);
    this.authStates.set(providerName, false);
  }

  /**
   * Authenticate with a cloud provider
   */
  async authenticate(provider: CloudProvider, providerName: string): Promise<void> {
    try {
      await provider.authenticate?.();
      this.authStates.set(providerName, true);
    } catch (error) {
      this.authStates.set(providerName, false);
      throw error;
    }
  }

  /**
   * Logout from a cloud provider
   */
  async logout(provider: CloudProvider, providerName: string): Promise<void> {
    try {
      await provider.logout?.();
      this.authStates.set(providerName, false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Check if authenticated with provider
   */
  isAuthenticated(providerName: string): boolean {
    const provider = this.providers.get(providerName);
    if (!provider) return false;
    return provider.isAuthenticated?.() ?? false;
  }

  /**
   * Get user info from provider
   */
  async getUserInfo(providerName: string): Promise<{ name: string; email: string } | undefined> {
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Provider not found: ${providerName}`);
    return await provider.getUserInfo?.();
  }

  /**
   * Get provider by name
   */
  getProvider(providerName: string): CloudProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get all registered provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Refresh access token for provider
   */
  async refreshAccessToken(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName) as any;
    if (!provider) throw new Error(`Provider not found: ${providerName}`);
    if (provider.refreshAccessToken) {
      await provider.refreshAccessToken();
    }
  }

  /**
   * Revoke access for provider
   */
  async revokeAccess(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName) as any;
    if (!provider) throw new Error(`Provider not found: ${providerName}`);
    if (provider.revokeAccess) {
      await provider.revokeAccess();
    }
  }
}
