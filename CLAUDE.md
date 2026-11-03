# Zapadictos

Tienda online de zapatillas: el proyecto final de universidad de Marvin. Monorepo pnpm con `apps/web` (Nuxt), `apps/api` (NestJS + Prisma + PostgreSQL) y `packages/shared` (esquemas Zod).

## Fuente de verdad
La definición completa está en `docs/`. Antes de implementar algo, lee el documento que le corresponde:
- Alcance y prioridades: `docs/01-alcance.md`
- Arquitectura: `docs/02-arquitectura.md`
- Modelo de datos: `docs/03-modelo-datos.md`
- Endpoints: `docs/04-api.md`
- Reglas de negocio: `docs/05-reglas-negocio.md`
- Seguridad: `docs/06-seguridad.md`
- Pantallas y sistema visual: `docs/07-pantallas.md`
- Plan: `docs/08-plan.md`

Si una implementación obliga a cambiar una decisión, actualiza el documento correspondiente y agrega una entrada en `docs/decisiones.md`. Nunca dejes que el código y la documentación digan cosas distintas.

## Reglas que no se negocian
- **Dos accesos separados.** `Customer` y `Admin` son tablas distintas, con estrategias JWT, secretos y cookies distintos (`zp_session` y `zp_admin`). Nunca mezcles los guards.
- **El frontend nunca envía precios, totales ni stock.** La API los calcula siempre.
- **El stock se descuenta dentro de una transacción**, con una actualización condicionada (`stock >= n`).
- **Un pedido pasa a PAID solo por un webhook de Wompi con firma verificada** o por una consulta de la API a Wompi. Nunca por lo que diga el navegador.
- **El navegador solo habla con Nuxt**; Nuxt reenvía `/api/**` a la API. Las páginas privadas se renderizan con `ssr: false`.
- **Sin SQL armado a mano.** Solo Prisma, o `$queryRaw` con plantillas.
- **Nunca registres** contraseñas, tokens, cookies ni datos de tarjeta.
- Los secretos van solo en `.env`; en el repositorio solo se versiona `.env.example`.

## Comandos
- `pnpm dev`: API en el puerto 4000 y web en el 3000. Antes, `pnpm db:up`.
- `pnpm check`: lint, tipos, pruebas unitarias y e2e. Debe pasar antes de dar algo por terminado.
- `pnpm db:migrate` / `pnpm db:seed`: migraciones y datos de prueba (los scripts están en `apps/api`).
- Si cambias `packages/shared`, compílalo (`pnpm --filter @zapadictos/shared build`) antes de usarlo desde web o api.
- **Nunca** ejecutes `prisma migrate reset` ni borres bases de datos: si hace falta, pídeselo a Marvin. Las pruebas e2e solo tocan `zapadictos_test`.
- Respeta el `minimumReleaseAge` de pnpm: si una versión es demasiado nueva, usa la anterior; no agregues excepciones.

## Convenciones
- La API es ESM (`"type": "module"`): los imports relativos terminan en `.js`.
- Los componentes de Nuxt se nombran por su archivo, sin prefijo de carpeta (`ProductCard`, `UiButton`).
- El código (modelos, variables, rutas de la API, archivos) va en inglés. La interfaz, las URLs de la tienda, los mensajes de error y la documentación van en español.
- Los montos son enteros en COP; solo se multiplican por 100 para Wompi.
- Los estilos usan los tokens de Tailwind definidos en `docs/07-pantallas.md`; no se escriben colores sueltos.
- Cada control de seguridad implementado se marca en `docs/06-seguridad.md` junto con su prueba.
