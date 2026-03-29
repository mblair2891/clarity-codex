'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation, type AppRole } from '@clarity/domain';
import { ModeBadges } from './mode-badges';
import type { AuthMeResponse } from '../lib/beta-auth';
import { getShellRoleForSession, sessionIsPlatformMode, sessionIsSupportMode } from '../lib/beta-auth';

function buildContextLabel(session: AuthMeResponse) {
  if (sessionIsPlatformMode(session)) {
    return 'Platform Mode';
  }

  if (sessionIsSupportMode(session)) {
    return `Supporting: ${session.organization?.name ?? 'Selected organization'}`;
  }

  if (session.organization?.name) {
    return `Organization: ${session.organization.name}`;
  }

  return 'Authenticated Session';
}

function buildContextDetail(session: AuthMeResponse) {
  const parts = [];

  if (session.location?.name) {
    parts.push(`Location: ${session.location.name}`);
  }

  if (sessionIsSupportMode(session) && session.supportSession?.ticketReference) {
    parts.push(`Ticket: ${session.supportSession.ticketReference}`);
  }

  if (!parts.length) {
    parts.push(session.tenant.name);
  }

  return parts.join(' • ');
}

export function RoleShell({
  role,
  title,
  children,
  session,
  onLogout,
  onEndSupport
}: {
  role: AppRole;
  title: string;
  children: ReactNode;
  session?: AuthMeResponse | null;
  onLogout?: () => void;
  onEndSupport?: () => void;
}) {
  const pathname = usePathname();
  const shellRole = session ? getShellRoleForSession(session) : role;
  const items = navigation.filter((item) => item.roles.includes(shellRole));
  const activeHref =
    items
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((left, right) => right.href.length - left.href.length)[0]?.href ?? null;
  const isSupportMode = Boolean(session && sessionIsSupportMode(session));
  const isPlatformMode = Boolean(session && sessionIsPlatformMode(session));

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Clarity Bridge Health</p>
          <h1>{title}</h1>
          <p className="muted">Role-aware behavioral health platform with recovery, clinical, RCM, and AI governance workflows.</p>
          <div className="pillRow">
            <span className="statusPill neutral">Current workspace</span>
            <span className="statusPill focus">{title}</span>
            {isPlatformMode ? <span className="statusPill success">Platform</span> : null}
            {isSupportMode ? <span className="statusPill warning">Support mode</span> : null}
          </div>
        </div>
        <nav>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`navCard${activeHref === item.href ? ' navCardActive' : ''}`}
              aria-current={activeHref === item.href ? 'page' : undefined}
            >
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </Link>
          ))}
        </nav>
        <ModeBadges />
      </aside>
      <section className="content">
        {session ? (
          <section className={`contextBanner${isSupportMode ? ' contextBannerSupport' : ''}`}>
            <div>
              <p className="eyebrow" style={{ marginTop: 0, marginBottom: 8 }}>
                {session.accessContext.type === 'SUPPORT' ? 'Active support session' : 'Current access context'}
              </p>
              <strong>{buildContextLabel(session)}</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                {buildContextDetail(session)}
              </p>
            </div>
            <div className="contextBannerActions">
              {isSupportMode && onEndSupport ? (
                <button type="button" className="secondaryButton" onClick={onEndSupport}>
                  End Support Session
                </button>
              ) : null}
              {onLogout ? (
                <button type="button" className="secondaryButton" onClick={onLogout}>
                  Log out
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
        {children}
      </section>
    </main>
  );
}
