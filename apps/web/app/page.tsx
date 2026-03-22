import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: 32, display: 'grid', gap: 24 }}>
      <section className="banner">
        <p className="eyebrow">Production-grade founder stack</p>
        <h1>Clarity Bridge Health</h1>
        <p className="muted">
          Integrated recovery support, clinical operations, revenue cycle management, and safe AI workflows in one multi-tenant platform.
        </p>
        <p>
          <Link href="/login" className="card" style={{ display: 'inline-flex', marginTop: 16 }}>
            Beta sign-in
          </Link>
        </p>
      </section>
      <div className="grid">
        <Link href="/consumer" className="card">
          <strong>Consumer recovery hub</strong>
          <span>Daily check-ins, coping plans, trauma-aware workflows, and cognitive assist UX.</span>
        </Link>
        <Link href="/clinical" className="card">
          <strong>Clinical command center</strong>
          <span>Intakes, treatment plans, appointments, groups, medications, alerts, and chart summaries.</span>
        </Link>
        <Link href="/rcm" className="card">
          <strong>RCM workbench</strong>
          <span>Claims, denials, remittances, eligibility, fee schedules, and aging prioritization.</span>
        </Link>
        <Link href="/admin" className="card">
          <strong>Tenant administration</strong>
          <span>Organization settings, staffing, AI prompts, audit posture, and environment controls.</span>
        </Link>
      </div>
    </main>
  );
}
