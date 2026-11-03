import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:
      env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug'],
  });
  setupApp(app);
  await app.listen(env.PORT);
}
await bootstrap();
