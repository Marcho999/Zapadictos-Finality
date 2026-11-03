# 03 · Modelo de datos

El modelo tiene **18 entidades**. Hay dos ideas centrales:

1. **El stock vive en la Variante** (un color y una talla de un producto), no en el Producto.
2. **El Pedido guarda una copia** de los precios, los productos y la dirección de envío al momento de comprar. Así, un cambio posterior en el catálogo o en el perfil no altera los pedidos ya hechos.

Convenciones:

- Los `id` son UUID.
- Los montos se guardan como **enteros en pesos** (`Int`); a Wompi se le envían multiplicados por 100, en centavos.
- Las fechas son `DateTime` en UTC y se muestran en hora de Colombia.

Además de las restricciones de Prisma, la migración inicial agrega restricciones `CHECK` (precio, stock, talla, color hex, fechas de la oferta, cantidades y totales del pedido) y un índice único parcial para que cada cliente tenga una sola dirección predeterminada.

## Relaciones

```
Brand ──<  Product  >── Category
             │  └──< Offer
             └──< ProductColor ──< ProductImage
                       └──< Variant ──< CartItem  >── Customer
                                  └──< OrderItem  >── Order >── Customer
                                                       └──< Payment
Customer ──< Address
Customer ──< CustomerSession          Admin ──< AdminSession
AuditLog (actor: Admin | Customer | sistema | anónimo)     Banner (registro único)
```

## Equivalencias

| Documento | Modelo Prisma | | Documento | Modelo Prisma |
|---|---|---|---|---|
| Cliente | `Customer` | | Oferta | `Offer` |
| Administrador | `Admin` | | Dirección | `Address` |
| Sesión de cliente | `CustomerSession` | | Ítem de carrito | `CartItem` |
| Sesión de admin | `AdminSession` | | Pedido | `Order` |
| Marca | `Brand` | | Ítem de pedido | `OrderItem` |
| Categoría | `Category` | | Pago | `Payment` |
| Producto | `Product` | | Auditoría | `AuditLog` |
| Color de producto | `ProductColor` | | Portada | `Banner` |
| Imagen | `ProductImage` | | Variante | `Variant` |

## Enums

| Enum | Valores |
|---|---|
| `Gender` | `MEN`, `WOMEN`, `UNISEX` |
| `OrderStatus` | `PENDING_PAYMENT`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED` |
| `PaymentStatus` | `PENDING`, `APPROVED`, `DECLINED`, `VOIDED`, `ERROR` (los mismos estados que usa Wompi) |
| `ActorType` | `ADMIN`, `CUSTOMER`, `SYSTEM`, `ANONYMOUS` |

## Entidades

### Cuentas y sesiones

**Customer** (cliente)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| name | String | De 2 a 80 caracteres |
| email | String | Único, guardado en minúsculas |
| passwordHash | String | argon2id |
| phone | String? | Celular colombiano de 10 dígitos |
| dataPolicyAcceptedAt | DateTime | Momento en que aceptó el tratamiento de datos (Ley 1581 de 2012) |
| active | Boolean | Por defecto `true` |
| createdAt / updatedAt | DateTime | |

**Admin** (administrador)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| name | String | |
| email | String | Único, en minúsculas |
| passwordHash | String | argon2id |
| mustChangePassword | Boolean | `true` cuando lo crea otro administrador con una contraseña temporal |
| active | Boolean | Los administradores se desactivan, nunca se borran |
| failedLoginCount | Int | Se reinicia a 0 al iniciar sesión correctamente |
| lockedUntil | DateTime? | Bloqueo temporal después de 5 intentos fallidos seguidos |
| lastLoginAt | DateTime? | |
| createdById | UUID? → Admin | `null` para el administrador creado por el seed |
| createdAt / updatedAt | DateTime | |

**CustomerSession** y **AdminSession** (tienen los mismos campos; cada una se relaciona con su tipo de cuenta)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| customerId / adminId | UUID | |
| tokenHash | String | Único. Hash SHA-256 del refresh token; el token en sí nunca se guarda |
| family | UUID | Identifica la cadena de rotaciones, para detectar si un token se reutiliza |
| expiresAt | DateTime | 7 días para clientes, 8 horas para administradores |
| revokedAt | DateTime? | |
| userAgent / ip | String? | Para auditoría |
| createdAt | DateTime | |

### Catálogo

**Brand** (marca): `id`, `name` (único), `slug` (único), `active`, `createdAt`.

**Category** (categoría): `id`, `name` (único), `slug` (único), `active`, `sortOrder` (posición en "Compra por categoría"), `createdAt`.

**Product** (producto)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| reference | String | Único, por ejemplo `VEL-STR2` |
| name | String | Por ejemplo "Velo Stride 2" |
| slug | String | Único, por ejemplo `velo-stride-2` |
| description | String | Texto plano, hasta 2.000 caracteres |
| gender | Gender | |
| price | Int | Precio normal en COP, con IVA incluido; debe ser mayor que 0 |
| active | Boolean | Cuando se "borra" un producto, solo se desactiva |
| brandId / categoryId | UUID | |
| createdAt / updatedAt | DateTime | `createdAt` define la etiqueta "Nuevo" |

**ProductColor** (color de producto)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| productId | UUID | |
| name | String | Por ejemplo "Negro" |
| hex | String | Por ejemplo `#111111`, para el círculo del selector de color |
| code | String | Por ejemplo `NEG`; único dentro del producto |
| sortOrder | Int | El primer color es el que se muestra por defecto |
| active | Boolean | |

