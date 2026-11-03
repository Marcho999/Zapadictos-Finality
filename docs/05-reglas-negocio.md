# 05 · Reglas de negocio

## Precios y ofertas

- **Precio vigente** = `Offer.salePrice` si el producto tiene una oferta vigente; si no, `Product.price`. Lo calcula siempre la API.
- El frontend **nunca** envía precios, totales ni stock; solo envía identificadores y cantidades.
- El envío es una tarifa fija de $15.000, configurada en la variable de entorno `SHIPPING_COST`. No hay envío gratis en el MVP.
- `total = subtotal + shippingCost`, donde `subtotal = Σ unitPrice × quantity`.
- En la tienda, un producto en oferta muestra el precio normal tachado, el precio de oferta y la etiqueta "Oferta".
- Si una oferta empieza o termina mientras el producto está en un carrito, el carrito muestra el precio nuevo con el aviso "El precio de este producto cambió". El precio queda fijo recién al crear el pedido.
- Se puede programar una oferta futura mientras hay otra vigente, siempre que sus fechas no se crucen. Solo se pueden borrar las ofertas programadas que aún no empiezan; las demás se desactivan.

## Etiquetas

| Etiqueta | Dónde | Regla |
|---|---|---|
| Nuevo | Tarjeta del producto | `createdAt` de hace 30 días o menos |
| Oferta | Tarjeta y detalle | Tiene una oferta vigente |
| Últimos pares en X | Tarjeta (si se filtró por talla X), detalle y carrito | 3 unidades o menos en esa talla |
| Agotado | Talla en el detalle (tachada) | 0 unidades en esa talla |
| Stock bajo | Admin, listado de productos | 5 unidades o menos sumando todas las tallas y colores, sin estar en 0 |
| Agotado | Admin, listado de productos | 0 unidades en total |

## Carrito

- **Visitante:** el carrito se guarda en `localStorage` como `[{ variantId, quantity }]`. Para mostrarlo, se consultan los datos actuales con `GET /variants?ids=`.
- **Cliente:** el carrito se guarda en la base de datos.
- **Al iniciar sesión** se ejecuta `POST /cart/merge`. Si una variante está en los dos carritos, se suman las cantidades, con un tope de 5 por ítem y del stock disponible. Después se vacía el carrito local.
- La cantidad por ítem va de 1 a 5. Agregar al carrito **no reserva stock**: lo reserva crear el pedido.
- Las variantes inactivas o sin stock se muestran como "No disponible" y no dejan crear el pedido hasta que se quiten.

## Pedidos y stock

Así se crea un pedido (`POST /orders`), todo dentro de **una sola transacción**:

1. Se valida que el carrito no esté vacío y que la dirección pertenezca al cliente.
2. Para cada ítem se descuenta el stock con una operación condicionada: `UPDATE variant SET stock = stock - n WHERE id = ? AND stock >= n AND active`. Si alguna fila no se actualiza, se deshace toda la transacción y la API responde **409** con la lista de tallas que no tienen stock suficiente.
3. Se crea el pedido en `PENDING_PAYMENT`, con `expiresAt` 30 minutos después, junto con las copias de los ítems y de la dirección.
4. Se vacía el carrito.

Un cliente puede tener **como máximo 3 pedidos en `PENDING_PAYMENT`** al mismo tiempo, para que nadie bloquee el stock creando pedidos sin pagar.

### Estados y transiciones

```
PENDING_PAYMENT ──(pago aprobado)──► PAID ──(admin)──► SHIPPED ──(admin)──► DELIVERED
      │                               │
      ├──(vence a los 30 min)──► CANCELLED ◄──(admin)──┘
      └──(admin)──────────────► CANCELLED
```

| Desde | Hacia | Quién | Efecto |
|---|---|---|---|
| PENDING_PAYMENT | PAID | Sistema (webhook o verificación) | Se registra `paidAt` |
| PENDING_PAYMENT | CANCELLED | Sistema (vencimiento) o admin | **Devuelve el stock** |
| PAID | SHIPPED | Admin | Se registra `shippedAt` |
| PAID | CANCELLED | Admin | **Devuelve el stock**. El reembolso se hace a mano, fuera del sistema |
| SHIPPED | DELIVERED | Admin | Se registra `deliveredAt` |

- No hay otras transiciones; la API rechaza cualquier otra con **409**.
- Cada cambio de estado queda registrado en `AuditLog`.
- **Vencimiento:** una tarea programada corre cada minuto. Cancela los pedidos `PENDING_PAYMENT` con `expiresAt < now` y devuelve su stock, en una transacción por pedido.

