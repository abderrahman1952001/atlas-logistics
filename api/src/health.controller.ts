import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatabaseService } from './database/database.service.js';
import { Public } from './auth/auth.guard.js';
@Public()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}
  @Get('live') live() {
    return { status: 'ok', service: 'atlas-api' };
  }
  @Get('ready') async ready() {
    try {
      await this.db.query('SELECT 1 FROM users LIMIT 1');
      return { status: 'ok', database: 'ready' };
    } catch {
      throw new ServiceUnavailableException('Database is not ready.');
    }
  }
}
