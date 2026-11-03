# Zapadictos

Tienda online de zapatillas, el proyecto final de universidad. Monorepo con:

| Carpeta | Qué es |
|---|---|
| `apps/web` | Tienda y panel de administración (Nuxt 4 + Tailwind) |
| `apps/api` | API REST (NestJS 12 + Prisma 7 + PostgreSQL) |
| `packages/shared` | Esquemas Zod, constantes y tipos compartidos |
| `docs/` | Toda la definición del proyecto: empieza por [docs/README.md](docs/README.md) |

## Requisitos

- Node.js 26 (ver `.nvmrc`)
- pnpm 12: `npm install -g pnpm@12`
- Docker con Docker Compose

## Primera vez

```bash
pnpm install

# Variables de entorno: copia los ejemplos y cambia las claves.
cp .env.example .env                  # clave de PostgreSQL local
cp apps/api/.env.example apps/api/.env  # usa la misma clave en DATABASE_URL
cp apps/web/.env.example apps/web/.env

pnpm db:up        # PostgreSQL 18 en Docker (crea también la base de pruebas)
pnpm db:migrate   # aplica las migraciones
pnpm db:seed      # marcas, categorías, 12 productos, ofertas y el admin inicial
```

## Día a día

```bash
pnpm dev          # API en :4000 y web en :3000 (http://localhost:3000)
pnpm check        # lint + tipos + pruebas unitarias + e2e (lo mismo que el CI)
pnpm db:studio    # explorar la base con Prisma Studio
```

El navegador solo habla con Nuxt: las llamadas a `/api/v1/**` las reenvía el servidor de Nuxt a la API (ver `docs/02-arquitectura.md`).
