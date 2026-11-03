import type { AdminMeDto } from '@zapadictos/shared';

/** Sesión del panel (D-01): cookies zp_admin / zp_admin_rt. */
const admin = createSessionClient<AdminMeDto>({
  base: '/api/v1/admin',
  refreshUrl: '/api/v1/admin/auth/refresh',
  meUrl: '/api/v1/admin/auth/me',
  logoutUrl: '/api/v1/admin/auth/logout',
  stateKey: 'admin-me',
  loginPath: '/admin/ingresar',
});

export const useAdminApi = () => admin.api;
export const useAdminMe = admin.useMe;
export const loadAdminMe = () => admin.load();
export const setAdminMe = admin.setMe;
export const adminLogout = () => admin.logout();
