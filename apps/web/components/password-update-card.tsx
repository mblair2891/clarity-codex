'use client';

import { FormEvent, useState } from 'react';
import { apiFetch, getApiBaseUrlState, getStoredToken } from '../lib/beta-auth';

export function PasswordUpdateCard({ mustChangePassword = false }: { mustChangePassword?: boolean }) {
  const { apiBaseUrl, error: apiBaseUrlError } = getApiBaseUrlState();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(apiBaseUrlError);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl) {
      setError(apiBaseUrlError);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      setError('Your beta session is missing. Sign in again to update your password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch(apiBaseUrl, '/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      setCurrentPassword('');
      setNewPassword('');
      setSuccess('Password updated for your beta account.');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to update password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="card">
      <h2 className="sectionTitle">Password management</h2>
      <p className="muted">
        {mustChangePassword
          ? 'Your beta account is marked for a password change. Update it here before sharing the account more broadly.'
          : 'Use this beta-safe form if you want to rotate your password after receiving a temporary credential.'}
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <input
          type="password"
          className="card"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="Current password"
        />
        <input
          type="password"
          className="card"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="New password"
        />
        <button
          type="submit"
          className="card"
          style={{ cursor: 'pointer', fontWeight: 700 }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Updating password...' : 'Update password'}
        </button>
      </form>
      {success ? <p style={{ color: '#067647', marginTop: 12 }}>{success}</p> : null}
      {error ? <p style={{ color: '#b42318', marginTop: 12 }}>{error}</p> : null}
    </article>
  );
}
