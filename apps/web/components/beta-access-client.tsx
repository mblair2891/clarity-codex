'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  clearStoredToken,
  fetchMe,
  getApiBaseUrlState,
  getLandingPathForRole,
  getStoredToken,
  loginWithBetaAccessCode,
  loginWithPassword,
  storeToken
} from '../lib/beta-auth';

type ValidationState = 'idle' | 'validating';

export function BetaAccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [emailInput, setEmailInput] = useState('beta-admin@claritybridgehealth.com');
  const [passwordInput, setPasswordInput] = useState('');
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState<ValidationState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    const existingToken = getStoredToken();
    if (!existingToken) {
      return;
    }

    fetchMe(apiBaseUrl, existingToken)
      .then((session) => {
        router.replace(session.landingPath || getLandingPathForRole(session.user.role));
      })
      .catch(() => {
        clearStoredToken();
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

    fetchMe(apiBaseUrl, inviteToken)
      .then((session) => {
        storeToken(inviteToken);
        router.replace(session.landingPath || getLandingPathForRole(session.user.role));
      })
      .catch((validationError: unknown) => {
        setError(validationError instanceof Error ? validationError.message : 'Unable to validate this emergency access token.');
        setStatus('idle');
      });
  }, [apiBaseUrl, router, searchParams]);

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus('validating');
    setError(null);

    try {
      if (!apiBaseUrl) {
        setError(apiBaseUrlError);
        setStatus('idle');
        return;
      }

      const login = await loginWithPassword(apiBaseUrl, emailInput.trim().toLowerCase(), passwordInput.trim());
      storeToken(login.token);
      router.replace(login.landingPath || getLandingPathForRole(login.user.role));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in to the beta environment.');
      setStatus('idle');
    }
  }

  async function handleEmergencyAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus('validating');
    setError(null);

    try {
      if (!apiBaseUrl) {
        setError(apiBaseUrlError);
        setStatus('idle');
        return;
      }

      const trimmedToken = tokenInput.trim();
      if (trimmedToken) {
        const session = await fetchMe(apiBaseUrl, trimmedToken);
        storeToken(trimmedToken);
        router.replace(session.landingPath || getLandingPathForRole(session.user.role));
        return;
      }

      const trimmedAccessCode = accessCodeInput.trim();
      if (!trimmedAccessCode) {
        setError('Enter a shared beta access code or paste an emergency token.');
        setStatus('idle');
        return;
      }

      const login = await loginWithBetaAccessCode(apiBaseUrl, emailInput.trim().toLowerCase(), trimmedAccessCode);
      storeToken(login.token);
      router.replace(login.landingPath || getLandingPathForRole(login.user.role));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to use emergency beta access.');
      setStatus('idle');
    }
  }

  return (
    <section className="card" style={{ display: 'grid', gap: 20 }}>
      <div>
        <h2 className="sectionTitle">Beta account sign-in</h2>
        <p className="muted">
          Sign in with your named beta account and password. Platform admins can still use the emergency beta access flow below if needed.
        </p>
      </div>

      <form onSubmit={handlePasswordLogin} style={{ display: 'grid', gap: 12 }}>
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
        <label className="muted" htmlFor="beta-password">Password</label>
        <input
          id="beta-password"
          type="password"
          value={passwordInput}
          onChange={(event) => setPasswordInput(event.target.value)}
          className="card"
          style={{ width: '100%' }}
          placeholder="Enter your beta password"
          autoComplete="current-password"
        />
        <button
          type="submit"
          className="card"
          style={{ cursor: 'pointer', fontWeight: 700 }}
          disabled={status === 'validating' || !apiBaseUrl}
        >
          {status === 'validating' ? 'Signing in...' : 'Continue to beta'}
        </button>
      </form>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Emergency platform admin access</summary>
        <form onSubmit={handleEmergencyAccess} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <label className="muted" htmlFor="beta-access-code">Shared beta access code</label>
          <input
            id="beta-access-code"
            type="password"
            value={accessCodeInput}
            onChange={(event) => setAccessCodeInput(event.target.value)}
            className="card"
            style={{ width: '100%' }}
            placeholder="Platform admin only"
            autoComplete="one-time-code"
          />
          <label className="muted" htmlFor="beta-token">Or paste a JWT token</label>
          <textarea
            id="beta-token"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            rows={4}
            className="card"
            style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace' }}
            placeholder="Paste emergency token here"
          />
          <button
            type="submit"
            className="card"
            style={{ cursor: 'pointer', fontWeight: 700 }}
            disabled={status === 'validating' || !apiBaseUrl}
          >
            Use emergency access
          </button>
        </form>
      </details>

      {error || apiBaseUrlError ? <p style={{ color: '#b42318', margin: 0 }}>{error ?? apiBaseUrlError}</p> : null}
    </section>
  );
}
