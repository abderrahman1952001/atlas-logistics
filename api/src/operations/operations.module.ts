import { Module } from '@nestjs/common';
import { OperationsService } from './operations.service.js';
import { OperationsController } from './operations.controller.js';
@Module({ controllers: [OperationsController], providers: [OperationsService] })
export class OperationsModule {}
