import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// En local, las variables salen de apps/api/.env; en CI vienen del workflow.
if (existsSync('.env')) process.loadEnvFile('.env');

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error('Define DATABASE_URL_TEST para correr las pruebas e2e');
}
if (testUrl === process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL_TEST no puede ser la misma base de desarrollo');
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testUrl,
      // Las fotos de las pruebas no se mezclan con las de desarrollo.
      UPLOADS_DIR: join(tmpdir(), 'zapadictos-test-uploads'),
      // Wompi de mentiras: llaves de prueba y un servidor falso (test/fake-wompi.ts).
      WOMPI_PUBLIC_KEY: 'pub_test_e2e',
      WOMPI_INTEGRITY_SECRET: 'e2e-integrity-secret',
      WOMPI_EVENTS_SECRET: 'e2e-events-secret',
      WOMPI_API_URL: 'http://127.0.0.1:4999/v1',
    },
    globalSetup: ['./test/global-setup.ts'],
    // Las pruebas comparten la misma base: se corren una tras otra.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
