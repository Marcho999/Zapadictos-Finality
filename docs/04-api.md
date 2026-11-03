# 04 · API REST

La API expone **64 endpoints** bajo `/api/v1`: 27 para la tienda y 37 para el panel de administración.

Convenciones:

- **Formato de errores.** Siempre `{ "statusCode", "error", "message" }`, con mensajes en español y sin detalles internos.
- **Listados paginados.** Responden `{ data, meta: { page, pageSize, total, totalPages } }`. En el catálogo, `pageSize` es 12.
- **Fechas.** En formato ISO 8601 (UTC). **Montos.** En pesos, como número entero.
- **Acceso:**
  - Cliente: necesita la cookie `zp_session` (`Path=/api/v1`); su refresh `zp_session_rt` solo viaja a `/api/v1/auth`.
  - Admin: necesita la cookie `zp_admin`, que solo se envía a `/api/v1/admin`.
  - Dueño: además, el recurso debe pertenecer al cliente de la sesión. Si no le pertenece, la API responde **404** (no 403), para no revelar que existe.

## Tienda

### Autenticación de clientes
| Método | Ruta | Acceso | Para qué |
|---|---|---|---|
| POST | `/auth/register` | Público | Crear cuenta e iniciar sesión. Exige `acceptDataPolicy: true`. Un correo repetido responde 409. 5 por minuto por IP |
| POST | `/auth/login` | Público | Iniciar sesión; deja las cookies de acceso y de refresh. 5 por minuto por IP |
| POST | `/auth/refresh` | Cookie de refresh | Renovar la sesión, rotando el refresh token |
| POST | `/auth/logout` | Cliente | Cerrar sesión y revocar la sesión |

### Perfil
| Método | Ruta | Acceso | Para qué |
|---|---|---|---|
| GET | `/users/me` | Cliente | Ver el perfil |
| PATCH | `/users/me` | Cliente | Editar nombre y teléfono (el correo no se puede cambiar en el MVP) |
| GET | `/users/me/addresses` | Cliente | Listar direcciones |
| POST | `/users/me/addresses` | Cliente | Agregar una dirección (máximo 5) |
| PATCH | `/users/me/addresses/:id` | Dueño | Editar una dirección o marcarla como predeterminada |
| DELETE | `/users/me/addresses/:id` | Dueño | Borrar una dirección |

### Catálogo
| Método | Ruta | Acceso | Para qué |
|---|---|---|---|
| GET | `/products` | Público | Listar con filtros (ver abajo) |
| GET | `/products/:slug` | Público | Detalle del producto con sus colores, fotos, tallas, stock (con tope de 10, D-22) y oferta vigente |
| GET | `/brands` | Público | Marcas activas |
| GET | `/categories` | Público | Categorías activas, ordenadas |
| GET | `/variants?ids=a,b,c` | Público | Datos actuales de las variantes del carrito local (máximo 20) |
| GET | `/banner` | Público | Contenido de la portada |
| GET | `/uploads/:archivo` | Público | Solo en desarrollo: sirve las fotos guardadas en disco (no cuenta en los 64) |
| GET | `/health` | Público | Estado de la API y de la base de datos (para Render y para despertar la API antes de la demo; no cuenta en los 64) |

Filtros de `GET /products`:

| Parámetro | Ejemplo | Regla |
|---|---|---|
| `q` | `stride` | Busca en el nombre del producto y de la marca, sin distinguir mayúsculas ni tildes |
| `brand` | `velo,nomad` | Slugs separados por coma (se pueden combinar varias marcas) |
| `category` | `running` | Slug |
| `gender` | `MEN` | `MEN` y `WOMEN` incluyen también los productos `UNISEX` |
| `size` | `41` | Solo productos con stock en esa talla |
| `minPrice`, `maxPrice` | `200000` | Se comparan con el **precio vigente** (con oferta, si hay) |
| `onSale` | `true` | Solo productos con oferta vigente |
| `sort` | `newest` | `newest` (por defecto), `price_asc`, `price_desc` |
| `page` | `2` | Empieza en 1 |

Cada tarjeta del listado devuelve: `slug`, `name`, `brand`, `category`, `price`, `salePrice?`, `isNew`, `minSize`, `maxSize`, `lowStockSizes`, `coverImage`.

### Carrito
| Método | Ruta | Acceso | Para qué |
|---|---|---|---|
| GET | `/cart` | Cliente | Ver el carrito con los precios vigentes y el stock disponible |
| POST | `/cart/items` | Cliente | Agregar una variante |
| PATCH | `/cart/items/:id` | Dueño | Cambiar la cantidad |
| DELETE | `/cart/items/:id` | Dueño | Quitar un ítem |
| POST | `/cart/merge` | Cliente | Unir el carrito local al iniciar sesión |

