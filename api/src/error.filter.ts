import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from './auth/auth.types.js';
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('RequestError');
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<AuthenticatedRequest>();
    let status = 500;
    let message: string | string[] = 'The operation could not be completed. Please try again.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const response = error.getResponse();
      message =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] }).message || error.message;
    } else {
      const code = (error as { code?: string })?.code;
      const parserType = (error as { type?: string })?.type;
      if (parserType === 'entity.parse.failed') {
        status = 400;
        message = 'The request body must be valid JSON.';
      } else if (parserType === 'entity.too.large') {
        status = 413;
        message = 'The request body exceeds the 32 KB limit.';
      } else if (code === '23505') {
        status = 409;
        message =
          'This record already exists or another request completed first. Refresh and try again.';
      } else if (['23503', '23514', '22007', '22008', '22003', '22P02'].includes(code || '')) {
        status = 400;
        message = 'The submitted values do not satisfy the data rules.';
      } else if (['40001', '40P01', '55P03'].includes(code || '')) {
        status = 409;
        message = 'The record is being changed by another request. Refresh and try again.';
      } else
        this.logger.error(`Request ${req.requestId || 'unknown'} failed (${code || 'internal'}).`);
    }
    res.status(status).json({ statusCode: status, message, requestId: req.requestId });
  }
}
