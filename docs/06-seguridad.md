# 06 · Seguridad

Los controles están agrupados según las categorías del OWASP Top 10. Cada uno se marca al implementarlo y se registra qué lo comprueba (una prueba automática o una captura). Ese registro sirve como evidencia en el documento final.

## A01 · Control de acceso
- [x] (Panel) El acceso de administrador usa su propio secreto (`ADMIN_JWT_SECRET`), su `audience` (`zapadictos-admin`) y su cookie. *Prueba: "rechaza un token falsificado" en `admin-auth.e2e-spec.ts`.*
- [x] El acceso de clientes usa otro secreto (`CUSTOMER_JWT_SECRET`, que la API exige que sea distinto del del panel) y otra audiencia (`zapadictos-customer`). *Pruebas: "la sesión de cliente no sirve en el panel" y "la sesión del panel no sirve en la tienda", incluso renombrando la cookie.*
- [x] El registro rechaza campos de más (`role`, `active`…), así que nadie puede crearse una cuenta con privilegios. *Prueba: "no permite registrarse como administrador".*
- [ ] Guard global que deniega por defecto: toda ruta necesita sesión salvo las marcadas con `@Public()`.
- [x] Las direcciones siempre se filtran por el `customerId` de la sesión: si son de otro cliente, la API responde 404. *Prueba: "un cliente no puede ver, editar ni borrar las direcciones de otro".*
- [x] Lo mismo para el carrito y los pedidos. *Pruebas: "el carrito de un cliente no se puede tocar con la sesión de otro" y "un cliente no puede ver ni pagar el pedido de otro (404)" en `orders.e2e-spec.ts`.*
- [x] Mientras un administrador tenga `mustChangePassword`, solo puede usar `me`, `change-password` y `logout`. *Prueba: "con contraseña temporal solo puede cambiarla".*
- [x] El guard del panel revisa en la base, en cada petición, que la sesión siga abierta y que el administrador siga activo. *Prueba: "un administrador desactivado pierde el acceso".*
- [x] (Panel) Las páginas de `/admin` tienen el middleware `admin`, que redirige a `/admin/ingresar`. Es solo para mejorar la experiencia: la protección real está en la API. El parámetro `volver` solo acepta rutas internas de `/admin`, para evitar redirecciones abiertas.
- [x] Las páginas de `/cuenta` tienen el middleware `account`. Después de ingresar, la redirección solo acepta rutas internas de la tienda, nunca el panel ni otros sitios. *Prueba: `safeRedirect` en `account.spec.ts`.*

## A02 · Fallas criptográficas
- [x] Contraseñas con hash argon2id, usando los parámetros mínimos de OWASP (m=19 MiB, t=2, p=1), definidos en `src/common/security/argon2-options.ts`. Ya se usan en el seed del administrador.
- [x] Refresh tokens aleatorios de 256 bits; en la base de datos solo se guarda su hash SHA-256 (`AdminSession.tokenHash`).
- [ ] HTTPS en producción (Vercel y Render). Cookies con `Secure` y encabezado HSTS.

## A03 · Inyección
- [x] Validación con esquemas Zod `.strict()` (D-21): un campo no declarado se rechaza, igual que `whitelist` + `forbidNonWhitelisted`, y los datos se transforman a su tipo. *Prueba: `catalog.e2e-spec.ts` ("rechaza parámetros desconocidos") y `catalog.spec.ts` en shared.*
- [x] El acceso a datos es solo por Prisma. Si alguna vez hace falta SQL, solo con `$queryRaw` y plantillas parametrizadas, nunca con `$queryRawUnsafe`. El catálogo usa `$queryRaw` con `Prisma.sql`, y la búsqueda escapa `%` y `_`. *Prueba: "trata % como texto" en `catalog.e2e-spec.ts`.* La única excepción es el `TRUNCATE` de la preparación de las pruebas, que toma los nombres de las tablas del catálogo de PostgreSQL y solo corre sobre una base `*_test`.
- [x] Las descripciones se muestran como texto plano: el proyecto no usa `v-html` en ninguna parte.
- [ ] `Banner.ctaHref` solo acepta rutas internas que empiecen por `/`, para impedir enlaces `javascript:` o a sitios externos.

