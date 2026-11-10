import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { TaxComplianceModule } from './modules/tax-compliance/tax-compliance.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { RolesModule } from './modules/roles/roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    TaxComplianceModule,
    OnboardingModule,
    RolesModule,
  ],
})
export class AppModule {}