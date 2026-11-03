/**
 * Páginas de la cuenta del cliente. Solo mejora la experiencia: la protección
 * real está en la API (docs/06-seguridad.md A01).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;
  const me = await loadCustomer();
  if (!me) return navigateTo({ path: '/cuenta/ingresar', query: { volver: to.fullPath } });
});
