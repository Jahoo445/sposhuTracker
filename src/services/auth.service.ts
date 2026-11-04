import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../config';
import { ArtistCacheService } from './artist-cache.service';
import { EpisodePageCacheService } from './episode-page-cache.service';
import {
  SessionUser,
  clearSessionToken,
  readSessionToken,
  sessionUser,
  writeSessionToken
} from './session-cookie';

export type User = SessionUser;

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, unknown>): void;
      disableAutoSelect(): void;
    };
  };
};

/** Where sessions were kept before the login was shared with SpoShu. */
const LEGACY_STORAGE_KEY = 'sposhu.session';
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
/** Id of the user the local caches were written for. */
const CACHE_OWNER_KEY = 'tracker.cache-owner';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly _http = inject(HttpClient);
  private readonly _router = inject(Router);
  private readonly _artistCache = inject(ArtistCacheService);
  private readonly _pageCache = inject(EpisodePageCacheService);

  private readonly _token = signal<string | null>(this._loadToken());

  public readonly user = computed(() => {
    const token = this._token();
    return token ? sessionUser(token) : null;
  });
  public readonly isLoggedIn = computed(() => this._token() !== null);
  public readonly isConfigured = GOOGLE_CLIENT_ID.length > 0;

  private _google: Promise<GoogleIdentity> | null = null;

  constructor() {
    // Signed out or switched accounts while the tracker was closed (e.g. in SpoShu):
    // don't show or keep the previous user's data.
    this._claimCaches(this.user()?.id ?? null);

    // Signing in or out in SpoShu changes the shared cookie: pick that up when the user comes back.
    window.addEventListener('focus', () => this.syncSession());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncSession();
      }
    });
  }

  /** The session token as last synced; call `syncSession()` first to pick up changes made in SpoShu. */
  public get token(): string | null {
    return this._token();
  }

  /** Renders the "Sign in with Google" button; resolves once the login succeeded. */
  public async renderGoogleButton(element: HTMLElement): Promise<void> {
    const google = await this._loadGoogle();

    return new Promise<void>((resolve, reject) => {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: ({ credential }) => this._login(credential).then(resolve, reject)
      });
      google.accounts.id.renderButton(element, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        locale: 'de'
      });
    });
  }

  public logout(): void {
    clearSessionToken();
    this._token.set(null);
    this._claimCaches(null);
    this._loadGoogle().then(google => google.accounts.id.disableAutoSelect()).catch(() => undefined);
    void this._router.navigate([ '/login' ]);
  }

  private async _login(credential: string): Promise<void> {
    const { token } = await firstValueFrom(
      this._http.post<{ token: string }>(`${API_BASE_URL}/auth/google`, { credential })
    );

    writeSessionToken(token);
    this._token.set(token);
  }

  /**
   * Follows the shared cookie: logged out elsewhere → login page; logged in elsewhere → into the app.
   * May navigate (or reload the page when another account signed in), so it is called explicitly.
   */
  public syncSession(): void {
    const token = readSessionToken();

    if (token === this._token()) {
      return;
    }

    const previousUserId = this.user()?.id ?? null;
    this._token.set(token);
    const userId = this.user()?.id ?? null;
    this._claimCaches(userId);

    const onLoginPage = this._router.url.startsWith('/login');

    if (token && previousUserId && userId !== previousUserId && !onLoginPage) {
      // Another account signed in elsewhere: start over so nothing of the previous one stays on screen.
      window.location.assign('/');
    } else if (!token && !onLoginPage) {
      void this._router.navigate([ '/login' ]);
    } else if (token && onLoginPage) {
      void this._router.navigateByUrl('/');
    }
  }

  /**
   * Cached pages hold a user's listens and library: they are deleted when the session ends
   * or belongs to someone other than the user they were written for.
   */
  private _claimCaches(userId: string | null): void {
    try {
      if (localStorage.getItem(CACHE_OWNER_KEY) === userId) {
        return;
      }

      this._pageCache.clearAll();
      this._artistCache.clear();

      if (userId) {
        localStorage.setItem(CACHE_OWNER_KEY, userId);
      } else {
        localStorage.removeItem(CACHE_OWNER_KEY);
      }
    } catch {
      // Storage unavailable: then nothing is cached either.
    }
  }

  private _loadToken(): string | null {
    const token = readSessionToken();

    if (token) {
      return token;
    }

    // One-time move of a session from the old localStorage key into the shared cookie.
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? 'null') as { token?: string } | null;
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      if (legacy?.token) {
        writeSessionToken(legacy.token);
        return readSessionToken();
      }
    } catch {
      // Storage unavailable or broken: simply log in again.
    }

    return null;
  }

  private _loadGoogle(): Promise<GoogleIdentity> {
    this._google ??= new Promise<GoogleIdentity>((resolve, reject) => {
      const existing = (window as unknown as { google?: GoogleIdentity }).google;

      if (existing?.accounts?.id) {
        resolve(existing);
        return;
      }

      const script = document.createElement('script');
      script.src = GOOGLE_SCRIPT;
      script.async = true;
      script.onload = () => resolve((window as unknown as { google: GoogleIdentity }).google);
      script.onerror = () => {
        this._google = null;
        reject(new Error('Google login could not be loaded'));
      };
      document.head.appendChild(script);
    });

    return this._google;
  }
}
