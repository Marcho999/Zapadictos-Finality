# 08 · Plan de trabajo

Son 12 semanas, del **martes 2026-11-03 al martes 2027-01-26**. *La fecha de entrega está pendiente de confirmar; si cambia, se ajusta la duración de las fases 2 a 5.* Cada fase termina con algo funcionando de punta a punta, en el backend y en el frontend.

| Fase | Semanas | Fechas | Entregable |
|---|---|---|---|
| 0 · Diseño | 1 | 3 – 9 nov | Documentación (`docs/`), los 13 mockups faltantes aprobados y el repositorio creado |
| 1 · Base técnica ✅ (adelantada el 3 nov) | 2–3 | 10 – 23 nov | Monorepo, PostgreSQL en Docker, esquema Prisma con las 18 entidades, seed, CI, sistema visual en Tailwind y componentes base, proxy de Nuxt. **Hito:** `GET /products` funcionando y la página Tienda consumiéndolo |
| 2 · Catálogo ✅ (adelantada el 3 nov) | 4–5 | 24 nov – 7 dic | Inicio, Tienda con filtros, Detalle con colores y tallas, y en el admin: login de admin, Productos, Editar producto (con colores, tallas, fotos y ofertas) y Marcas y categorías |
| 3 · Cuentas ✅ (adelantada el 3 nov) | 6–7 | 8 – 21 dic | Registro y login de clientes, cookies seguras, refresh con rotación, Mi cuenta y direcciones, y límites de intentos |
| 4 · Compra ✅ (adelantada el 6 nov) | 8–9 | 22 dic – 4 ene | Carrito (local y en la base de datos, con la unión al iniciar sesión), pedidos con reserva de stock, tarea de vencimiento, Wompi sandbox (widget, webhook y verificación), Pedido y Mis pedidos, y el admin de Pedidos |
| 5 · Admin extra y cierre (en curso: Resumen y Clientes listos el 6 nov; faltan Administradores y Portada) | 10–12 | 5 – 26 ene | Semana 10: Resumen, Clientes, Administradores y Portada. Semanas 11 y 12: completar el checklist de seguridad, pruebas, despliegue en Vercel, Render y Neon, y el documento final |

**Riesgo:** la Fase 4 cae en Navidad y Año Nuevo. Si esas semanas rinden menos, se usa la semana 10 para terminar la compra y se recortan las funciones de admin según su prioridad:

1. Se recorta primero **Portada** (HU-21), que queda fija en el seed.
2. Después, **Administradores** (HU-20), que se crean solo por seed.
3. **Clientes** (HU-19) se mantiene porque es solo lectura y cuesta poco.

## Primeros pasos (Fase 1)

1. Instalar las herramientas: VS Code (con las extensiones Vue - Official, Prisma, ESLint y Tailwind CSS IntelliSense), Node.js LTS con pnpm (usando `corepack`), `docker` y `docker compose` (en Manjaro, con `pacman`), DBeaver, Bruno y `cloudflared`. Para Git, el panel de VS Code o GitHub Desktop (en Linux, la versión comunitaria `shiftkey/desktop` del AUR).
2. Crear el repositorio privado `zapadictos` en GitHub y conectarlo con esta carpeta.
3. Crear el monorepo con `apps/web` (Nuxt), `apps/api` (NestJS) y `packages/shared`.
4. Agregar `docker-compose.yml` con PostgreSQL y levantarlo.
5. Escribir `schema.prisma` con el modelo de datos y correr la primera migración.
6. Cargar los datos de prueba (seed): 6 marcas, 4 categorías, 12 productos con 1 a 3 colores y sus tallas, 2 ofertas, la portada y el administrador inicial.
7. Primer flujo completo: `GET /products` en la API y la página Tienda consumiéndolo a través del proxy.
