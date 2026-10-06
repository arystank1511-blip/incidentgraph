import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';
import type { Server } from 'node:http';
import { ApiController } from './controller';
import { Storage } from './storage';
import { IncidentService } from './incident-service';
import { SessionGuard } from './auth';
import { config } from './config';
import { ReadCache } from './cache';
import { InProcessEventProcessor } from './event-processor';
import { securityMiddleware, SafeExceptionFilter } from './security';
@Module({
  controllers: [ApiController],
  providers: [
    Storage,
    IncidentService,
    SessionGuard,
    ReadCache,
    InProcessEventProcessor,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
class AppModule {}
export async function createApplication() {
  const app = await NestFactory.create(AppModule, { bodyParser: false, abortOnError: false });
  app.use(helmet(), cookieParser(), securityMiddleware(), express.json({ limit: '256kb' }));
  app.enableCors({
    origin: config.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'X-IncidentGraph-Request'],
  });
  app.useGlobalFilters(new SafeExceptionFilter());
  const server = app.getHttpServer() as Server;
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 100;
  server.maxConnections = 1000;
  app.enableShutdownHooks();
  return app;
}
if (require.main === module) {
  void createApplication()
    .then((app) => app.listen(config.PORT, config.HOST))
    .catch(() => {
      console.error('API startup failed. Check local configuration and database availability.');
      process.exitCode = 1;
    });
}