## A04 · Diseño inseguro
- [x] Precio, total y stock se calculan en la API; nunca se aceptan del frontend. *Prueba: "ignora cualquier precio que mande el navegador" en `orders.e2e-spec.ts`.*
- [x] El stock se descuenta en una transacción con una actualización condicionada, para no vender dos veces la misma talla. *Prueba: "dos pedidos simultáneos por el último par: solo uno se completa" en `orders.e2e-spec.ts`.*
- [x] El webhook de Wompi verifica el checksum, el monto y la moneda antes de marcar un pedido como pagado, y es idempotente. *Pruebas: "el webhook sin firma válida se rechaza..." y "un webhook APPROVED firmado marca el pedido como pagado, y repetirlo no cambia nada" en `orders.e2e-spec.ts`.*
- [x] Límite de 3 pedidos pendientes por cliente y vencimiento a los 30 minutos. *Pruebas: "no acepta direcciones de otro cliente ni carritos vacíos, y limita a 3 pedidos pendientes" y "cancela los pedidos vencidos y devuelve el stock" en `orders.e2e-spec.ts`.*

## A05 · Configuración incorrecta
- [x] `helmet` activado en la API, con la CSP `default-src 'none'`. *Prueba: "envía encabezados de seguridad" en `catalog.e2e-spec.ts`.*
- [x] Nuxt envía `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy` en todas las páginas.
- [x] CSP en Nuxt que solo permite el script e iframe del widget de Wompi, las imágenes de Cloudinary y Google Fonts (`apps/web/nuxt.config.ts`). *`script-src` usa `'unsafe-inline'` porque Nuxt inyecta el payload de hidratación como script inline y el proyecto no usa un módulo con nonces (`nuxt-security`); queda como limitación conocida. Prueba: revisión manual de los encabezados y de la consola en `/checkout` (sin prueba automática todavía).*
- [x] Como el navegador solo habla con Nuxt, CORS en la API no permite ningún origen de navegador; el proxy solo reenvía `/api/v1/**`.
- [x] Las peticiones que modifican datos verifican el encabezado `Origin` (`OriginGuard` global), como defensa adicional contra CSRF. *Prueba: "exigen el Origin de la web".*
- [x] Cookies: `httpOnly`, `Secure` y `SameSite=Strict`. La cookie de acceso del admin lleva `Path=/api/v1/admin`, y su refresh `Path=/api/v1/admin/auth`. *Prueba: "el login deja cookies…".*
- [x] Los errores son genéricos, en español y sin stack trace; el detalle solo queda en el log del servidor (`HttpExceptionFilter`). *Prueba: "un producto inactivo responde 404".*
- [x] La API usa `trust proxy` con `TRUST_PROXY_HOPS` (1 en local, 2 en producción), para leer la IP real desde `X-Forwarded-For`; también oculta `X-Powered-By`.

## A06 · Componentes vulnerables
- [x] Dependabot activado (`.github/dependabot.yml`), y `pnpm audit --audit-level=high` en el CI; el pipeline falla si hay vulnerabilidades altas. Al 2026-11-03 hay 1 baja y 2 moderadas, todas en herramientas de compilación.
- [x] pnpm 12 solo instala versiones con al menos cierta antigüedad (`minimumReleaseAge`), y solo `allowBuilds` puede ejecutar scripts de instalación (D-24).
- [x] El archivo `pnpm-lock.yaml` está versionado y el CI instala con `--frozen-lockfile`.

