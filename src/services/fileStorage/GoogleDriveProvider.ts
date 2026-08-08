/**
 * Google Drive storage provider.
 *
 * Stores compositions as `.hmlcc` files in a visible "Lyric Chord Composer"
 * folder in the user's own Drive. Auth uses Google Identity Services (GIS) with
 * the implicit token flow; the Drive REST API is called directly with `fetch`,
 * so neither `gapi` nor any Google npm package is needed.
 *
 * Scope is `drive.file` — the narrowest Drive scope. It grants access only to
 * files this app created, so we can never see the rest of the user's Drive.
 *
 * Access tokens live in memory only (never localStorage) and last ~1 hour. The
 * implicit flow issues no refresh token, so `refreshAccessToken` re-requests
 * silently; GIS returns a fresh token without a prompt while the user still has
 * an active Google session.
 */

import type { CloudProvider, FileMetadata } from './types';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Lyric Chord Composer';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_MIME = 'application/x-hmlcc';

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/** Refresh a bit early so a token can't expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
}

/** Escape a value for embedding in a Drive `q` query string literal. */
function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

let gisPromise: Promise<void> | null = null;

/** Load the GIS client script once, shared across provider instances. */
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Google sign-in is only available in a browser'));
      return;
    }
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      // Allow a later retry rather than caching the failure forever.
      gisPromise = null;
      reject(new Error('Failed to load Google sign-in'));
    });

    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return gisPromise;
}

export interface DriveUserInfo {
  name: string;
  email: string;
  picture?: string;
}

export class GoogleDriveProvider implements CloudProvider {
  private accessToken: string | null = null;
  private expiresAt = 0;
  private folderId: string | null = null;
  private tokenClient: any = null;
  private userInfo: DriveUserInfo | null = null;
  /** De-duplicates concurrent token requests (many saves can race). */
  private pending: Promise<string> | null = null;

  getProviderName(): string {
    return 'google-drive';
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null && Date.now() < this.expiresAt - EXPIRY_SKEW_MS;
  }

  /** Interactive sign-in: shows the Google consent/account picker. */
  async authenticate(): Promise<void> {
    await this.requestToken(true);
  }

  /**
   * Try to restore a session without showing any UI. Resolves false when the
   * user must sign in interactively. Used on mount and after token expiry.
   */
  async trySilentAuth(): Promise<boolean> {
    try {
      await this.requestToken(false);
      return true;
    } catch {
      return false;
    }
  }

  async refreshAccessToken(): Promise<void> {
    if (!(await this.trySilentAuth())) {
      // Silent refresh failed (user signed out of Google, or consent revoked).
      await this.requestToken(true);
    }
  }

  async logout(): Promise<void> {
    this.clearSession();
  }

  async revokeAccess(): Promise<void> {
    const token = this.accessToken;
    this.clearSession();
    if (!token) return;
    try {
      (window as any).google?.accounts?.oauth2?.revoke(token);
    } catch (error) {
      // Revocation is best-effort; local state is already cleared.
      console.warn('Failed to revoke Google access token:', error);
    }
  }

  private clearSession(): void {
    this.accessToken = null;
    this.expiresAt = 0;
    this.folderId = null;
    this.userInfo = null;
    this.pending = null;
  }

