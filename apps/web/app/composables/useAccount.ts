import type { CustomerMeDto } from '@zapadictos/shared';

/** Sesión de la tienda (D-01): cookies zp_session / zp_session_rt. */
const account = createSessionClient<CustomerMeDto>({
  base: '/api/v1',
  refreshUrl: '/api/v1/auth/refresh',
  meUrl: '/api/v1/users/me',
  logoutUrl: '/api/v1/auth/logout',
  stateKey: 'customer-me',
  loginPath: '/cuenta/ingresar',
});

export const useAccountApi = () => account.api;
export const useCustomer = account.useMe;
export const loadCustomer = (force = false) => account.load(force);
export const setCustomer = account.setMe;
export const customerLogout = () => account.logout('/');

/** "Laura Gómez" → "Laura". */
export function firstName(name: string | undefined) {
  return name?.trim().split(/\s+/)[0] ?? '';
}
