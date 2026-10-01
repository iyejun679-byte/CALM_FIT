const ACCESS_TOKEN_KEY = 'calmfit_access_token';

export function getAccessToken(): string {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAccessToken(token: string): void {
  try {
    if (token.trim()) sessionStorage.setItem(ACCESS_TOKEN_KEY, token.trim());
    else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    window.dispatchEvent(new CustomEvent('calmfit_access_token_changed'));
  } catch {
    // Session storage may be unavailable in restricted browser contexts.
  }
}

export async function ensureAccessToken(): Promise<string> {
  const current = getAccessToken();
  if (current) return current;
  try {
    const response = await fetch('/api/local-setup-token', { cache: 'no-store' });
    if (!response.ok) return '';
    const payload = await response.json();
    if (typeof payload.token === 'string' && payload.token) {
      setAccessToken(payload.token);
      return payload.token;
    }
  } catch {
    // Remote deployments require a guardian-managed token.
  }
  return '';
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await ensureAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}