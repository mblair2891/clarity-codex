import { RoleShell } from '../../components/role-shell';
import { dashboardMetrics } from '../../lib/content';

export default function RcmPage() {
  return (
    <RoleShell role="billing" title="RCM Workbench">
      <section className="grid">
        {dashboardMetrics.rcm.map((metric) => (
          <article key={metric.label} className="card">
            <span className="muted">{metric.label}</span>
            <span className="metric">{metric.value}</span>
          </article>
        ))}
      </section>
      <section className="list" style={{ marginTop: 24 }}>
        <article className="card">
          <h2 className="sectionTitle">Denial prevention</h2>
          <p className="muted">Eligibility, authorization, coding quality, and AI-assisted denial pattern analysis are surfaced before claim submission.</p>
        </article>
        <article className="card">
          <h2 className="sectionTitle">Cash acceleration</h2>
          <p className="muted">Prioritized aging, payer variance, and encounter readiness reduce founder-stage revenue leakage.</p>
        </article>
      </section>
    </RoleShell>
  );
}
