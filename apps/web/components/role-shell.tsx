'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation, type AppRole } from '@clarity/domain';
import { ModeBadges } from './mode-badges';

export function RoleShell({ role, title, children }: { role: AppRole; title: string; children: ReactNode }) {
  const pathname = usePathname();
  const items = navigation.filter((item) => item.roles.includes(role));

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
          </div>
        </div>
        <nav>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`navCard${pathname === item.href || pathname.startsWith(`${item.href}/`) ? ' navCardActive' : ''}`}
              aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'page' : undefined}
            >
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </Link>
          ))}
        </nav>
        <ModeBadges />
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}
