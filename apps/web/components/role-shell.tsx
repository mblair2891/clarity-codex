import type { ReactNode } from 'react';
import Link from 'next/link';
import { navigation, type AppRole } from '@clarity/domain';
import { ModeBadges } from './mode-badges';

export function RoleShell({ role, title, children }: { role: AppRole; title: string; children: ReactNode }) {
  const items = navigation.filter((item) => item.roles.includes(role));

  return (
    <main className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Clarity Bridge Health</p>
          <h1>{title}</h1>
          <p className="muted">Role-aware behavioral health platform with recovery, clinical, RCM, and AI governance workflows.</p>
        </div>
        <nav>
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="navCard">
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
