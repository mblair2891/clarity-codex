'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoleShell } from './role-shell';
import {
  ApiResponseError,
  clearStoredToken,
  endSupportSession,
  fetchMe,
  getApiBaseUrlState,
  getLandingPathForSession,
  getStoredToken,
  sessionHasPlatformAuthority,
  storeToken,
  type AuthMeResponse
} from '../lib/beta-auth';

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function formatMoney(amountCents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amountCents / 100);
}

export function formatRoleLabel(value: string) {
  return value.replaceAll('_', ' ');
}

export function slugifyOrganizationName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60);
}

export function toneForSupportStatus(status: string) {
  if (status === 'active') {
    return 'success';
  }

  if (status === 'ended') {
    return 'neutral';
  }

  return 'warning';
}

export function PlatformWorkspaceShell({
  title,
  session,
  children,
  onLogout,
  onEndSupport
}: {
  title: string;
  session: AuthMeResponse | null;
  children: ReactNode;
  onLogout: () => void;
  onEndSupport: () => Promise<void>;
}) {
  return (
    <RoleShell role="platform_admin" title={title} session={session} onLogout={onLogout} onEndSupport={onEndSupport}>
      <div className="adminStack">{children}</div>
    </RoleShell>
  );
}

export function usePlatformWorkspace() {
  const router = useRouter();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [error, setError] = useState<string | null>(apiBaseUrlError);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isEndingSupport, setIsEndingSupport] = useState(false);

  async function loadSession(tokenOverride?: string) {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return null;
    }

    const token = tokenOverride ?? getStoredToken();
    if (!token) {
      router.replace('/login');
      return null;
    }

    const session = await fetchMe(apiBaseUrl, token);
    if (!sessionHasPlatformAuthority(session)) {
      router.replace(getLandingPathForSession(session));
      return null;
    }

    setMe(session);
    setError(null);
    return session;
  }

  useEffect(() => {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      setIsSessionLoading(false);
      return;
    }

    loadSession()
      .catch((loadError) => {
        if (loadError instanceof ApiResponseError && loadError.status === 401) {
          clearStoredToken();
          router.replace('/login');
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load the platform workspace right now.');
      })
      .finally(() => {
        setIsSessionLoading(false);
      });
  }, [apiBaseUrl, apiBaseUrlError, router]);

  function getTokenOrRedirect() {
    const token = getStoredToken();
    if (!token) {
      router.replace('/login');
      return null;
    }

    return token;
  }

  function handleLogout() {
    clearStoredToken();
    router.replace('/login');
  }

  function handleApiError(actionError: unknown, fallbackMessage: string) {
    if (actionError instanceof ApiResponseError && actionError.status === 401) {
      clearStoredToken();
      router.replace('/login');
      return 'Your beta session expired. Please sign in again.';
    }

    return actionError instanceof Error ? actionError.message : fallbackMessage;
  }

  async function handleEndSupport() {
    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsEndingSupport(true);
    setError(null);

    try {
      const response = await endSupportSession(apiBaseUrl, token);
      storeToken(response.token);
      const session = await fetchMe(apiBaseUrl, response.token);

      setMe(session);
      router.replace(getLandingPathForSession(session));
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to end the active support session.'));
    } finally {
      setIsEndingSupport(false);
    }
  }

  return {
    apiBaseUrl,
    apiBaseUrlError,
    router,
    me,
    setMe,
    error,
    setError,
    isSessionLoading,
    isEndingSupport,
    loadSession,
    getTokenOrRedirect,
    handleLogout,
    handleEndSupport,
    handleApiError
  };
}
