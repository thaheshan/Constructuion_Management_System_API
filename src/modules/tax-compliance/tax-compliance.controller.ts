import { Controller, Get } from '@nestjs/common';
import { TaxComplianceService } from './tax-compliance.service';

@Controller('tax-compliance')
export class TaxComplianceController {
  constructor(private taxService: TaxComplianceService) {}

  @Get('emergency-ird-report')
  getEmergencyReport() {
    return this.taxService.generateEmergencyIRDReport();
  }
}
