import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { FileMetadata, CloudProvider } from './types';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_REDIRECT_URL = `${process.env.EXPO_PUBLIC_APP_SCHEME || 'lcc'}://google-auth`;
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'];

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  email: string;
  name: string;
}

export class GoogleDriveProvider implements CloudProvider {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;

  async authenticate(): Promise<void> {
    try {
      // Check for cached tokens
      const cachedAccessToken = await SecureStore.getItemAsync('google_access_token');
      const cachedRefreshToken = await SecureStore.getItemAsync('google_refresh_token');
      const cachedExpiry = await SecureStore.getItemAsync('google_token_expiry');

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
      const scope = GOOGLE_SCOPES.join(' ');
      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URL)}&scope=${encodeURIComponent(scope)}&state=${state}&access_type=offline`;

      // Open browser for OAuth flow
      const result = await WebBrowser.openAuthSessionAsync(
        oauthUrl,
        GOOGLE_REDIRECT_URL
      );

      if (result.type === 'success' && result.url) {
        const code = new URL(result.url).searchParams.get('code');
        if (code) {
          // Exchange code for tokens
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: GOOGLE_CLIENT_ID,
              redirect_uri: GOOGLE_REDIRECT_URL,
              grant_type: 'authorization_code',
            }).toString(),
          });

          const tokenData: GoogleTokenResponse = await tokenResponse.json();
          if (tokenData.access_token) {
            this.accessToken = tokenData.access_token;
            this.refreshToken = tokenData.refresh_token || null;
            this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;

            await SecureStore.setItemAsync('google_access_token', tokenData.access_token);
            if (this.refreshToken) {
              await SecureStore.setItemAsync('google_refresh_token', this.refreshToken);
            }
            await SecureStore.setItemAsync('google_token_expiry', this.tokenExpiry.toString());
          }
        }
      }
    } catch (error) {
      console.error('Google authentication failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `token=${this.accessToken}`,
        });
      }
      await SecureStore.deleteItemAsync('google_access_token');
      await SecureStore.deleteItemAsync('google_refresh_token');
      await SecureStore.deleteItemAsync('google_token_expiry');
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
    } catch (error) {
      console.error('Google logout failed:', error);
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
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      const userInfo: GoogleUserInfo = await response.json();
      return {
        name: userInfo.name,
        email: userInfo.email,
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
      const query = "mimeType='application/x-hmlcc' and trashed=false";
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id,name,modifiedTime,size)`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      const data = await response.json();
      return data.files?.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: 'application/x-hmlcc',
        modifiedTime: new Date(file.modifiedTime),
        size: file.size || 0,
        sourceProvider: 'google-drive',
      })) || [];
    } catch (error) {
      console.error('Failed to list Google Drive files:', error);
      throw error;
    }
  }

  async readFile(fileId: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      return await response.text();
    } catch (error) {
      console.error('Failed to read Google Drive file:', error);
      throw error;
    }
  }

  async writeFile(filename: string, content: string): Promise<FileMetadata> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const metadata = {
        name: filename,
        mimeType: 'application/x-hmlcc',
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', new Blob([content], { type: 'application/x-hmlcc' }));

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: formData,
      });

      const file = await response.json();
      return {
        id: file.id,
        name: file.name,
        mimeType: 'application/x-hmlcc',
        modifiedTime: new Date(file.modifiedTime),
        size: file.size || 0,
        sourceProvider: 'google-drive',
      };
    } catch (error) {
      console.error('Failed to write Google Drive file:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
    } catch (error) {
      console.error('Failed to delete Google Drive file:', error);
      throw error;
    }
  }

  async syncFile(fileId: string, content: string): Promise<FileMetadata> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const formData = new FormData();
      formData.append('file', new Blob([content], { type: 'application/x-hmlcc' }));

      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${this.accessToken}` },
          body: formData,
        }
      );

      const file = await response.json();
      return {
        id: file.id,
        name: file.name,
        mimeType: 'application/x-hmlcc',
        modifiedTime: new Date(file.modifiedTime),
        size: file.size || 0,
        sourceProvider: 'google-drive',
      };
    } catch (error) {
      console.error('Failed to sync Google Drive file:', error);
      throw error;
    }
  }

  async refreshAccessToken(): Promise<void> {
    const cachedRefreshToken = await SecureStore.getItemAsync('google_refresh_token');
    if (!cachedRefreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: cachedRefreshToken,
        }).toString(),
      });

      const tokenData: GoogleTokenResponse = await response.json();
      if (tokenData.access_token) {
        this.accessToken = tokenData.access_token;
        this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;
        await SecureStore.setItemAsync('google_access_token', tokenData.access_token);
        if (tokenData.refresh_token) {
          await SecureStore.setItemAsync('google_refresh_token', tokenData.refresh_token);
          this.refreshToken = tokenData.refresh_token;
        }
        await SecureStore.setItemAsync('google_token_expiry', this.tokenExpiry.toString());
      }
    } catch (error) {
      console.error('Failed to refresh Google token:', error);
      throw error;
    }
  }

  getProviderName(): string {
    return 'Google Drive';
  }
}
