# 01 · Alcance

## Visión

Zapadictos es una tienda online de zapatillas. Un cliente encuentra zapatillas por marca, talla y precio, las compra y las paga en línea. Un administrador gestiona el catálogo, el stock, las ofertas y los pedidos desde un panel separado.

## Supuestos (confirmados el 2026-11-03)

- La universidad no impone tecnologías.
- Los pagos funcionan con Wompi en modo sandbox, sin dinero real.
- Los precios son en pesos colombianos (COP), con IVA incluido, y no se desglosa el IVA.
- Los envíos son solo dentro de Colombia, con tarifa fija de **$15.000**.
- El plan dura 12 semanas, del 2026-11-03 al **2027-01-26**. *La fecha de entrega está pendiente de confirmar.*

## Roles

Hay **dos accesos completamente separados**, cada uno con su tabla, su login, su cookie y su secreto JWT (ver [decisiones.md](decisiones.md), D-01).

| Rol | Quién es | Dónde entra | Qué puede hacer |
|---|---|---|---|
| Visitante | Persona sin sesión | — | Ver y filtrar el catálogo, ver el detalle de un producto, armar un carrito local |
| Cliente | Persona registrada en la tienda | `/cuenta/ingresar` | Lo mismo que el visitante, más comprar, pagar, ver sus pedidos y gestionar su perfil y sus direcciones |
| Administrador | Personal de la tienda | `/admin/ingresar` | Catálogo (productos, colores, tallas, fotos, stock), ofertas, pedidos, marcas y categorías, portada, ver clientes y gestionar administradores |

- Un administrador **no puede comprar** con su cuenta del panel. Si quiere comprar, se registra como cliente.
- Los administradores **no se registran**: el primero se crea con el seed y los demás los crea otro administrador.

## Historias de usuario

| ID | Módulo | Historia | Prioridad |
|---|---|---|---|
| HU-01 | Catálogo | Como visitante quiero filtrar por marca, talla, género, precio y ofertas para encontrar rápido lo que busco | Obligatoria |
| HU-02 | Catálogo | Como visitante quiero ordenar por precio o por novedad | Obligatoria |
| HU-03 | Catálogo | Como visitante quiero buscar un modelo o una marca por nombre | Obligatoria |
| HU-04 | Producto | Como visitante quiero ver fotos, descripción, colores y tallas de un modelo | Obligatoria |
| HU-05 | Producto | Como visitante quiero ver qué tallas están agotadas antes de elegir | Obligatoria |
| HU-06 | Cuentas | Como visitante quiero registrarme con correo y contraseña | Obligatoria |
| HU-07 | Cuentas | Como cliente quiero iniciar y cerrar sesión de forma segura | Obligatoria |
| HU-08 | Cuentas | Como cliente quiero editar mi perfil y gestionar mis direcciones de envío | Obligatoria |
| HU-09 | Carrito | Como visitante quiero agregar productos al carrito, cambiar la cantidad y quitarlos | Obligatoria |
| HU-10 | Carrito | Como cliente quiero que mi carrito se conserve al iniciar sesión | Obligatoria |
| HU-11 | Compra | Como cliente quiero pagar mi pedido con los medios de la pasarela (tarjeta, PSE y otros) | Obligatoria |
| HU-12 | Compra | Como cliente quiero ver el historial y el estado de mis pedidos | Obligatoria |
| HU-13 | Admin | Como administrador quiero crear y editar productos con sus colores, tallas, fotos y stock | Obligatoria |
| HU-14 | Admin | Como administrador quiero ver los pedidos y cambiar su estado | Obligatoria |
| HU-15 | Admin | Como administrador quiero iniciar sesión en un acceso separado del de los clientes | Obligatoria |
| HU-16 | Admin | Como administrador quiero programar, activar y desactivar ofertas por producto | Obligatoria |
| HU-17 | Catálogo | Como visitante quiero ver qué productos están en oferta y su precio anterior | Obligatoria |
| HU-18 | Admin | Como administrador quiero crear y editar marcas y categorías | Obligatoria |
| HU-19 | Admin | Como administrador quiero ver los clientes registrados y sus pedidos | Importante |
| HU-20 | Admin | Como administrador quiero crear y desactivar otros administradores | Importante |
| HU-21 | Admin | Como administrador quiero cambiar la foto y los textos de la portada | Si alcanza |

Si falta tiempo, se recorta empezando por "Si alcanza" y luego "Importante". Sin HU-21, la portada queda fija en el seed. Sin HU-20, los administradores se crean solo por seed.

## Fuera de alcance (versión 2)

- Reseñas, lista de deseos, cupones, campañas de descuento por porcentaje y recomendaciones.
- Correos de cualquier tipo: confirmación, recuperación de contraseña y notificaciones. Mientras tanto, si un cliente olvida su contraseña, un administrador no puede verla; queda documentado como limitación.
- Devoluciones, reembolsos automáticos e integración con transportadoras. El seguimiento del envío es solo el estado del pedido.
- Varios idiomas y medias tallas (por ejemplo 42.5).
- Inicio de sesión con Google y otros proveedores, y verificación en dos pasos.