**ProductImage** (imagen): `id`, `productColorId`, `url`, `publicId` (identificador en Cloudinary, para poder borrarla), `alt`, `sortOrder`. Las fotos pertenecen a un color, así que cambian al elegir otro color.

**Variant** (variante)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| productColorId | UUID | |
| size | Int | Talla EU, de 34 a 48; única dentro del color |
| sku | String | Único y generado automáticamente: `VEL-STR2-NEG-41` |
| stock | Int | Restricción `CHECK (stock >= 0)` en la base de datos. Al público se le muestra con un tope de 10 (D-22) |
| active | Boolean | |

**Offer** (oferta)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| productId | UUID | |
| salePrice | Int | Precio de oferta; debe ser mayor que 0 y menor que `Product.price` |
| startsAt / endsAt | DateTime | `endsAt` debe ser posterior a `startsAt` |
| active | Boolean | Interruptor manual del administrador |
| createdById | UUID → Admin | |
| createdAt / updatedAt | DateTime | |

Una oferta está **vigente** cuando `active` es `true` y la fecha actual está entre `startsAt` y `endsAt`. Un producto no puede tener dos ofertas activas cuyas fechas se crucen; la API lo valida.

**Banner** (portada; existe un solo registro): `id`, `tag` ("NUEVA TEMPORADA"), `title`, `subtitle`, `imageUrl`, `imagePublicId`, `ctaLabel`, `ctaHref` (solo se permite una ruta interna), `updatedAt`, `updatedById`.

### Compra

**Address** (dirección)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| customerId | UUID | |
| label | String | Nombre para identificarla: "Casa", "Oficina" |
| recipientName | String | Nombre de quien recibe |
| phone | String | 10 dígitos |
| department | String | Uno de los 32 departamentos o Bogotá D.C., de una lista fija |
| city | String | |
| line1 | String | Por ejemplo "Calle 10 # 20-30" |
| notes | String? | Apartamento, torre, indicaciones |
| isDefault | Boolean | Solo una dirección predeterminada por cliente |

**CartItem** (ítem de carrito): `id`, `customerId`, `variantId`, `quantity` (de 1 a 5), `createdAt`. Restricción única `(customerId, variantId)`. El carrito del visitante vive solo en el navegador (`localStorage`).

**Order** (pedido)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| number | Int | Autoincremental; se muestra como `ZP-000123` |
| customerId | UUID | |
| status | OrderStatus | |
| subtotal / shippingCost / total | Int | Los calcula la API |
| shipRecipientName, shipPhone, shipDepartment, shipCity, shipLine1, shipNotes | String | Copia de la dirección al momento de comprar |
| expiresAt | DateTime | `createdAt` más 30 minutos; solo aplica mientras está en `PENDING_PAYMENT` |
| paidAt, shippedAt, deliveredAt, cancelledAt | DateTime? | |
| cancelReason | String? | `EXPIRED`, `ADMIN` o un texto libre |
| needsReview | Boolean | Se marca cuando llega un pago aprobado para un pedido ya cancelado (ver reglas de negocio) |
| createdAt / updatedAt | DateTime | |

**OrderItem** (ítem de pedido)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| orderId / variantId | UUID | |
| quantity | Int | |
| unitPrice | Int | Precio vigente al comprar, con la oferta aplicada si había una |
| listPrice | Int | Precio normal al comprar, para mostrar el ahorro |
| productName, colorName, size, sku | | Copia de los datos del producto |

**Payment** (pago; un pedido puede tener varios intentos)
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| orderId | UUID | |
| reference | String | Único, por ejemplo `ZP-000123-2`; es la referencia que se envía a Wompi |
| wompiTransactionId | String? | Único |
| status | PaymentStatus | |
| amountInCents | Int | |
| method | String? | `CARD`, `PSE`, `NEQUI`, etc. |
| rawEvent | Json? | Último evento recibido de Wompi, sin datos sensibles |
| createdAt / updatedAt | DateTime | |

### Auditoría

**AuditLog**
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID | |
| actorType | ActorType | |
| adminId / customerId | UUID? | |
| action | String | Por ejemplo `ADMIN_LOGIN_FAILED`, `PRODUCT_UPDATED`, `ORDER_STATUS_CHANGED`, `OFFER_CREATED`, `ADMIN_CREATED` |
| entity / entityId | String? | |
| details | Json? | Cambios de valores (antes y después). **Nunca** contraseñas, tokens ni datos de tarjeta |
| ip | String? | |
| createdAt | DateTime | Con índice, para consultar por fecha |
