import type { NitroFetchOptions } from 'nitropack';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface SessionConfig {
  /** Prefijo de las rutas: '/api/v1/admin' o '/api/v1'. */
  base: string;
  refreshUrl: string;
  meUrl: string;
  logoutUrl: string;
  /** Clave de useState donde vive el usuario en sesión. */
  stateKey: string;
  loginPath: string;
}

/**
 * Cliente para un tipo de sesión (panel o tienda). Las cookies son httpOnly:
 * el código nunca ve los tokens, solo sabe si hay sesión.
 *
 * Si una petición recibe 401 porque venció el token de acceso, renueva la
 * sesión UNA sola vez aunque fallen varias peticiones a la vez y repite la
 * petición. Si dos llamadas usaran el mismo refresh token, la API lo tomaría
 * como robado y cerraría la sesión (detección de reutilización).
 */
export function createSessionClient<Me>(config: SessionConfig) {
  let refreshing: Promise<boolean> | null = null;
  const useMe = () => useState<Me | null>(config.stateKey, () => null);
  const useLoaded = () => useState<boolean>(`${config.stateKey}:loaded`, () => false);

  function refresh(): Promise<boolean> {
    refreshing ??= $fetch<Me>(config.refreshUrl, { method: 'POST' })
      .then((me) => {
        useMe().value = me;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  async function call<T>(path: string, options: NitroFetchOptions<string> & { method?: Method } = {}): Promise<T> {
    const url = `${config.base}${path}`;
    try {
      return (await $fetch(url, options as object)) as T;
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 401) throw error;
      if (await refresh()) return (await $fetch(url, options as object)) as T;
      useMe().value = null;
      await navigateTo({ path: config.loginPath, query: { volver: useRoute().fullPath } });
      throw error;
    }
  }

  /** Consulta quién está en sesión (solo en el navegador, D-03). */
  async function load(force = false): Promise<Me | null> {
    const me = useMe();
    const loaded = useLoaded();
    if (import.meta.server) return null;
    if (loaded.value && !force) return me.value;
    try {
      me.value = await $fetch<Me>(config.meUrl);
    } catch {
      me.value = (await refresh()) ? useMe().value : null;
    }
    loaded.value = true;
    return me.value;
  }

  async function logout(redirectTo = config.loginPath) {
    await $fetch(config.logoutUrl, { method: 'POST' }).catch(() => undefined);
    useMe().value = null;
    await navigateTo(redirectTo);
  }

  function setMe(me: Me | null) {
    useMe().value = me;
    useLoaded().value = true;
  }

  const api = {
    get: <T>(path: string, query?: Record<string, unknown>) => call<T>(path, { query }),
    post: <T>(path: string, body?: unknown) => call<T>(path, { method: 'POST', body: body as object }),
    patch: <T>(path: string, body: unknown) => call<T>(path, { method: 'PATCH', body: body as object }),
    del: <T>(path: string) => call<T>(path, { method: 'DELETE' }),
    upload: <T>(path: string, form: FormData) => call<T>(path, { method: 'POST', body: form }),
  };

  return { api, useMe, load, logout, setMe };
}

/** Solo se vuelve a rutas internas (evita redirecciones abiertas). */
export function safeRedirect(target: unknown, prefix: string, fallback: string): string {
  if (typeof target !== 'string' || !target.startsWith(prefix) || target.startsWith('//') || target.includes('\\')) {
    return fallback;
  }
  return target;
}
