import { RoleShell } from '../../components/role-shell';
import { dashboardMetrics } from '../../lib/content';

export default function ConsumerPage() {
  return (
    <RoleShell role="consumer" title="Recovery Hub">
      <div className="banner">
        <strong>Trauma-informed and cognitive assist defaults are enabled for this member profile.</strong>
        <p className="muted">The interface prioritizes calm language, simplified task framing, and support-contact visibility.</p>
      </div>
      <section className="grid">
        {dashboardMetrics.consumer.map((metric) => (
          <article key={metric.label} className="card">
            <span className="muted">{metric.label}</span>
            <span className="metric">{metric.value}</span>
          </article>
        ))}
      </section>
      <section className="list" style={{ marginTop: 24 }}>
        <article className="card">
          <h2 className="sectionTitle">Today&apos;s recovery plan</h2>
          <ul>
            <li>Complete morning check-in and gratitude reflection.</li>
            <li>Review grounding steps for trauma trigger management.</li>
            <li>Tap one support contact before evening cravings window.</li>
          </ul>
        </article>
        <article className="card">
          <h2 className="sectionTitle">Condition-aware supports</h2>
          <p className="muted">PTSD and insomnia accommodations influence prompt timing, content tone, and pacing of task lists.</p>
        </article>
      </section>
    </RoleShell>
  );
}
