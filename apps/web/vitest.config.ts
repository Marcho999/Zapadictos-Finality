import { defineVitestConfig } from '@nuxt/test-utils/config';

// Node 26 expone su propio localStorage/sessionStorage experimental en el
// proceso, que tapa el que arma happy-dom para las pruebas. Se desactiva
// antes de que Vitest arranque los procesos donde corren los archivos de
// prueba, para que hereden esta variable.
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --no-experimental-webstorage`.trim();

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['test/**/*.spec.ts'],
  },
});
