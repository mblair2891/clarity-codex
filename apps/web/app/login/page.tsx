import { Suspense } from 'react';
import { BetaAccessClient } from '../../components/beta-access-client';

export default function LoginPage() {
  return (
    <main style={{ padding: 32, display: 'grid', gap: 24 }}>
      <section className="banner">
        <p className="eyebrow">Closed beta access</p>
        <h1>Clarity Bridge Health</h1>
        <p className="muted">
          Beta users sign in against the live beta API and receive a short-lived tenant-scoped JWT for the seeded workspace.
        </p>
      </section>
      <Suspense fallback={<section className="card">Preparing beta access...</section>}>
        <BetaAccessClient />
      </Suspense>
    </main>
  );
}
