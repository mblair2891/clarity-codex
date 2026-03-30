'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { createPlatformOrganization } from '../lib/beta-auth';
import {
  PlatformWorkspaceShell,
  slugifyOrganizationName,
  usePlatformWorkspace
} from './platform-workspace';

type OrganizationFormState = {
  name: string;
  slug: string;
  npi: string;
  taxId: string;
};

const defaultFormState: OrganizationFormState = {
  name: '',
  slug: '',
  npi: '',
  taxId: ''
};

export function PlatformOrganizationCreatePage() {
  const {
    apiBaseUrl,
    router,
    me,
    error,
    setError,
    getTokenOrRedirect,
    handleLogout,
    handleEndSupport,
    handleApiError
  } = usePlatformWorkspace();
  const [form, setForm] = useState<OrganizationFormState>(defaultFormState);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const canManageOrganizations = Boolean(me?.accessContext.platformRoles.includes('platform_admin'));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiBaseUrl) {
      setError('Platform API is unavailable.');
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await createPlatformOrganization(apiBaseUrl, token, {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        npi: form.npi.trim() || undefined,
        taxId: form.taxId.trim() || undefined
      });

      setSuccess(`Created ${response.organization.name}. Redirecting to the onboarding wizard.`);
      router.push(`/platform/organizations/${response.organization.id}/onboarding`);
    } catch (actionError) {
      setError(handleApiError(actionError, 'Unable to create this organization.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PlatformWorkspaceShell title="Create Organization" session={me} onLogout={handleLogout} onEndSupport={handleEndSupport}>
      <section className="card consumerHero adminHero">
        <div className="consumerHeroTop">
          <div>
            <p className="eyebrow">Organization creation</p>
            <h2 className="consumerHeading" style={{ marginBottom: 8 }}>
              Create a new organization
            </h2>
            <p className="muted consumerLead">
              Provision a new clinic organization from the platform control plane. Org-admin assignment can follow as a separate beta step if you do not want to combine them yet.
            </p>
          </div>
          <div className="actionRow">
            <Link href="/platform" className="secondaryButton">
              Back to Platform Home
            </Link>
          </div>
        </div>
        {error ? <div className="banner bannerError" style={{ marginBottom: 0 }}>{error}</div> : null}
        {success ? <div className="banner bannerSuccess" style={{ marginBottom: 0 }}>{success}</div> : null}
      </section>

      {!canManageOrganizations ? (
        <section className="card">
          <strong>Platform admin access required</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            Support operators can use support tools, but only a platform admin can create organizations from the SaaS control plane.
          </p>
        </section>
      ) : (
        <section className="adminPanelGrid">
          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Organization identity</h2>
                <p className="muted">These fields establish the new organization record inside Clarity.</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="consumerStack" style={{ gap: 16, marginTop: 16 }}>
              <label className="fieldLabel">
                Organization name
                <input
                  className="inputField"
                  value={form.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name,
                      slug: slugTouched ? current.slug : slugifyOrganizationName(name)
                    }));
                  }}
                  placeholder="North Harbor Recovery Clinic"
                />
              </label>
              <label className="fieldLabel">
                Slug
                <input
                  className="inputField"
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setForm((current) => ({
                      ...current,
                      slug: slugifyOrganizationName(event.target.value)
                    }));
                  }}
                  placeholder="north-harbor-recovery"
                />
              </label>
              <label className="fieldLabel">
                NPI
                <input
                  className="inputField"
                  value={form.npi}
                  onChange={(event) => setForm((current) => ({ ...current, npi: event.target.value }))}
                  placeholder="Optional NPI"
                />
              </label>
              <label className="fieldLabel">
                Tax ID
                <input
                  className="inputField"
                  value={form.taxId}
                  onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))}
                  placeholder="Optional tax ID"
                />
              </label>
              <div className="actionRow">
                <button type="submit" className="primaryButton" disabled={isSaving}>
                  {isSaving ? 'Creating Organization...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </article>

          <article className="card">
            <div className="sectionHeaderRow">
              <div>
                <h2 className="sectionTitle">Beta flow</h2>
                <p className="muted">This flow creates the organization first so the platform admin can land on the new detail page immediately.</p>
              </div>
            </div>
            <div className="timeline" style={{ marginTop: 16 }}>
              <article className="listItemCard">
                <strong>Step 1</strong>
                <span className="muted">Create the organization with name, slug, NPI, and tax ID metadata.</span>
              </article>
              <article className="listItemCard">
                <strong>Step 2</strong>
                <span className="muted">Launch the organization onboarding wizard to capture profile details and generate a plan recommendation.</span>
              </article>
              <article className="listItemCard">
                <strong>Step 3</strong>
                <span className="muted">Review the resulting subscription draft on the org detail page and assign the first org admin as a follow-up beta task.</span>
              </article>
            </div>
          </article>
        </section>
      )}
    </PlatformWorkspaceShell>
  );
}
