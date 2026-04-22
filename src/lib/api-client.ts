import type { StoredSession } from './session';
import { ensureFreshSession } from './oauth-session';

const TRAILING_SLASHES_REGEX = /\/+$/;

interface ApiClientOptions {
  session: StoredSession;
}

export class ApiClient {
  private session: StoredSession;

  constructor(options: ApiClientOptions) {
    this.session = options.session;
  }

  async request(pathname: string, init: RequestInit = {}) {
    this.session = await ensureFreshSession(this.session);

    const url = toRequestUrl(pathname, this.session.baseUrl);
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${this.session.accessToken}`);

    const response = await fetch(url, {
      ...init,
      headers,
    });

    if (response.status !== 401) {
      return response;
    }

    this.session = await ensureFreshSession({
      ...this.session,
      accessTokenExpiresAt: new Date(0).toISOString(),
    });

    const retryHeaders = new Headers(init.headers);
    retryHeaders.set('authorization', `Bearer ${this.session.accessToken}`);

    return fetch(url, {
      ...init,
      headers: retryHeaders,
    });
  }
}

function toRequestUrl(pathname: string, baseUrl: string) {
  if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
    return pathname;
  }
  return new URL(pathname, `${trimTrailingSlash(baseUrl)}/`).toString();
}

function trimTrailingSlash(value: string) {
  return value.replace(TRAILING_SLASHES_REGEX, '');
}
