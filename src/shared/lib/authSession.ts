const AUTH_TOKEN_STORAGE_KEY = 'auth_token';

function getLocationHash(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hash;
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage failures and let cookie session continue working
  }
}

export function clearStoredAuthToken(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function extractAuthTokenFromHash(hash = getLocationHash()): string | null {
  const match = hash.match(/[#&]token=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function consumeAuthTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;

  const token = extractAuthTokenFromHash();
  if (!token) return null;

  setStoredAuthToken(token);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return token;
}

export function hasAuthTokenInHash(hash = getLocationHash()): boolean {
  return extractAuthTokenFromHash(hash) !== null;
}

const USE_AUTH_HEADER_KEY = 'use_auth_header';

export function isUsingAuthHeader(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(USE_AUTH_HEADER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setUseAuthHeader(use: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (use) {
      localStorage.setItem(USE_AUTH_HEADER_KEY, 'true');
    } else {
      localStorage.removeItem(USE_AUTH_HEADER_KEY);
    }
  } catch {
    // ignore storage failures
  }
}
