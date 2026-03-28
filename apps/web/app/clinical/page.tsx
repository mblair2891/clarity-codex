import { RoleShell } from '../../components/role-shell';
import { dashboardMetrics } from '../../lib/content';

export default function ClinicalPage() {
  return (
    <RoleShell role="clinician" title="Clinical Command Center">
      <section className="grid">
        {dashboardMetrics.clinical.map((metric) => (
          <article key={metric.label} className="card">
            <span className="muted">{metric.label}</span>
            <span className="metric">{metric.value}</span>
          </article>
        ))}
      </section>
      <section className="list" style={{ marginTop: 24 }}>
        <article className="card">
          <h2 className="sectionTitle">Integrated care coordination</h2>
          <p className="muted">Treatment planning aligns recovery goals, co-occurring condition accommodations, medications, and appointment adherence.</p>
        </article>
        <article className="card">
          <h2 className="sectionTitle">AI clinical summary support</h2>
          <p className="muted">Summaries remain assistive only, tenant-aware, role-aware, and auditable without offering diagnosis.</p>
        </article>
      </section>
    </RoleShell>
  );
}