### Pedidos y pagos
| Método | Ruta | Acceso | Para qué |
|---|---|---|---|
| POST | `/orders` | Cliente | Crear el pedido desde el carrito y una `addressId`; reserva el stock |
| GET | `/orders` | Cliente | Mis pedidos, paginados |
| GET | `/orders/:id` | Dueño | Detalle de un pedido |
| POST | `/payments/:orderId/checkout` | Dueño | Crear un intento de pago y devolver los datos para el widget de Wompi (referencia, monto, firma de integridad, llave pública, fecha de expiración) |
| POST | `/payments/:orderId/verify` | Dueño | Consultar a Wompi, de servidor a servidor, el estado de una transacción. Es el respaldo cuando el webhook no ha llegado |
| POST | `/payments/webhook` | Wompi (firma) | Recibir los eventos de Wompi y confirmar o rechazar el pago |

## Panel de administración (`/admin/**`)

Todas las rutas exigen la cookie `zp_admin`, menos login y refresh. Mientras el administrador tenga `mustChangePassword`, solo puede usar `me`, `change-password` y `logout`.

| Módulo | Método | Ruta | Para qué |
|---|---|---|---|
| Auth | POST | `/admin/auth/login` | Iniciar sesión de administrador (3 intentos por minuto por IP; bloqueo de 15 minutos tras 5 fallos seguidos, con respuesta 429) |
| Auth | POST | `/admin/auth/refresh` | Renovar la sesión |
| Auth | POST | `/admin/auth/logout` | Cerrar sesión |
| Auth | GET | `/admin/auth/me` | Datos del administrador en sesión |
| Auth | POST | `/admin/auth/change-password` | Cambiar la contraseña (obligatorio en el primer ingreso); revoca las demás sesiones |
| Resumen | GET | `/admin/summary` | Ventas de hoy y del mes, pedidos por estado, productos con stock bajo, ofertas activas, pedidos que necesitan revisión |
| Productos | GET | `/admin/products` | Listar con `q` (nombre o referencia), `brand`, `status` (`active`/`inactive`) y `page` |
| Productos | GET | `/admin/products/:id` | Detalle completo para editar (colores, variantes, fotos, ofertas) |
| Productos | POST | `/admin/products` | Crear un producto |
| Productos | PATCH | `/admin/products/:id` | Editar o reactivar un producto |
| Productos | DELETE | `/admin/products/:id` | Desactivar un producto (borrado lógico) |
| Colores | POST | `/admin/products/:id/colors` | Agregar un color |
| Colores | PATCH | `/admin/colors/:id` | Editar un color, cambiar su orden o activarlo y desactivarlo |
| Colores | DELETE | `/admin/colors/:id` | Borrar un color; solo si ninguna de sus variantes está en un pedido, si no, se desactiva |
| Variantes | POST | `/admin/colors/:id/variants` | Agregar un rango de tallas (`from`, `to`) con su stock inicial; ignora las que ya existen |
| Variantes | PATCH | `/admin/variants/:id` | Ajustar el stock (cantidad absoluta) o activar y desactivar la talla |
| Fotos | POST | `/admin/colors/:id/images` | Subir una foto (`multipart`, campo `file`): JPEG, PNG o WebP; máximo 5 MB; hasta 8 por color. Responde 415 si no es una imagen real y 413 si es muy grande |
| Fotos | PATCH | `/admin/images/:id` | Cambiar el orden o el texto alternativo |
| Fotos | DELETE | `/admin/images/:id` | Borrar la foto, también de Cloudinary |
| Ofertas | POST | `/admin/products/:id/offers` | Programar una oferta |
| Ofertas | PATCH | `/admin/offers/:id` | Editar las fechas o el precio, o activarla y desactivarla |
| Ofertas | DELETE | `/admin/offers/:id` | Borrar una oferta que todavía no ha empezado |
| Marcas | GET | `/admin/brands` | Listar todas, incluidas las inactivas |
| Marcas | POST | `/admin/brands` | Crear una marca |
| Marcas | PATCH | `/admin/brands/:id` | Editar, activar o desactivar una marca |
| Categorías | GET | `/admin/categories` | Listar todas |
| Categorías | POST | `/admin/categories` | Crear una categoría |
| Categorías | PATCH | `/admin/categories/:id` | Editar, cambiar el orden, activar o desactivar una categoría |
| Pedidos | GET | `/admin/orders` | Listar con `status`, `q` (número o correo), `from`, `to`, `needsReview` y `page` |
| Pedidos | GET | `/admin/orders/:id` | Detalle con los intentos de pago |
| Pedidos | PATCH | `/admin/orders/:id/status` | Cambiar el estado según las transiciones permitidas |
| Clientes | GET | `/admin/customers` | Listar con `q` (nombre o correo) y `page` |
| Clientes | GET | `/admin/customers/:id` | Perfil del cliente, sus direcciones y sus pedidos (solo lectura) |
| Admins | GET | `/admin/admins` | Listar administradores |
| Admins | POST | `/admin/admins` | Crear un administrador con contraseña temporal |
| Admins | PATCH | `/admin/admins/:id` | Activar o desactivar un administrador, o restablecer su contraseña temporal |
| Portada | PUT | `/admin/banner` | Actualizar textos y foto (multipart) |
