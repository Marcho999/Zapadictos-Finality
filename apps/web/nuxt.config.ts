import tailwindcss from '@tailwindcss/vite';

// Páginas privadas: se renderizan solo en el cliente (D-03).
const clientOnly = { ssr: false } as const;

// Encabezados de seguridad para todas las páginas (docs/06-seguridad.md A05).
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Permite el widget de Wompi (D-10), Cloudinary y Google Fonts; el resto
  // queda en 'self'. 'unsafe-inline' en script-src es necesario porque Nuxt
  // inyecta el payload de hidratación (window.__NUXT__) como script inline y
  // el proyecto no usa un módulo con nonces (nuxt-security); connect-src
  // admite ws:/wss: para no romper el HMR de Vite en desarrollo. Las llamadas
  // que el widget hace a los servidores de Wompi ocurren dentro de su propio
  // iframe, con el CSP de Wompi, así que connect-src no necesita ese dominio.
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' https://checkout.wompi.co",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://res.cloudinary.com",
    "connect-src 'self' ws: wss:",
    "frame-src https://checkout.wompi.co",
  ].join('; '),
};

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },

  // Los componentes se usan por su nombre de archivo (ProductCard, UiButton),
  // sin anteponer la carpeta (store/, ui/, admin/).
  components: [{ path: '~/components', pathPrefix: false }],

  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      htmlAttrs: { lang: 'es-CO' },
      title: 'Zapadictos',
      titleTemplate: '%s · Zapadictos',
      meta: [
        {
          name: 'description',
          content:
            'Tienda de zapatillas: filtra por marca, talla y precio, paga seguro y recibe en toda Colombia.',
        },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=DM+Sans:opsz,wght@9..40,400..700&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    // Solo en el servidor de Nuxt: el navegador nunca conoce la URL de la API.
    // Se sobrescribe con NUXT_API_ORIGIN.
    apiOrigin: 'http://localhost:4000',
  },

  routeRules: {
    '/**': { headers: securityHeaders },
    '/cuenta/**': clientOnly,
    '/checkout': clientOnly,
    '/pedido/**': clientOnly,
    '/admin/**': clientOnly,
  },

  typescript: {
    strict: true,
  },
});
