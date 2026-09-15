import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LabourModule } from './modules/labour/labour.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { TaxComplianceModule } from './modules/tax-compliance/tax-compliance.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    InventoryModule,
    LabourModule,
    PayrollModule,
    TaxComplianceModule,
  ],
})
export class AppModule {}