  /**
   * Acquire an access token, reusing a valid one when present.
   * `interactive: false` asks GIS for a silent grant (`prompt: ''`).
   */
  private async requestToken(interactive: boolean): Promise<string> {
    if (this.isAuthenticated()) return this.accessToken as string;
    if (this.pending) return this.pending;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        'Missing Google config: set VITE_GOOGLE_CLIENT_ID (see .env.example).',
      );
    }

    this.pending = (async () => {
      await loadGis();
      const oauth2 = (window as any).google?.accounts?.oauth2;
      if (!oauth2) throw new Error('Google sign-in unavailable');

      const token = await new Promise<string>((resolve, reject) => {
        if (!this.tokenClient) {
          this.tokenClient = oauth2.initTokenClient({
            client_id: clientId,
            scope: DRIVE_SCOPE,
            callback: () => {}, // replaced per-request below
          });
        }
        this.tokenClient.callback = (response: TokenResponse) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error ?? 'Google sign-in was cancelled'));
            return;
          }
          this.accessToken = response.access_token;
          this.expiresAt = Date.now() + Number(response.expires_in ?? 3600) * 1000;
          resolve(response.access_token);
        };
        this.tokenClient.error_callback = (error: { type?: string }) => {
          reject(new Error(error?.type ?? 'Google sign-in failed'));
        };
        // '' lets GIS skip the prompt when the user has already granted consent;
        // 'consent' forces the account picker for an explicit sign-in click.
        this.tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      });

      return token;
    })();

    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }

  async getUserInfo(): Promise<DriveUserInfo> {
    if (this.userInfo) return this.userInfo;
    // `drive.file` includes the `about` endpoint's user field — no extra scope.
    const about = await this.fetchJson<{ user?: DriveUserInfo }>(
      'https://www.googleapis.com/drive/v3/about?fields=user',
    );
    this.userInfo = {
      name: about.user?.name ?? 'Google user',
      email: about.user?.email ?? '',
      picture: about.user?.picture,
    };
    return this.userInfo;
  }

  /**
   * Authenticated fetch that retries once after a silent token refresh, so a
   * token expiring mid-session doesn't surface as a failed save.
   */
  private async authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    if (!this.isAuthenticated()) await this.refreshAccessToken();

    const send = () =>
      fetch(url, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${this.accessToken}` },
      });

    let response = await send();
    if (response.status === 401) {
      await this.refreshAccessToken();
      response = await send();
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Google Drive request failed (${response.status}): ${body.slice(0, 200)}`);
    }
    return response;
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.authedFetch(url, init);
    return (await response.json()) as T;
  }

  /** Resolve (creating if needed) the app's Drive folder, caching the id. */
  private async ensureFolder(): Promise<string> {
    if (this.folderId) return this.folderId;

    const q = [
      `name='${escapeQueryValue(FOLDER_NAME)}'`,
      `mimeType='${FOLDER_MIME}'`,
      'trashed=false',
    ].join(' and ');
    const found = await this.fetchJson<{ files: DriveFile[] }>(
      `${DRIVE_FILES}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    );

    if (found.files?.length) {
      this.folderId = found.files[0].id;
      return this.folderId;
    }

    const created = await this.fetchJson<DriveFile>(`${DRIVE_FILES}?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
    });
    this.folderId = created.id;
    return this.folderId;
  }

  private toMetadata(file: DriveFile): FileMetadata {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : new Date(0),
      size: Number(file.size ?? 0),
      sourceProvider: 'google-drive',
      lastSyncedAt: new Date(),
    };
  }

  /** All `.hmlcc` files in the app folder, paging through the full listing. */
  async listFiles(): Promise<FileMetadata[]> {
    const folderId = await this.ensureFolder();
    const q = `'${folderId}' in parents and trashed=false`;
    const files: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q,
        fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,size)',
        pageSize: '100',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const page = await this.fetchJson<{ files: DriveFile[]; nextPageToken?: string }>(
        `${DRIVE_FILES}?${params}`,
      );
      files.push(...(page.files ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);

    return files.filter((f) => f.name.endsWith('.hmlcc')).map((f) => this.toMetadata(f));
  }

  async readFile(fileId: string): Promise<string> {
    const response = await this.authedFetch(
      `${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media`,
    );
    return response.text();
  }

  /** Create a new file in the app folder. Use `updateFile` to overwrite. */
  async writeFile(filename: string, content: string): Promise<FileMetadata> {
    const folderId = await this.ensureFolder();
    const metadata = { name: filename, parents: [folderId], mimeType: FILE_MIME };
    const created = await this.fetchJson<DriveFile>(
      `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size`,
      { method: 'POST', body: this.multipartBody(metadata, content) },
    );
    return this.toMetadata(created);
  }

  /** Overwrite an existing file's content (and name, if it changed). */
  async updateFile(fileId: string, filename: string, content: string): Promise<FileMetadata> {
    const updated = await this.fetchJson<DriveFile>(
      `${DRIVE_UPLOAD}/${encodeURIComponent(fileId)}?uploadType=multipart` +
        '&fields=id,name,mimeType,modifiedTime,size',
      { method: 'PATCH', body: this.multipartBody({ name: filename }, content) },
    );
    return this.toMetadata(updated);
  }

  async syncFile(fileId: string, content: string): Promise<FileMetadata> {
    const existing = await this.fetchJson<DriveFile>(
      `${DRIVE_FILES}/${encodeURIComponent(fileId)}?fields=name`,
    );
    return this.updateFile(fileId, existing.name, content);
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.authedFetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Build a multipart/related body pairing JSON metadata with file content.
   * FormData can't be used here: Drive requires `multipart/related`, and the
   * browser always sends FormData as `multipart/form-data`.
   */
  private multipartBody(metadata: object, content: string): Blob {
    const boundary = 'hmlcc-boundary-7Mv0kQ';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${FILE_MIME}\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;
    return new Blob([body], { type: `multipart/related; boundary=${boundary}` });
  }
}

/** Shared instance — the auth layer and the repo must use the same token. */
export const googleDrive = new GoogleDriveProvider();