## Pagos (Wompi)

1. El cliente pulsa "Pagar" y se llama a `POST /payments/:orderId/checkout`. La API crea un `Payment` en `PENDING` con una referencia nueva y devuelve los datos para el widget:
   - `firma = SHA256(referencia + montoEnCentavos + "COP" + fechaExpiracion + secretoIntegridad)`
   - La fecha de expiración es `Order.expiresAt`, así que Wompi tampoco deja pagar un pedido vencido.
2. El widget de Wompi se abre como una ventana sobre la página; el navegador no sale del sitio.
3. Wompi envía el evento `transaction.updated` a `POST /payments/webhook`. La API:
   - **verifica el checksum** del evento (SHA-256 de las propiedades indicadas, más el `timestamp` y el secreto de eventos) y lo rechaza si no coincide;
   - busca el `Payment` por `reference` y comprueba que el monto y la moneda coincidan;
   - es **idempotente**: si el evento ya fue procesado, no hace nada;
   - con `APPROVED`, marca el pago como `APPROVED` y el pedido como `PAID`;
   - con `DECLINED`, `VOIDED` o `ERROR`, marca el pago con ese estado y deja el pedido en `PENDING_PAYMENT`, para que el cliente **pueda reintentar** con otro medio hasta que el pedido venza.
4. **Respaldo:** cuando el widget se cierra, el frontend llama a `POST /payments/:orderId/verify`. La API le pregunta a Wompi el estado de la transacción de servidor a servidor y aplica las mismas reglas.
5. **Caso límite:** si llega un pago aprobado para un pedido que ya se canceló por vencimiento, la API intenta reservar el stock de nuevo:
   - si lo consigue, el pedido pasa a `PAID`;
   - si no, el pedido queda `CANCELLED` con `needsReview = true` y aparece en el resumen del admin para que haga el reembolso a mano.
6. En el entorno local, el webhook llega por un túnel de `cloudflared`.

## Administradores

- El primer administrador se crea con el seed, usando las variables `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. No hay registro público de administradores.
- Todos los administradores tienen los mismos permisos.
- Quien crea a un administrador define una contraseña temporal, que debe tener al menos 12 caracteres. El nuevo administrador queda con `mustChangePassword = true` y debe cambiarla en su primer ingreso.
- Un administrador **no puede desactivarse a sí mismo**, y siempre debe quedar **al menos un administrador activo**.
- Desactivar a un administrador revoca todas sus sesiones al instante.
- Restablecer la contraseña de otro administrador le asigna una contraseña temporal nueva y revoca sus sesiones.
- Los administradores solo pueden **ver** a los clientes: no pueden editarlos, desactivarlos ni ver sus contraseñas.

## Marcas, categorías y portada

- Una marca o categoría **solo se puede desactivar si no tiene productos activos**. Nunca se borra, para no romper los pedidos antiguos.
- `Category.sortOrder` define el orden de "Compra por categoría" en el inicio; la primera tarjeta sale en negro.
- **Portada:** los cambios se guardan con "Publicar portada". Los botones Hombre y Mujer del bloque principal son fijos; solo el botón principal es configurable, y apunta a una página de una lista fija.

## Cuentas de cliente y direcciones

- Un cliente se registra con nombre, correo, contraseña, celular opcional y la aceptación de la política de datos; al registrarse queda con la sesión iniciada.
- La sesión dura 7 días desde el último uso (D-30). Los clientes no tienen bloqueo de cuenta; solo el límite de 5 intentos por minuto por IP.
- Cada cliente puede guardar hasta 5 direcciones. La primera queda como predeterminada, y siempre hay exactamente una predeterminada: al borrarla, pasa a serlo la más antigua.
- El departamento sale de una lista fija con los 32 departamentos y Bogotá D.C.

## Validaciones de datos

| Dato | Regla |
|---|---|
| Correo | Formato válido; se guarda en minúsculas |
| Contraseña de cliente | Mínimo 8 y máximo 72 caracteres, con al menos una letra y un número |
| Contraseña de administrador | Mínimo 12 caracteres |
| Teléfono | 10 dígitos que empiezan por 3 |
| Talla | Número entero de 34 a 48 |
| Precio | Número entero mayor que 0 y menor o igual a 5.000.000 |
| Hex de color | Formato `#RRGGBB` |
| Slug y referencia | Se generan automáticamente y el administrador puede editarlos; deben ser únicos |
