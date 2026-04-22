import { ApiClient } from './api-client';
import { resolveBaseUrl } from './config';
import { readStoredSession } from './session';

export async function createApiClient(baseUrlOverride?: string) {
  const storedSession = await readStoredSession();
  if (!storedSession) {
    throw new Error('No local session found. Run `parix auth login` first.');
  }

  const baseUrl = resolveBaseUrl(baseUrlOverride, storedSession);
  return {
    baseUrl,
    client: new ApiClient({
      session: {
        ...storedSession,
        baseUrl,
      },
    }),
  };
}

export async function requestApiJson<T>(input: {
  baseUrl?: string;
  body?: RequestInit['body'];
  headers?: RequestInit['headers'];
  method?: string;
  path: string;
}) {
  const { client } = await createApiClient(input.baseUrl);
  const response = await client.request(input.path, {
    body: input.body,
    headers: input.headers,
    method: input.method,
  });

  const raw = await response.text();
  const payload = raw.length > 0 ? safeParseJson(raw) : null;

  if (!response.ok) {
    const message = getApiErrorMessage(payload) ?? (raw.trim() || `${response.status} ${response.statusText}`);
    throw new Error(message);
  }

  return payload as T;
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  }
  catch {
    return value;
  }
}

function getApiErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const row = payload as {
    error?: unknown;
    message?: unknown;
  };

  if (typeof row.message === 'string' && row.message.trim().length > 0) {
    return row.message;
  }

  if (typeof row.error === 'string' && row.error.trim().length > 0) {
    return row.error;
  }

  return null;
}
