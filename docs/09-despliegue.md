# 09 · Despliegue

Guía paso a paso para desplegar en el plan gratuito de Vercel (web), Render (API) y Neon (PostgreSQL), según lo decidido en `docs/02-arquitectura.md`. Ninguno de estos pasos se puede automatizar: cada uno necesita que *tú* crees la cuenta y pegues los valores, porque implican identidad y, en algunos casos, verificación con tarjeta (aunque el plan sea gratuito).

El repositorio ya trae lo necesario para que, una vez creadas las cuentas, el despliegue sea solo "conectar y pegar variables":

- `render.yaml` (en la raíz): blueprint de la API para Render.
- `apps/web/vercel.json`: comandos de build para que Vercel arme primero `packages/shared` antes de compilar la web (es un monorepo pnpm).

## Orden recomendado

Neon primero (la API necesita `DATABASE_URL` para arrancar), luego Render (la web necesita la URL de la API para `NUXT_API_ORIGIN`), y Vercel al final.

### 1. Neon (PostgreSQL)

1. Crea una cuenta en [neon.tech](https://neon.tech) y un proyecto nuevo (región más cercana a Colombia: `aws-us-east-1` suele ser la de menor latencia en el plan gratuito).
2. Crea una base llamada `zapadictos` (Neon ya crea una por defecto; puedes renombrarla o usar la que trae).
3. Copia el **connection string** que te da Neon (modo "Pooled connection", que es el que soporta más conexiones concurrentes del plan gratuito). Debe verse así:
   ```
   postgresql://usuario:contraseña@ep-xxxx-pooler.us-east-1.aws.neon.tech/zapadictos?sslmode=require
   ```
   Ese valor completo es el `DATABASE_URL` que vas a pegar en Render más adelante. Guárdalo en un lugar seguro (no lo pegues en el chat ni lo subas al repositorio).

### 2. Render (API)

1. Crea una cuenta en [render.com](https://render.com) y conéctala a tu cuenta de GitHub.
2. **New → Blueprint**, elige este repositorio. Render va a leer `render.yaml` solo.
3. Cuando te pida los valores marcados `sync: false`, pégalos:

   | Variable | De dónde sale |
   |---|---|
   | `DATABASE_URL` | El connection string de Neon (paso 1) |
   | `WEB_ORIGIN` | La URL de Vercel. La primera vez no la tienes todavía: pon un valor provisional como `https://zapadictos.vercel.app` y **vuelve a este paso después de desplegar en Vercel** para corregirlo con la URL real (Settings → Environment en Render) |
   | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | El correo y una contraseña de al menos 12 caracteres para el primer administrador |
   | `ADMIN_JWT_SECRET` / `CUSTOMER_JWT_SECRET` | Dos secretos aleatorios de al menos 32 caracteres, **distintos entre sí** (D-01). Genera cada uno con `openssl rand -base64 48` o con un generador de contraseñas largas |
   | `CLOUDINARY_URL` | De tu cuenta gratuita de Cloudinary (cloudinary.com → Dashboard → "API Environment variable"), formato `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |
   | `WOMPI_PUBLIC_KEY` / `WOMPI_INTEGRITY_SECRET` / `WOMPI_EVENTS_SECRET` | De tu cuenta sandbox de Wompi (comercios.wompi.co → Desarrolladores) |

4. Despliega. La primera vez `preDeployCommand` corre las migraciones (`prisma migrate deploy`) contra Neon; si tu plan de Render no muestra el campo "Pre-Deploy Command" en la interfaz, pégalo al principio del "Build Command" en su lugar: `pnpm --filter @zapadictos/api db:deploy && ` seguido del resto del comando que ya trae `render.yaml`.
5. Carga los datos de prueba una sola vez, corriendo el seed contra Neon **desde tu máquina** (no hace falta hacerlo desde Render):
   ```
   # En apps/api/.env, apunta DATABASE_URL al connection string de Neon (temporalmente)
   pnpm --filter @zapadictos/api db:seed
   # Vuelve a dejar DATABASE_URL como estaba para seguir trabajando en local
   ```
6. Copia la URL pública que te da Render (algo como `https://zapadictos-api.onrender.com`). La necesitas para el siguiente paso.
7. **El plan gratuito de Render apaga la API cuando no se usa** y tarda unos 50 segundos en volver a arrancar. Antes de cualquier demo, abre `https://<tu-api>.onrender.com/api/v1/health` para despertarla.

### 3. Vercel (web)

1. Crea una cuenta en [vercel.com](https://vercel.com) y conéctala a GitHub.
2. **Add New → Project**, elige este repositorio.
3. En "Root Directory" elige `apps/web`. Vercel debería detectar el framework Nuxt automáticamente; dejas el Build Command en blanco (lo define `apps/web/vercel.json`, que ya está en el repo).
4. Variable de entorno: `NUXT_API_ORIGIN` = la URL de Render del paso anterior (ej. `https://zapadictos-api.onrender.com`, **sin** `/api/v1` al final).
5. Despliega. Copia la URL que te da Vercel (ej. `https://zapadictos.vercel.app`).
6. Vuelve a Render (Settings → Environment) y corrige `WEB_ORIGIN` con esta URL real. Render vuelve a desplegar solo al guardar el cambio.

### 4. Wompi: conectar el webhook

En el panel de Wompi (sandbox), configura la URL del webhook como:
```
https://<tu-api-en-render>.onrender.com/api/v1/payments/webhook
```
En local esto se hacía con un túnel de `cloudflared` (`docs/05-reglas-negocio.md`); en producción no hace falta, porque Render ya expone una URL pública con HTTPS.

## Verificación después de desplegar

- `GET https://<tu-api>.onrender.com/api/v1/health` responde `{"status":"ok"}`.
- La tienda carga en la URL de Vercel y el catálogo del seed aparece.
- Entrar a `/admin/ingresar` con `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` pide cambiar la contraseña (como en local).
- Revisar en las herramientas de desarrollador que las cookies tienen `Secure` y que la respuesta trae el encabezado `Strict-Transport-Security` (lo agrega Render automáticamente al servir por HTTPS) — esto cierra el ítem A02 pendiente en `docs/06-seguridad.md`.
- Hacer una compra de prueba completa con una tarjeta de prueba de Wompi sandbox, hasta ver el pedido como `PAID` en `/admin/pedidos`.

## Variables de entorno — referencia rápida

Todas están documentadas con su propósito en `apps/api/.env.example` y `apps/web/.env.example`; esta tabla solo resume cuáles son secretas (nunca se comparten ni se suben al repositorio) y cuáles no.

| Variable | Dónde | Secreta |
|---|---|---|
| `DATABASE_URL` | Render | Sí |
| `WEB_ORIGIN` | Render | No (es pública: la URL de Vercel) |
| `TRUST_PROXY_HOPS=2` | Render | No |
| `SHIPPING_COST` | Render | No |
| `SEED_ADMIN_EMAIL` | Render | No (pero la contraseña sí) |
| `SEED_ADMIN_PASSWORD` | Render | Sí |
| `ADMIN_JWT_SECRET` / `CUSTOMER_JWT_SECRET` | Render | Sí |
| `CLOUDINARY_URL` | Render | Sí |
| `WOMPI_PUBLIC_KEY` | Render | No (es la llave pública, por diseño) |
| `WOMPI_INTEGRITY_SECRET` / `WOMPI_EVENTS_SECRET` | Render | Sí |
| `WOMPI_API_URL` | Render | No |
| `NUXT_API_ORIGIN` | Vercel | No |
