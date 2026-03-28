import { RoleShell } from '../../components/role-shell';

export default function AdminPage() {
  return (
    <RoleShell role="org_admin" title="Tenant Administration">
      <section className="grid">
        <article className="card">
          <span className="muted">Organizations</span>
          <span className="metric">4 active clinics</span>
        </article>
        <article className="card">
          <span className="muted">Staffing</span>
          <span className="metric">38 users</span>
        </article>
        <article className="card">
          <span className="muted">AI policies</span>
          <span className="metric">6 prompt policies</span>
        </article>
      </section>
      <section className="list" style={{ marginTop: 24 }}>
        <article className="card">
          <h2 className="sectionTitle">Governance controls</h2>
          <p className="muted">RBAC, tenant-scoped prompt registry, audit visibility, and document retention are configurable at the org level.</p>
        </article>
      </section>
    </RoleShell>
  );
}
