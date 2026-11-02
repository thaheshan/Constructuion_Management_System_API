import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Connected to PostgreSQL database');
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Database connection failed (${error.code || 'P1000'}): ${error.message || error}. Please update DATABASE_URL in .env with your PostgreSQL password. The API will run with fallback mock data.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
