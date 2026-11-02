import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../config';
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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly _http = inject(HttpClient);
  private readonly _router = inject(Router);

  private readonly _token = signal<string | null>(this._loadToken());

  public readonly user = computed(() => {
    const token = this._token();
    return token ? sessionUser(token) : null;
  });
  public readonly isLoggedIn = computed(() => this._token() !== null);
  public readonly isConfigured = GOOGLE_CLIENT_ID.length > 0;

  private _google: Promise<GoogleIdentity> | null = null;

  constructor() {
    // Signing in or out in SpoShu changes the shared cookie: pick that up when the user comes back.
    window.addEventListener('focus', () => this._syncWithCookie());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._syncWithCookie();
      }
    });
  }

  public get token(): string | null {
    this._syncWithCookie();
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

  /** Follows the shared cookie: logged out elsewhere → login page; logged in elsewhere → into the app. */
  private _syncWithCookie(): void {
    const token = readSessionToken();

    if (token === this._token()) {
      return;
    }

    this._token.set(token);

    const onLoginPage = this._router.url.startsWith('/login');

    if (!token && !onLoginPage) {
      void this._router.navigate([ '/login' ]);
    } else if (token && onLoginPage) {
      void this._router.navigateByUrl('/');
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
