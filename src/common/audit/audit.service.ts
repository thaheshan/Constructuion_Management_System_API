import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  resource: string;
  details?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Records an immutable audit log entry.
   */
  async record(params: CreateAuditLogParams, tx?: any) {
    const client = tx || this.prisma;
    try {
      return await client.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          resource: params.resource,
          details: params.details || undefined,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record audit log for action "${params.action}": ${error.message}`, error.stack);
      return null;
    }
  }
}
