# 02 · Arquitectura

## Stack

Todo el proyecto está en TypeScript.

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | Nuxt (Vue 3 + TypeScript) | SSR para que Google indexe el catálogo y la primera carga sea rápida |
| Estado y estilos | Pinia + Tailwind CSS | Pinia ya es conocido; Tailwind acelera llevar los mockups a código |
| Formularios | VeeValidate + Zod | Validación en el cliente con mensajes en español; los mismos esquemas validan en la API (D-21) |
| Backend | NestJS | Módulos por dominio, con guards y pipes de validación incluidos |
| Base de datos | PostgreSQL | Relacional y con transacciones, clave para no vender dos veces la misma talla |
| ORM | Prisma | Esquema legible, migraciones, tipos automáticos y consultas parametrizadas |
| Autenticación | JWT en cookies httpOnly + argon2id | El token no es accesible desde JavaScript; argon2id es el hash recomendado por OWASP |
| Tareas programadas | `@nestjs/schedule` | Para cancelar pedidos vencidos y devolver su stock |
| Pagos | Wompi (sandbox), con su widget | Pasarela colombiana; los datos de tarjeta nunca pasan por nuestro servidor |
| Imágenes | Cloudinary | Guarda y optimiza las fotos; el plan gratuito alcanza |
| Pruebas | Vitest + `@nuxt/test-utils` (web), Vitest + Supertest (API) | Las herramientas por defecto de cada framework; Nest 12 ya trae Vitest (D-23) |
| Lint | oxlint | Lo trae Nest 12; es rápido y entiende TypeScript |
| Runtime | Node.js 26 LTS + pnpm 12 | La versión LTS vigente; pnpm 12 protege contra paquetes recién publicados (D-24) |
| Infraestructura | Docker Compose, GitHub Actions, Vercel, Render, Neon | Entorno local reproducible, CI en cada push y despliegue gratuito |

## Piezas

```
Navegador ──► Nuxt (Vercel) ──/api/** proxy──► API NestJS (Render) ──► PostgreSQL (Neon)
                                                     │  ▲                   
                                                     │  └── webhook firmado ── Wompi
                                                     └──► Cloudinary (fotos, CDN)
Navegador ──► Widget Wompi (tarjeta / PSE; nunca toca nuestro servidor)
```

- **El navegador solo habla con Nuxt.** Las llamadas a `/api/**` las reenvía el servidor de Nuxt (Nitro, con `routeRules` y `proxy`) a la API en Render. Así las cookies son del mismo sitio y `SameSite=Strict` funciona sin necesidad de un dominio propio (D-02).
- **El pedido solo pasa a "pagado" cuando Wompi lo confirma**, ya sea por webhook firmado o porque la API consulta a Wompi de servidor a servidor. Nunca por lo que diga el navegador.
- **Las fotos de producto** las sube la API a Cloudinary, y el navegador las descarga del CDN de Cloudinary.

### Qué se renderiza en el servidor y qué no (D-03)

| Tipo de página | Renderizado | Datos de sesión |
|---|---|---|
| Públicas (`/`, `/tienda`, `/producto/*`, `/carrito`, `/envios`, `/contacto`) | SSR | Ninguno. El encabezado consulta la sesión desde el cliente después de cargar |
| Privadas (`/cuenta/**`, `/checkout`, `/pedido/*`, `/admin/**`) | Solo en el cliente (`ssr: false`) | Se consultan después de cargar |

La razón es que con `SameSite=Strict` el navegador **no envía la cookie** en la primera carga cuando se llega desde otro sitio (Google, o Wompi al volver del pago). Si el SSR dependiera de la sesión, el usuario vería la página como si no hubiera iniciado sesión. Con esta división, además, el servidor de Nuxt nunca tiene que reenviar cookies durante el SSR.

## Monorepo

```
zapadictos/
├── apps/
│   ├── web/                      # Nuxt
│   │   ├── pages/                # tienda, cuenta, admin
│   │   ├── components/           # ui/ (sistema visual), store/, admin/
│   │   ├── stores/               # Pinia: carrito, sesión del cliente, sesión del admin
│   │   ├── composables/          # llamadas a la API
│   │   └── server/               # solo configuración del proxy
│   └── api/                      # NestJS
│       ├── src/modules/          # auth, customers, catalog, offers, cart, orders,
│       │                         # payments, admin-auth, admin, audit, banner
│       ├── src/common/           # guards, pipes, filtros de errores, decoradores
│       └── prisma/               # schema.prisma, migraciones, seed
├── packages/
│   └── shared/                   # esquemas Zod y tipos compartidos entre web y api
├── docs/                         # esta documentación
├── docker-compose.yml            # PostgreSQL local
├── .github/workflows/            # CI
└── pnpm-workspace.yaml
```

`packages/shared` es nuevo respecto a la guía. Permite definir una sola vez las reglas de validación, como la contraseña de mínimo 8 caracteres o el formato del teléfono, y usarlas en el frontend y en la API.

## Entornos

| Entorno | Web | API | Base de datos | Wompi |
|---|---|---|---|---|
| Local | `localhost:3000` | `localhost:4000` | PostgreSQL en Docker | Sandbox, con webhook por túnel (`cloudflared`) |
| Producción (demo) | Vercel | Render (plan gratuito) | Neon | Sandbox |

- El plan gratuito de Render apaga la API cuando no se usa, y tarda unos 50 segundos en volver a arrancar. **Hay que despertarla antes de la presentación.**
- Los secretos se guardan solo en variables de entorno. En el repositorio solo va `.env.example`.

## Convenciones

- **Código** (modelos Prisma, variables, rutas de la API, nombres de archivos): en inglés.
- **Interfaz, URLs de la tienda, mensajes de error y documentación**: en español.
- En [03-modelo-datos.md](03-modelo-datos.md) está la tabla de equivalencias (por ejemplo, Producto → `Product`).
