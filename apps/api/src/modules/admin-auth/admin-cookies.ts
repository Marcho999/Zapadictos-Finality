import type { CookieOptions, Response } from 'express';
import { API_PREFIX } from '../../setup-app.js';

/**
 * Cookies del panel (D-01, docs/06-seguridad.md A05/A07):
 * - zp_admin: token de acceso (15 min), solo viaja a /api/v1/admin.
 * - zp_admin_rt: refresh token (8 h), solo viaja a /api/v1/admin/auth.
 * Las dos son httpOnly, Secure y SameSite=Strict. Los navegadores aceptan
 * Secure en http://localhost, así que no hay excepción para desarrollo.
 */
export const ADMIN_ACCESS_COOKIE = 'zp_admin';
export const ADMIN_REFRESH_COOKIE = 'zp_admin_rt';

export const ADMIN_ACCESS_TTL_MS = 15 * 60 * 1000;
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const base: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' };
const accessOptions: CookieOptions = { ...base, path: `/${API_PREFIX}/admin` };
const refreshOptions: CookieOptions = { ...base, path: `/${API_PREFIX}/admin/auth` };

export function setAdminCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; sessionExpiresAt: Date },
) {
  res.cookie(ADMIN_ACCESS_COOKIE, tokens.accessToken, {
    ...accessOptions,
    maxAge: ADMIN_ACCESS_TTL_MS,
  });
  res.cookie(ADMIN_REFRESH_COOKIE, tokens.refreshToken, {
    ...refreshOptions,
    expires: tokens.sessionExpiresAt,
  });
}

export function clearAdminCookies(res: Response) {
  res.clearCookie(ADMIN_ACCESS_COOKIE, accessOptions);
  res.clearCookie(ADMIN_REFRESH_COOKIE, refreshOptions);
}
