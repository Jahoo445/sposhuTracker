/**
 * The login session is shared by SpoShu (sposhu.ch) and the Hörspiel-Checker (tracker.sposhu.ch):
 * both keep the backend's session token in one cookie on ".sposhu.ch", so signing in or out
 * in one app does the same in the other. Locally (localhost, any port) the cookie is shared too.
 * Keep this file identical in both projects.
 */

export type SessionUser = { id: string; email: string; name: string; picture: string };

const COOKIE_NAME = 'sposhu_session';
const SHARED_DOMAIN = 'sposhu.ch';

function cookieAttributes(maxAgeSeconds: number): string {
  const { hostname, protocol } = location;
  const onSharedDomain = hostname === SHARED_DOMAIN || hostname.endsWith(`.${SHARED_DOMAIN}`);

  return [
    'path=/',
    `max-age=${maxAgeSeconds}`,
    'SameSite=Lax',
    protocol === 'https:' ? 'Secure' : '',
    onSharedDomain ? `domain=.${SHARED_DOMAIN}` : ''
  ].filter(Boolean).join('; ');
}

/** The token's payload is readable (only its signature is secret): user and expiry, or null. */
function readPayload(token: string): (SessionUser & { exp: number }) | null {
  try {
    const base64 = token.split('.')[ 0 ].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));

    return typeof payload?.id === 'string' && typeof payload?.exp === 'number' ? payload : null;
  } catch {
    return null;
  }
}

/** The current, not yet expired session token, or null. */
export function readSessionToken(): string | null {
  const match = document.cookie.split('; ').find(part => part.startsWith(`${COOKIE_NAME}=`));
  const token = match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : null;
  const payload = token ? readPayload(token) : null;

  return token && payload && payload.exp > Date.now() ? token : null;
}

export function sessionUser(token: string): SessionUser | null {
  const payload = readPayload(token);
  return payload ? { id: payload.id, email: payload.email, name: payload.name, picture: payload.picture } : null;
}

export function writeSessionToken(token: string): void {
  const payload = readPayload(token);
  const maxAge = payload ? Math.max(0, Math.floor((payload.exp - Date.now()) / 1000)) : 0;

  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttributes(maxAge)}`;
}

export function clearSessionToken(): void {
  document.cookie = `${COOKIE_NAME}=; ${cookieAttributes(0)}`;
}
