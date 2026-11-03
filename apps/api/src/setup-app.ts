import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { loadEnv } from './config/env.js';

export const API_PREFIX = 'api/v1';

/**
 * Configuración común de la app, compartida por main.ts y las pruebas e2e,
 * para que las pruebas usen exactamente la misma configuración de seguridad.
 */
export function setupApp(app: INestApplication) {
  const express = app as NestExpressApplication;

  // La API corre detrás del proxy de Nuxt (y en producción, del de Render):
  // se confía solo en esos saltos para leer la IP real desde X-Forwarded-For
  // (docs/06-seguridad.md A05).
  express.set('trust proxy', loadEnv().TRUST_PROXY_HOPS);
  express.disable('x-powered-by');

  // La API solo devuelve JSON: la CSP más estricta posible, sin los valores
  // por defecto de helmet (pensados para páginas HTML).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    }),
  );

  // El navegador nunca habla directo con la API (D-02), así que no se
  // habilita CORS para ningún origen.

  // Solo lee cookies; no se usan cookies firmadas (los tokens ya lo están).
  app.use(cookieParser());

  // Los cuerpos JSON son pequeños: un límite bajo evita abusos.
  express.useBodyParser('json', { limit: '100kb' });

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
}
