import { Suspense } from 'react';
import { BetaAccessClient } from '../../components/beta-access-client';

export default function LoginPage() {
  return (
    <main style={{ padding: 32, display: 'grid', gap: 24 }}>
      <section className="banner">
        <p className="eyebrow">Closed beta accounts</p>
        <h1>Clarity Bridge Health</h1>
        <p className="muted">
          Beta users now sign in with named accounts backed by the live beta API, tenant-scoped roles, and JWT sessions.
        </p>
      </section>
      <Suspense fallback={<section className="card">Preparing beta access...</section>}>
        <BetaAccessClient />
      </Suspense>
    </main>
  );
}
