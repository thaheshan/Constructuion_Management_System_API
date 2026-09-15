import { Module } from '@nestjs/common';
import { TaxComplianceService } from './tax-compliance.service';
import { TaxComplianceController } from './tax-compliance.controller';

@Module({
  controllers: [TaxComplianceController],
  providers: [TaxComplianceService],
  exports: [TaxComplianceService],
})
export class TaxComplianceModule {}
