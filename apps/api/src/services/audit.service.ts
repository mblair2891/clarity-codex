import type { FastifyBaseLogger } from 'fastify';

export interface AuditEvent {
  tenantId: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  organizationId?: string | null;
  sessionId?: string | null;
  supportAccessSessionId?: string | null;
  supportMode?: boolean;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  constructor(private readonly logger: FastifyBaseLogger) {}

  record(event: AuditEvent) {
    this.logger.info({ audit: event }, 'audit-event');
    return { ok: true, event };
  }
}
