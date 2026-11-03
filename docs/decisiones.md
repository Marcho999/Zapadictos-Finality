# Registro de decisiones

Cada decisión tiene fecha y explica por qué se tomó. Si una decisión cambia, no se borra: se agrega una nueva que la reemplaza.

| ID | Fecha | Decisión | Por qué |
|---|---|---|---|
| D-01 | 2026-11-03 | **Dos accesos separados**: tablas `Customer` y `Admin`, cada una con su login, su cookie (`zp_session` y `zp_admin`), su secreto JWT y su duración de sesión | Lo pidió el usuario. Así el registro público nunca puede crear un administrador, y una sesión robada de cliente no da acceso al panel |
| D-02 | 2026-11-03 | **Nuxt hace de proxy de la API** (`/api/**` → Render) | Vercel y Render son sitios distintos, y con `SameSite=Strict` las cookies no se enviarían entre ellos. Con el proxy no hace falta comprar un dominio |
| D-03 | 2026-11-03 | **Las páginas privadas se renderizan solo en el cliente**; las públicas, con SSR y sin datos de sesión | Con `Strict`, la cookie no se envía en la primera carga cuando se llega desde otro sitio (Google o Wompi). Además, el SSR no necesita reenviar cookies |
| D-04 | 2026-11-03 | **Varios colores por producto**, con la entidad `ProductColor`; las fotos y las tallas cuelgan del color | El mockup de detalle tiene un selector de color y la referencia `VEL-STR2-NEG` |
| D-05 | 2026-11-03 | **El precio va solo en el Producto**; las variantes no tienen precio propio | Los mockups muestran un solo precio por producto. Esto corrige "ajustar stock o precio" de la guía |
| D-06 | 2026-11-03 | **Ofertas con precio rebajado por producto**, con fechas de inicio y fin y un interruptor; una sola oferta vigente por producto | Lo pidió el usuario. Las campañas por porcentaje quedan para la versión 2 |
| D-07 | 2026-11-03 | **Se suman funciones al admin**: marcas y categorías, administradores, portada y clientes (solo lectura), con prioridades para recortar | Lo pidió el usuario. Las prioridades protegen la fecha de entrega |
| D-08 | 2026-11-03 | **Reserva de stock al crear el pedido**, con vencimiento a los 30 minutos y devolución automática del stock | Evita vender lo que no hay sin bloquear el stock para siempre |
| D-09 | 2026-11-03 | **Un pago rechazado no cancela el pedido**: el cliente puede reintentar hasta que el pedido venza | Mejor experiencia, sobre todo con PSE. Cambia lo que decía la guía ("cancelado si el pago falla") |
| D-10 | 2026-11-03 | **Se usa el widget de Wompi** (ventana sobre la página) en lugar de redirigir, más un endpoint `verify` de respaldo | El cliente no sale del sitio, y el pedido se confirma aunque el webhook tarde |
| D-11 | 2026-11-03 | **Los montos se guardan como enteros en pesos** y se multiplican por 100 solo al enviarlos a Wompi | El COP no usa centavos; así se evitan errores de redondeo |
| D-12 | 2026-11-03 | **Tallas EU enteras** (34 a 48); `Gender` con `MEN`, `WOMEN` y `UNISEX`; Hombre y Mujer incluyen los productos unisex | Coincide con los mockups; las medias tallas quedan para la versión 2 |
| D-13 | 2026-11-03 | **Envío con tarifa fija de $15.000** y precios con IVA incluido | Coincide con los mockups |
| D-14 | 2026-11-03 | **`AuditLog` en la base de datos** y sesiones guardadas para poder revocarlas | Da evidencia para el documento final y permite que el logout invalide la sesión de verdad |
| D-15 | 2026-11-03 | **Código en inglés; interfaz, URLs de la tienda y documentación en español** | Es lo habitual con las herramientas del stack, y la guía ya usaba rutas de la API en inglés |
| D-16 | 2026-11-03 | **Casilla de la Ley 1581 de 2012** al registrarse | Es un requisito legal en Colombia para tratar datos personales |
| D-17 | 2026-11-03 | Se agrega `packages/shared` con los esquemas Zod compartidos entre web y api | Las mismas reglas de validación en los dos lados, sin duplicar código |
| D-18 | 2026-11-03 | Se agrega **"Ofertas" al menú principal** de la tienda (`/tienda?onSale=true`) | Las ofertas no tenían una entrada visible en la tienda |
| D-19 | 2026-11-03 | En Editar producto, **las fotos van en la misma pestaña que los colores y las tallas** | Las fotos pertenecen a un color (D-04), así que se editan junto a él |
| D-20 | 2026-11-03 | El detalle del pedido y del cliente en el admin se abre en un **panel lateral**, no en otra página | Se revisa el pedido sin perder la lista ni los filtros, y el panel queda en 9 pantallas |
| D-21 | 2026-11-03 | **La API valida con Zod** (`ZodValidationPipe` y esquemas `.strict()` de `packages/shared`), no con `class-validator` | Los mismos esquemas sirven en la web y en la API; `.strict()` cumple el papel de `whitelist` + `forbidNonWhitelisted`. Los mensajes salen en español (`z.locales.es`) |
| D-22 | 2026-11-03 | **El stock público tiene un tope de 10** por talla | Alcanza para mostrar "Agotado" y "Últimos pares" sin revelar el inventario exacto |
| D-23 | 2026-11-03 | **Vitest y oxlint en la API** en lugar de Jest y ESLint | Es lo que genera Nest 12 por defecto; Vitest es la misma herramienta que usa la web |
| D-24 | 2026-11-03 | **Node.js 26 y pnpm 12**, respetando el `minimumReleaseAge` de pnpm (no se agregan excepciones) | Es la versión LTS vigente. Por esa regla, `argon2` quedó fijado en 0.45.1, porque la 0.45.2 se publicó el mismo día |
| D-25 | 2026-11-03 | **Las pruebas e2e preparan la base con `migrate deploy` + `TRUNCATE`**, y solo sobre bases `*_test`; no usan `migrate reset` | `migrate reset` borra la base completa y Prisma lo bloquea cuando lo ejecuta un agente de IA. Este método es más seguro y también funciona en CI |
| D-26 | 2026-11-03 | **No se usa VeeValidate**: los formularios usan un composable propio (`useZodForm`) con los esquemas compartidos | VeeValidate 4.15.1 no acepta Standard Schema y su adaptador es para Zod 3. El composable tiene menos de 80 líneas y muestra en el mismo lugar los errores de la API |
| D-27 | 2026-11-03 | **Las fotos se guardan en disco en desarrollo y en Cloudinary en producción**, con el mismo código detrás de la interfaz `ImageStorage` | Se puede trabajar sin cuenta de Cloudinary; en producción la API no arranca si falta `CLOUDINARY_URL` |
| D-28 | 2026-11-03 | **Las fotos del producto se ordenan con botones ←/→** en lugar de arrastrar y soltar | Funciona con teclado y en móvil, y no agrega dependencias |
| D-29 | 2026-11-03 | **El Resumen del panel queda para la Fase 5**: por ahora `/admin` abre Productos, y las secciones futuras aparecen deshabilitadas con su fase | Coincide con el plan; el menú ya tiene la estructura final |
| D-30 | 2026-11-03 | **La sesión del cliente es deslizante**: cada renovación la extiende 7 días más. La del panel sigue siendo de 8 horas absolutas | En la tienda, cerrar la sesión a alguien que compra seguido es mala experiencia; en el panel pesa más la seguridad |
| D-31 | 2026-11-03 | **Un correo ya registrado responde 409** con un mensaje que invita a ingresar | Es inevitable en un registro (el usuario necesita saberlo); el límite de 5 intentos por minuto hace inútil usarlo para listar correos |
| D-32 | 2026-11-03 | **El cliente de la web con renovación de sesión es uno solo** (`createSessionClient`), usado por el panel y por la tienda con rutas, cookies y estado distintos | Una sola implementación del "un refresh a la vez", probada una vez |
