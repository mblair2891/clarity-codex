'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveApiBaseUrl } from '../lib/api-base-url';

const tokenStorageKey = 'clarity.beta.token';

type ValidationState = 'idle' | 'validating';
type LoginMode = 'credentials' | 'token';

type BetaLoginResponse = {
  token: string;
  user: {
    email: string;
    fullName: string;
    role: string;
  };
  tenant: {
    slug: string;
    name: string;
  };
};

async function validateToken(apiBaseUrl: string, token: string) {
  const response = await fetch(`${apiBaseUrl}/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('This beta access link is invalid or expired.');
  }

  return response.json();
}

async function exchangeBetaCredentials(apiBaseUrl: string, email: string, accessCode: string): Promise<BetaLoginResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/beta-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      accessCode
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Unable to sign in to the beta environment.');
  }

  return response.json();
}

export function BetaAccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiBaseUrl = resolveApiBaseUrl();
  const apiBaseUrlError = apiBaseUrl
    ? null
    : 'Beta sign-in is unavailable from this hostname. Open the beta app URL directly.';
  const [emailInput, setEmailInput] = useState('beta-admin@claritybridgehealth.com');
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [mode, setMode] = useState<LoginMode>('credentials');
  const [status, setStatus] = useState<ValidationState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    const existingToken = window.localStorage.getItem(tokenStorageKey);
    if (!existingToken) {
      return;
    }

    validateToken(apiBaseUrl, existingToken)
      .then(() => {
        router.replace('/admin');
      })
      .catch(() => {
        window.localStorage.removeItem(tokenStorageKey);
      });
  }, [apiBaseUrl, router]);

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    const inviteToken = searchParams.get('token');
    if (!inviteToken) {
      return;
    }

    setStatus('validating');
    setError(null);

    validateToken(apiBaseUrl, inviteToken)
      .then(() => {
        window.localStorage.setItem(tokenStorageKey, inviteToken);
        router.replace('/admin');
      })
      .catch((validationError: unknown) => {
        setError(validationError instanceof Error ? validationError.message : 'Unable to validate this beta access link.');
        setStatus('idle');
      });
  }, [apiBaseUrl, router, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus('validating');
    setError(null);

    try {
      if (!apiBaseUrl) {
        setError(apiBaseUrlError);
        setStatus('idle');
        return;
      }

      if (mode === 'credentials') {
        const trimmedEmail = emailInput.trim().toLowerCase();
        const trimmedAccessCode = accessCodeInput.trim();

        if (!trimmedEmail || !trimmedAccessCode) {
          setError('Enter your beta email and access code to continue.');
          setStatus('idle');
          return;
        }

        const login = await exchangeBetaCredentials(apiBaseUrl, trimmedEmail, trimmedAccessCode);
        window.localStorage.setItem(tokenStorageKey, login.token);
        router.replace('/admin');
        return;
      }

      const trimmedToken = tokenInput.trim();
      if (!trimmedToken) {
        setError('Paste your beta access token to continue.');
        setStatus('idle');
        return;
      }

      await validateToken(apiBaseUrl, trimmedToken);
      window.localStorage.setItem(tokenStorageKey, trimmedToken);
      router.replace('/admin');
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Unable to validate your beta sign-in.');
      setStatus('idle');
    }
  }

  return (
    <section className="card" style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 className="sectionTitle">Closed beta sign-in</h2>
        <p className="muted">
          Sign in with your seeded beta email and shared beta access code. Existing invite links with a `token` parameter still work.
        </p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="card"
            style={{ cursor: 'pointer', fontWeight: 700, flex: '1 1 220px', borderColor: mode === 'credentials' ? 'var(--accent)' : undefined }}
            onClick={() => {
              setMode('credentials');
              setError(null);
            }}
          >
            Email + access code
          </button>
          <button
            type="button"
            className="card"
            style={{ cursor: 'pointer', fontWeight: 700, flex: '1 1 220px', borderColor: mode === 'token' ? 'var(--accent)' : undefined }}
            onClick={() => {
              setMode('token');
              setError(null);
            }}
          >
            Paste existing token
          </button>
        </div>
        {mode === 'credentials' ? (
          <>
            <label className="muted" htmlFor="beta-email">Beta email</label>
            <input
              id="beta-email"
              type="email"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              className="card"
              style={{ width: '100%' }}
              placeholder="beta-admin@claritybridgehealth.com"
              autoComplete="email"
            />
            <label className="muted" htmlFor="beta-access-code">Beta access code</label>
            <input
              id="beta-access-code"
              type="password"
              value={accessCodeInput}
              onChange={(event) => setAccessCodeInput(event.target.value)}
              className="card"
              style={{ width: '100%' }}
              placeholder="Enter shared beta access code"
              autoComplete="current-password"
            />
          </>
        ) : (
          <>
            <label className="muted" htmlFor="beta-token">Beta access token</label>
            <textarea
              id="beta-token"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              rows={4}
              className="card"
              style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace' }}
              placeholder="Paste token here"
            />
          </>
        )}
        <button
          type="submit"
          className="card"
          style={{ cursor: 'pointer', fontWeight: 700 }}
          disabled={status === 'validating' || !apiBaseUrl}
        >
          {status === 'validating' ? 'Signing in...' : 'Continue to beta'}
        </button>
      </form>
      {error || apiBaseUrlError ? <p style={{ color: '#b42318', margin: 0 }}>{error ?? apiBaseUrlError}</p> : null}
    </section>
  );
}
