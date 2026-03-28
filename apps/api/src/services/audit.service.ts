import type { FastifyBaseLogger } from 'fastify';

export interface AuditEvent {
  tenantId: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  constructor(private readonly logger: FastifyBaseLogger) {}

  record(event: AuditEvent) {
    this.logger.info({ audit: event }, 'audit-event');
    return { ok: true, event };
  }
}
