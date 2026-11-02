import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from '../config';

export type User = { id: string; email: string; name: string; picture: string };

type Session = { token: string; user: User };

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, unknown>): void;
      disableAutoSelect(): void;
    };
  };
};

const STORAGE_KEY = 'sposhu.session';
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly _http = inject(HttpClient);
  private readonly _router = inject(Router);

  private readonly _session = signal<Session | null>(this._loadSession());

  public readonly user = computed(() => this._session()?.user ?? null);
  public readonly isLoggedIn = computed(() => this._session() !== null);
  public readonly isConfigured = GOOGLE_CLIENT_ID.length > 0;

  private _google: Promise<GoogleIdentity> | null = null;

  public get token(): string | null {
    const session = this._session();

    if (session && this._isExpired(session.token)) {
      this.logout();
      return null;
    }

    return session?.token ?? null;
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: the session only lived in memory.
    }

    this._session.set(null);
    this._loadGoogle().then(google => google.accounts.id.disableAutoSelect()).catch(() => undefined);
    void this._router.navigate([ '/login' ]);
  }

  private async _login(credential: string): Promise<void> {
    const session = await firstValueFrom(
      this._http.post<Session>(`${API_BASE_URL}/auth/google`, { credential })
    );

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable: stay logged in for this tab only.
    }

    this._session.set(session);
  }

  private _loadSession(): Session | null {
    try {
      const session = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Session | null;
      return session?.token && !this._isExpired(session.token) ? session : null;
    } catch {
      return null;
    }
  }

  /** The token's expiry is readable (only its signature is secret), so we drop old sessions early. */
  private _isExpired(token: string): boolean {
    try {
      const payload = token.split('.')[ 0 ].replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(payload)) as { exp?: number };
      return !(typeof exp === 'number' && exp > Date.now());
    } catch {
      return true;
    }
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
