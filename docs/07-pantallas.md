# 07 · Pantallas y sistema visual

## Pantallas

El sitio tiene **18 pantallas**: 9 de la tienda y 9 del panel de administración, más tres páginas de contenido fijo. Hay 5 pantallas con mockup aprobado (PDF "Zapadictos — Mockups"). Las otras 13 tienen su mockup en el [lienzo de pantallas nuevas](https://claude.ai/artifact/7PFy9BCjtGG6pZ23VrvFnN), pendiente de revisión.

### Tienda
| # | Pantalla | Ruta | Acceso | Render | Mockup |
|---|---|---|---|---|---|
| 1 | Inicio | `/` | Público | SSR | Aprobado + cambio por ofertas (lienzo "Ofertas en la tienda") |
| 2 | Tienda | `/tienda` (Hombre: `?gender=MEN`, Mujer: `?gender=WOMEN`) | Público | SSR | Aprobado + cambio por ofertas |
| 3 | Detalle de producto | `/producto/[slug]` | Público | SSR | Aprobado + cambio por ofertas |
| 4 | Carrito | `/carrito` | Público | SSR (los datos se cargan en el cliente) | Aprobado |
| 5 | Ingresar / Registro | `/cuenta/ingresar` | Público | Cliente | Hecho (por revisar) |
| 6 | Checkout | `/checkout` | Cliente | Cliente | Hecho (por revisar) |
| 7 | Pedido (confirmación y detalle) | `/pedido/[id]` | Dueño | Cliente | Hecho (por revisar) |
| 8 | Mis pedidos | `/cuenta/pedidos` | Cliente | Cliente | Hecho (por revisar) |
| 9 | Mi cuenta (perfil y direcciones) | `/cuenta` | Cliente | Cliente | Hecho (por revisar) |

Páginas de contenido fijo: `/envios`, `/contacto` y `/privacidad` (la política de tratamiento de datos). La "Guía de tallas" es una ventana sobre el detalle del producto. "Marcas" en el menú lleva a la sección de marcas del inicio. El menú principal suma **"Ofertas"**, que lleva a `/tienda?onSale=true`, así que queda: Tienda, Hombre, Mujer, Ofertas, Marcas. Con la sesión iniciada, "Ingresar" se cambia por "Hola, {nombre}", que lleva a `/cuenta`.

### Panel de administración
| # | Pantalla | Ruta | Mockup |
|---|---|---|---|
| 10 | Ingresar admin (incluye el cambio de contraseña obligatorio) | `/admin/ingresar` | Hecho (por revisar) |
| 11 | Resumen | `/admin` | Hecho (por revisar) |
| 12 | Productos | `/admin/productos` | Aprobado |
| 13 | Crear o editar producto (pestañas: Datos; Colores, tallas y fotos; Oferta) | `/admin/productos/[id]`, `/admin/productos/nuevo` | Hecho (por revisar) |
| 14 | Pedidos (con un panel lateral de detalle) | `/admin/pedidos` | Hecho (por revisar) |
| 15 | Marcas y categorías | `/admin/catalogo` | Hecho (por revisar) |
| 16 | Clientes (con un panel lateral de detalle) | `/admin/clientes` | Hecho (por revisar) |
| 17 | Administradores | `/admin/administradores` | Hecho (por revisar) |
| 18 | Portada | `/admin/portada` | Hecho (por revisar) |

Todas las pantallas del panel se renderizan solo en el cliente. El menú lateral queda así: Resumen, Productos, Pedidos, Catálogo, Clientes, Portada y Administradores. Abajo van "Ver tienda" y "Cerrar sesión".

## Sistema visual (tomado de los mockups)

### Colores
Valores aproximados, tomados a ojo del PDF. Se ajustan si aparece el archivo de diseño original. Están definidos como tokens de Tailwind en `apps/web/app/assets/css/main.css`.

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#F3F1EC` | Fondo general (crema) |
| `surface` | `#FFFFFF` | Tarjetas, campos y paneles |
| `muted` | `#E8E3DC` | Tarjetas de categoría, franja de beneficios y miniaturas |
| `ink` | `#111111` | Texto principal, botones principales, menú lateral del admin y pie de página |
| `ink-soft` | `#6B6760` | Texto secundario |
| `line` | `#DDD8D0` | Bordes |
| `accent` | `#FF5A1F` | Etiquetas "Nuevo", "Oferta" y "Últimos pares", y el bloque del banner |
| `success` | `#DDF1E2` / `#1E6B3A` | Etiqueta "Activo" |
| `danger` | `#FBE0DC` / `#A1221B` | Etiquetas "Agotado" y "Stock bajo", errores |
| `warning` | `#FFE3D6` / `#8A2E0A` | "Pendiente de pago", "Últimos pares" en el admin |
| `info` | `#E1E9F7` / `#1F4A8A` | "Pagado", "Programada" |
| `neutral` | `#ECE8E2` / `#6B6760` | Etiqueta "Inactivo" |

### Tipografía
- Títulos: **Archivo**, en peso 800–900 y ancho extendido, en mayúsculas para los títulos grandes ("TIENDA", "TU CARRITO").
- Texto: **DM Sans**, en pesos 400, 500 y 700.
- Ambas se cargan desde Google Fonts.

### Componentes base (`components/ui/`)
Botón (principal negro, secundario con borde, deshabilitado beige), etiqueta (de acento y de estado), chip de filtro con ×, tarjeta de producto, selector de talla (normal, seleccionada, agotada con borde punteado y tachada), selector de color con círculos, campo de búsqueda, campo de texto, select, contador de cantidad (− n +), migas de pan, paginación, tabla del admin, panel lateral y ventana modal.

Las esquinas son redondeadas: botones en forma de píldora y tarjetas con radio de unos 16 px.

### Móvil
Los mockups son de escritorio. En móvil:
- El menú se vuelve un botón hamburguesa y el buscador pasa a ocupar todo el ancho.
- Los filtros de la tienda se abren en un panel lateral desde el botón "Filtrar".
- Las tarjetas de producto van en 2 columnas.
- En el detalle, la galería va arriba y el selector y el botón de compra abajo, con el botón fijo al pie de la pantalla.
- En el carrito y el checkout, el resumen del pedido va debajo de los productos.
- En el admin, el menú lateral se oculta detrás de un botón y las tablas se convierten en tarjetas.
