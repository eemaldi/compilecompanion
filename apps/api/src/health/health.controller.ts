import { Controller, Get } from '@nestjs/common';

/** Liveness only: transport mapping, no business rules and no dependency checks. */
@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
