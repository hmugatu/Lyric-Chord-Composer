import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { FileMetadata, CloudProvider } from './types';

const ONEDRIVE_CLIENT_ID = process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_ID || '';
const ONEDRIVE_REDIRECT_URL = `${process.env.EXPO_PUBLIC_APP_SCHEME || 'lcc'}://onedrive-auth`;
const ONEDRIVE_SCOPES = ['Files.ReadWrite', 'User.Read'];

interface OneDriveTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface OneDriveUserInfo {
  userPrincipalName: string;
  displayName: string;
}

export class OneDriveProvider implements CloudProvider {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;

  async authenticate(): Promise<void> {
    try {
      // Check for cached tokens
      const cachedAccessToken = await SecureStore.getItemAsync('onedrive_access_token');
      const cachedRefreshToken = await SecureStore.getItemAsync('onedrive_refresh_token');
      const cachedExpiry = await SecureStore.getItemAsync('onedrive_token_expiry');

      if (cachedAccessToken && cachedExpiry) {
        const expiry = parseInt(cachedExpiry);
        if (expiry > Date.now()) {
          this.accessToken = cachedAccessToken;
          this.refreshToken = cachedRefreshToken;
          this.tokenExpiry = expiry;
          return;
        }
      }

      // Generate OAuth URL
      const state = Math.random().toString(36).substring(7);
      const scope = `${ONEDRIVE_SCOPES.join(' ')}/Contacts.Read`;
      const oauthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${ONEDRIVE_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(ONEDRIVE_REDIRECT_URL)}&scope=${encodeURIComponent(scope)}&state=${state}`;

      // Open browser for OAuth flow
      const result = await WebBrowser.openAuthSessionAsync(
        oauthUrl,
        ONEDRIVE_REDIRECT_URL
      );

      if (result.type === 'success' && result.url) {
        const code = new URL(result.url).searchParams.get('code');
        if (code) {
          // Exchange code for tokens
          const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: ONEDRIVE_CLIENT_ID,
              redirect_uri: ONEDRIVE_REDIRECT_URL,
              grant_type: 'authorization_code',
            }).toString(),
          });

          const tokenData: OneDriveTokenResponse = await tokenResponse.json();
          if (tokenData.access_token) {
            this.accessToken = tokenData.access_token;
            this.refreshToken = tokenData.refresh_token || null;
            this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;

            await SecureStore.setItemAsync('onedrive_access_token', tokenData.access_token);
            if (this.refreshToken) {
              await SecureStore.setItemAsync('onedrive_refresh_token', this.refreshToken);
            }
            await SecureStore.setItemAsync('onedrive_token_expiry', this.tokenExpiry.toString());
          }
        }
      }
    } catch (error) {
      console.error('OneDrive authentication failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `token=${this.accessToken}`,
        });
      }
      await SecureStore.deleteItemAsync('onedrive_access_token');
      await SecureStore.deleteItemAsync('onedrive_refresh_token');
      await SecureStore.deleteItemAsync('onedrive_token_expiry');
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
    } catch (error) {
      console.error('OneDrive logout failed:', error);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  async getUserInfo(): Promise<{ name: string; email: string }> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      const userInfo: OneDriveUserInfo = await response.json();
      return {
        name: userInfo.displayName,
        email: userInfo.userPrincipalName,
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  async listFiles(): Promise<FileMetadata[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq 'Compositions'",
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      const folderData = await response.json();
      const compositionsFolder = folderData.value?.[0];

      if (!compositionsFolder) {
        return [];
      }

      const filesResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${compositionsFolder.id}/children?$filter=endswith(name, '.hmlcc')`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      const filesData = await filesResponse.json();
      return filesData.value?.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: 'application/x-hmlcc',
        modifiedTime: new Date(file.lastModifiedDateTime),
        size: file.size || 0,
        sourceProvider: 'onedrive',
      })) || [];
    } catch (error) {
      console.error('Failed to list OneDrive files:', error);
      throw error;
    }
  }

  async readFile(fileId: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      return await response.text();
    } catch (error) {
      console.error('Failed to read OneDrive file:', error);
      throw error;
    }
  }

  async writeFile(filename: string, content: string): Promise<FileMetadata> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      // First, ensure Compositions folder exists
      const compositionsFolderId = await this.getOrCreateCompositionsFolder();

      // Upload file
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${compositionsFolderId}:/${filename}:/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/x-hmlcc',
          },
          body: content,
        }
      );

      const file = await response.json();
      return {
        id: file.id,
        name: file.name,
        mimeType: 'application/x-hmlcc',
        modifiedTime: new Date(file.lastModifiedDateTime),
        size: file.size || 0,
        sourceProvider: 'onedrive',
      };
    } catch (error) {
      console.error('Failed to write OneDrive file:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
    } catch (error) {
      console.error('Failed to delete OneDrive file:', error);
      throw error;
    }
  }

  async syncFile(fileId: string, content: string): Promise<FileMetadata> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/x-hmlcc',
          },
          body: content,
        }
      );

      const file = await response.json();
      return {
        id: file.id,
        name: file.name,
        mimeType: 'application/x-hmlcc',
        modifiedTime: new Date(file.lastModifiedDateTime),
        size: file.size || 0,
        sourceProvider: 'onedrive',
      };
    } catch (error) {
      console.error('Failed to sync OneDrive file:', error);
      throw error;
    }
  }

  async refreshAccessToken(): Promise<void> {
    const cachedRefreshToken = await SecureStore.getItemAsync('onedrive_refresh_token');
    if (!cachedRefreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: ONEDRIVE_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: cachedRefreshToken,
        }).toString(),
      });

      const tokenData: OneDriveTokenResponse = await response.json();
      if (tokenData.access_token) {
        this.accessToken = tokenData.access_token;
        this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;
        await SecureStore.setItemAsync('onedrive_access_token', tokenData.access_token);
        await SecureStore.setItemAsync('onedrive_token_expiry', this.tokenExpiry.toString());
        if (tokenData.refresh_token) {
          await SecureStore.setItemAsync('onedrive_refresh_token', tokenData.refresh_token);
          this.refreshToken = tokenData.refresh_token;
        }
      }
    } catch (error) {
      console.error('Failed to refresh OneDrive token:', error);
      throw error;
    }
  }

  private async getOrCreateCompositionsFolder(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      // Check if folder exists
      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq 'Compositions'",
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      const data = await response.json();
      if (data.value?.length > 0) {
        return data.value[0].id;
      }

      // Create folder if it doesn't exist
      const createResponse = await fetch(
        'https://graph.microsoft.com/v1.0/me/drive/root/children',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Compositions',
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          }),
        }
      );
      const folder = await createResponse.json();
      return folder.id;
    } catch (error) {
      console.error('Failed to get or create Compositions folder:', error);
      throw error;
    }
  }

  getProviderName(): string {
    return 'OneDrive';
  }
}
