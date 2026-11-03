/**
 * Proxy de la API (D-02): el navegador solo habla con Nuxt, y Nuxt reenvía
 * /api/v1/** a la API de NestJS. Así las cookies son del mismo sitio y
 * SameSite=Strict funciona sin un dominio propio.
 */
export default defineEventHandler((event) => {
  const { apiOrigin } = useRuntimeConfig(event);
  const path = event.path; // incluye la query string

  // Solo se reenvía la API versionada; cualquier otra ruta /api es 404.
  if (!path.startsWith('/api/v1/') && path !== '/api/v1') {
    throw createError({ statusCode: 404, statusMessage: 'No encontrado' });
  }

  const target = new URL(path, apiOrigin).toString();
  const clientIp = getRequestIP(event, { xForwardedFor: true });

  return proxyRequest(event, target, {
    headers: {
      // La API confía en un salto de proxy para leer la IP real (A05).
      ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
      'x-forwarded-proto': getRequestProtocol(event, { xForwardedProto: true }),
    },
  });
});
