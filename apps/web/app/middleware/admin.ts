/**
 * Protege las páginas del panel en el navegador. Es solo para la experiencia:
 * la protección real está en la API (docs/06-seguridad.md A01).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const me = await loadAdminMe();
  if (!me) {
    return navigateTo({ path: '/admin/ingresar', query: { volver: to.fullPath } });
  }
  if (me.mustChangePassword) {
    return navigateTo({ path: '/admin/ingresar', query: { paso: 'contrasena' } });
  }
});
