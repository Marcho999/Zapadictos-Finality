import type { CookieOptions, Response } from 'express';
import { API_PREFIX } from '../../setup-app.js';

/**
 * Cookies de la tienda (D-01):
 * - zp_session: token de acceso (15 min); viaja a /api/v1.
 * - zp_session_rt: refresh token (7 días); solo viaja a /api/v1/auth.
 * httpOnly, Secure y SameSite=Strict, igual que las del panel, pero con otro
 * nombre y otro secreto: una nunca sirve en lugar de la otra.
 */
export const CUSTOMER_ACCESS_COOKIE = 'zp_session';
export const CUSTOMER_REFRESH_COOKIE = 'zp_session_rt';

export const CUSTOMER_ACCESS_TTL_MS = 15 * 60 * 1000;
/** Ventana deslizante: cada renovación extiende la sesión otros 7 días (D-30). */
export const CUSTOMER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const base: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' };
const accessOptions: CookieOptions = { ...base, path: `/${API_PREFIX}` };
const refreshOptions: CookieOptions = { ...base, path: `/${API_PREFIX}/auth` };

export function setCustomerCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; sessionExpiresAt: Date },
) {
  res.cookie(CUSTOMER_ACCESS_COOKIE, tokens.accessToken, { ...accessOptions, maxAge: CUSTOMER_ACCESS_TTL_MS });
  res.cookie(CUSTOMER_REFRESH_COOKIE, tokens.refreshToken, { ...refreshOptions, expires: tokens.sessionExpiresAt });
}

export function clearCustomerCookies(res: Response) {
  res.clearCookie(CUSTOMER_ACCESS_COOKIE, accessOptions);
  res.clearCookie(CUSTOMER_REFRESH_COOKIE, refreshOptions);
}
