import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { OperationsService } from './operations.service.js';
import {
  BookingStatusDto,
  CompanyStatusDto,
  CreateRequestDto,
  QuoteDto,
  ReviewDto,
} from './dto.js';

@ApiCookieAuth('atlas_session')
@ApiTags('Atlas operations')
@Controller()
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Get('dashboard')
  @ApiOperation({ summary: 'Company-scoped operational totals' })
  dashboard(@Req() req: AuthenticatedRequest) {
    return this.operations.dashboard(req.user);
  }
  @Get('companies') companies(@Req() req: AuthenticatedRequest) {
    return this.operations.companies(req.user);
  }
  @Patch('companies/:id/status')
  @ApiOperation({ summary: 'Administrator verifies or suspends a company with a recorded reason' })
  companyStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: CompanyStatusDto,
  ) {
    return this.operations.companyStatus(req.user, id, data);
  }
  @Get('requests') requests(@Req() req: AuthenticatedRequest) {
    return this.operations.requests(req.user);
  }
  @Get('requests/:id') request(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.operations.request(req.user, id);
  }
  @Post('requests')
  @ApiOperation({ summary: 'Customer creates a transport request' })
  createRequest(@Req() req: AuthenticatedRequest, @Body() data: CreateRequestDto) {
    return this.operations.createRequest(req.user, data);
  }
  @Post('requests/:id/quotes')
  @ApiOperation({ summary: 'Verified provider submits one quotation per request' })
  createQuote(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: QuoteDto,
  ) {
    return this.operations.createQuote(req.user, id, data);
  }
  @Post('quotes/:id/accept')
  @ApiOperation({
    summary: 'Request owner atomically accepts one quotation and creates one booking',
  })
  accept(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.operations.acceptQuote(req.user, id);
  }
  @Get('bookings') bookings(@Req() req: AuthenticatedRequest) {
    return this.operations.bookings(req.user);
  }
  @Patch('bookings/:id/status')
  @ApiOperation({ summary: 'Role-controlled booking transition with optimistic version check' })
  bookingStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: BookingStatusDto,
  ) {
    return this.operations.bookingStatus(req.user, id, data);
  }
  @Post('bookings/:id/review')
  @ApiOperation({ summary: 'Request owner submits one review after confirmed completion' })
  review(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: ReviewDto,
  ) {
    return this.operations.review(req.user, id, data);
  }
  @Get('activity') activity(@Req() req: AuthenticatedRequest) {
    return this.operations.activity(req.user);
  }
  @Get('notifications') notifications(@Req() req: AuthenticatedRequest) {
    return this.operations.notifications(req.user);
  }
  @Patch('notifications/:id/read')
  @HttpCode(200)
  notificationRead(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.operations.readNotification(req.user, id);
  }
}
