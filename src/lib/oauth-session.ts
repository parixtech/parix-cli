import type { OAuthTokenSet } from './oauth-api';
import type { StoredSession } from './session';
import { fetchOAuthUserInfo, refreshOAuthTokens } from './oauth-api';
import { writeStoredSession } from './session';

const REFRESH_BUFFER_MS = 60_000;

export async function createStoredSession(input: { baseUrl: string; createdAt?: string; tokenSet: OAuthTokenSet }) {
  const now = new Date();
  const [userInfo, resolvedOrganization] = await Promise.all([
    fetchOAuthUserInfo({
      accessToken: input.tokenSet.accessToken,
      baseUrl: input.baseUrl,
    }),
    fetchResolvedSessionOrganization({
      accessToken: input.tokenSet.accessToken,
      baseUrl: input.baseUrl,
    }).catch(() => null),
  ]);

  return {
    version: 2 as const,
    accessToken: input.tokenSet.accessToken,
    accessTokenExpiresAt: new Date(now.getTime() + input.tokenSet.expiresIn * 1000).toISOString(),
    baseUrl: input.baseUrl,
    createdAt: input.createdAt ?? now.toISOString(),
    refreshToken: input.tokenSet.refreshToken,
    scopes: input.tokenSet.scope,
    tokenType: input.tokenSet.tokenType,
    updatedAt: now.toISOString(),
    user: {
      email: userInfo.email ?? null,
      emailVerified: userInfo.email_verified ?? null,
      id: userInfo.sub,
      image: userInfo.picture ?? null,
      name: userInfo.name ?? null,
    },
    organization: {
      id: resolvedOrganization?.id ?? userInfo.organization_id ?? null,
      memberRole: resolvedOrganization?.memberRole ?? userInfo.member_role ?? null,
      name: resolvedOrganization?.name ?? userInfo.organization_name ?? null,
      slug: resolvedOrganization?.slug ?? userInfo.organization_slug ?? null,
    },
  } satisfies StoredSession;
}

export async function hydrateStoredSessionOrganization(session: StoredSession) {
  const resolvedOrganization = await fetchResolvedSessionOrganization({
    accessToken: session.accessToken,
    baseUrl: session.baseUrl,
  }).catch(() => null);
  if (!resolvedOrganization || organizationsEqual(session.organization, resolvedOrganization)) {
    return session;
  }

  const nextSession = {
    ...session,
    organization: resolvedOrganization,
    updatedAt: new Date().toISOString(),
  } satisfies StoredSession;

  await writeStoredSession(nextSession);
  return nextSession;
}

export async function ensureFreshSession(session: StoredSession) {
  if (!shouldRefresh(session)) {
    return session;
  }

  if (!session.refreshToken) {
    throw new Error('The local session has expired and cannot be refreshed. Run `parix auth login` again.');
  }

  const refreshedTokens = await refreshOAuthTokens({
    baseUrl: session.baseUrl,
    refreshToken: session.refreshToken,
  });

  const updatedSession = await createStoredSession({
    baseUrl: session.baseUrl,
    createdAt: session.createdAt,
    tokenSet: refreshedTokens,
  });

  await writeStoredSession(updatedSession);
  return updatedSession;
}

function shouldRefresh(session: StoredSession) {
  const expiresAt = Date.parse(session.accessTokenExpiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now() + REFRESH_BUFFER_MS;
}

async function fetchResolvedSessionOrganization(input: { accessToken: string; baseUrl: string }) {
  const response = await fetch(new URL('/api/v1/session', input.baseUrl), {
    headers: {
      authorization: `Bearer ${input.accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Unable to resolve the authenticated organization.');
  }

  const payload = (await response.json()) as {
    auth?: {
      organization?: {
        id?: unknown;
        memberRole?: unknown;
        name?: unknown;
        slug?: unknown;
      };
    };
  };
  const organization = payload.auth?.organization;
  if (!organization) {
    return null;
  }

  return {
    id: typeof organization.id === 'string' ? organization.id : null,
    memberRole: typeof organization.memberRole === 'string' ? organization.memberRole : null,
    name: typeof organization.name === 'string' ? organization.name : null,
    slug: typeof organization.slug === 'string' ? organization.slug : null,
  } satisfies StoredSession['organization'];
}

function organizationsEqual(left: StoredSession['organization'], right: StoredSession['organization']) {
  return (
    left.id === right.id && left.memberRole === right.memberRole && left.name === right.name && left.slug === right.slug
  );
}
