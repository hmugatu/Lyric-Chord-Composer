/**
 * Auth context backed by Google (Drive) sign-in.
 *
 * Compositions live in the user's own Drive, so "signing in" means holding a
 * valid Drive access token. `App` gates its routes on this: no session → sign-in
 * screen.
 *
 * Tokens are held in memory only (see GoogleDriveProvider), so a reload has no
 * stored session to restore. On mount we attempt a *silent* token request —
 * while the user still has an active Google session and has already granted
 * consent, this succeeds without any UI, so a reload is not a visible re-login.
 */

import React from 'react';
import { googleDrive, type DriveUserInfo } from '../services/fileStorage/GoogleDriveProvider';
import { resetRepo } from '../services/compositionsRepo';

interface AuthContextValue {
  /** The signed-in Google user, or null when signed out. */
  session: DriveUserInfo | null;
  user: DriveUserInfo | null;
  loading: boolean;
  /** Open the Google consent/account picker and connect Drive. */
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = React.useState<DriveUserInfo | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    // Attempt to restore the session without prompting.
    (async () => {
      try {
        if (await googleDrive.trySilentAuth()) {
          const info = await googleDrive.getUserInfo();
          if (active) setSession(info);
        }
      } catch (error) {
        // Silent restore is best-effort; fall through to the sign-in screen.
        console.warn('Silent Google sign-in failed:', error);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      user: session,
      loading,
      signIn: async () => {
        await googleDrive.authenticate();
        setSession(await googleDrive.getUserInfo());
      },
      signOut: async () => {
        resetRepo();
        await googleDrive.revokeAccess();
        setSession(null);
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