## A07 · Fallas de identificación y autenticación
- [x] Sesión de admin: acceso de 15 minutos y refresh de 8 horas absolutas (al rotar no se alarga).
- [x] Sesión de cliente: acceso de 15 minutos y refresh de 7 días, que se renueva con el uso (D-30).
- [x] (Panel y tienda) Rotación del refresh token en cada uso. Si se reutiliza un token ya rotado, se revoca toda su cadena (`family`) y queda en la auditoría. El frontend hace un solo refresh a la vez, para no dispararlo por error. *Prueba: "el refresh rota el token y detecta…".*
- [x] Límite de intentos con `@nestjs/throttler`: 300 por minuto por IP en general y 3 por minuto en el login de admin. *Prueba: "limita el login a 3 intentos".*
- [x] 5 por minuto por IP en el login y el registro de clientes. *Prueba: "límite de 5 intentos por minuto".*
- [x] Un administrador queda bloqueado 15 minutos después de 5 intentos fallidos seguidos. *Prueba: "bloquea la cuenta 15 minutos".*
- [x] El login responde con un mensaje genérico ("Correo o contraseña incorrectos"), sin decir si el correo existe; si el correo no existe, igual se verifica contra un hash ficticio para que tarde lo mismo. *Prueba: "dan el mismo mensaje".*
- [x] El logout (del panel y de la tienda) y el cambio de contraseña del panel revocan las sesiones. *Pruebas: "cerrar sesión invalida…" y "se cierran sus otras sesiones".*

## A08 · Integridad de datos y software
- [x] La subida de fotos valida el tipo de archivo por su contenido (*magic bytes*: JPEG, PNG o WebP), no por la extensión, y el tamaño máximo de 5 MB. El nombre o `public_id` lo genera la API. En local se guardan en disco; en producción, en Cloudinary con subida firmada desde el servidor. *Prueba: "acepta solo imágenes reales de hasta 5 MB".*
- [x] El CI corre lint, la verificación de tipos, las pruebas unitarias y e2e y el build en cada push y PR (`.github/workflows/ci.yml`), con permisos de solo lectura. *Pendiente: activar la protección de la rama `main` en GitHub.*

## A09 · Fallas de registro y monitoreo
- [x] (Panel) `AuditLog` registra los logins (correctos, fallidos y bloqueados), la reutilización de refresh tokens, el cambio de contraseña y todos los cambios del catálogo, con los valores anteriores y nuevos. *Prueba: "cada cambio del panel queda en la auditoría".*
- [x] Clientes: registro, logins fallidos y reutilización de refresh tokens.
- [x] Pedidos y pagos: creación, cancelación, cada cambio de estado de pago y los eventos con firma inválida quedan en `AuditLog` (`ORDER_CREATED`, `ORDER_CANCELLED`, `PAYMENT_*`, `ORDER_REVIVED`, `ORDER_NEEDS_REVIEW`, `PAYMENT_EVENT_REJECTED` en `orders.service.ts` y `payments.service.ts`).
- [x] Los registros nunca incluyen contraseñas, tokens, cookies ni datos de tarjeta: `redact()` las omite por nombre de campo. *Pruebas: `audit.service.spec.ts` y "sin guardar la contraseña".*

## A10 · SSRF
- [x] (Cloudinary) La API solo hace peticiones salientes a `api.cloudinary.com`, con un tiempo límite de 20 segundos. Nunca a URLs que lleguen del usuario.
- [x] Lo mismo para la API de Wompi: `fetchTransaction` en `payments.service.ts` usa una URL fija de configuración (`WOMPI_API_URL`) y un id de transacción codificado, nunca una URL que mande el cliente. *Prueba: "verify consulta a Wompi de servidor a servidor y solo acepta transacciones del mismo pedido" en `orders.e2e-spec.ts`.*

## Datos personales (Ley 1581 de 2012)
- [x] Casilla obligatoria para aceptar la política de tratamiento de datos al registrarse, con un enlace a `/privacidad`. Se guarda la fecha de aceptación y se muestra en Mi cuenta. *Prueba: "exige aceptar la política de datos".*
- [x] Solo se piden los datos necesarios para comprar y enviar: nombre, correo, celular (opcional) y dirección.
