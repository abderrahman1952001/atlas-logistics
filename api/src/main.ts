import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import { json } from 'express';
import type { NextFunction, Response } from 'express';
import { AppModule } from './app.module.js';
import { ErrorFilter } from './error.filter.js';
import type { AuthenticatedRequest } from './auth/auth.types.js';

async function bootstrap() {
  const origin = process.env.APP_ORIGIN || 'http://localhost:8080';
  const parsed = new URL(origin);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin)
    throw new Error('APP_ORIGIN must be a single HTTP(S) origin without a trailing slash.');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (
    process.env.NODE_ENV === 'production' &&
    parsed.protocol !== 'https:' &&
    !(loopback && process.env.DEMO_MODE === 'true')
  )
    throw new Error(
      'Production APP_ORIGIN requires HTTPS. Only an explicitly enabled local demo may use loopback HTTP.',
    );
  if (process.env.COOKIE_SECURE === 'false' && !(loopback && process.env.DEMO_MODE === 'true'))
    throw new Error('Insecure cookies are permitted only for an explicitly enabled local demo.');
  const proxyHops = process.env.TRUST_PROXY_HOPS || '0';
  if (!['0', '1'].includes(proxyHops)) throw new Error('TRUST_PROXY_HOPS must be 0 or 1.');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Enable only behind one controlled proxy that overwrites X-Forwarded-For.
  // Direct access must remain blocked there; the default ignores forwarded IPs.
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', proxyHops === '1' ? 1 : false);
  app.enableShutdownHooks();
  app.use(json({ limit: '32kb' }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
    }),
  );
  app.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new ErrorFilter());
  const swagger = new DocumentBuilder()
    .setTitle('Atlas Operations API')
    .setDescription(
      'Company-scoped transport requests, quotations and bookings. Synthetic demonstration; fixed-role cookie sessions and CSRF-protected writes. Lists return at most 200 records, activity/notifications at most 100.',
    )
    .setVersion('1.0.0')
    .addCookieAuth('atlas_session', { type: 'apiKey', in: 'cookie' }, 'atlas_session')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-CSRF-Token' }, 'csrf')
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: false },
  });
  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
bootstrap().catch(() => {
  console.error('Atlas API startup failed. Check configuration and database availability.');
  process.exitCode = 1;
});
