import type { CheckoutSessionDto, OrderDto } from '@zapadictos/shared';

/** https://docs.wompi.co: ventana de pago sobre la página (D-10). */
const WIDGET_SRC = 'https://checkout.wompi.co/widget.js';

interface WompiWidgetResult {
  transaction?: { id: string; status: string };
}

declare global {
  interface Window {
    WidgetCheckout?: new (options: Record<string, unknown>) => {
      open: (callback: (result: WompiWidgetResult) => void) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadWidgetScript(): Promise<void> {
  if (!import.meta.client) return Promise.resolve();
  if (window.WidgetCheckout) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar la ventana de pago. Revisa tu conexión.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Abre el widget de Wompi para un pedido y ofrece el respaldo de /verify (D-10). */
export function useWompiCheckout() {
  const api = useAccountApi();

  async function pay(orderId: string): Promise<{ transactionId: string | null }> {
    await loadWidgetScript();
    const session = await api.post<CheckoutSessionDto>(`/payments/${orderId}/checkout`);
    if (!window.WidgetCheckout) throw new Error('No se pudo cargar la ventana de pago.');
    const widget = new window.WidgetCheckout({
      currency: session.currency,
      amountInCents: session.amountInCents,
      reference: session.reference,
      publicKey: session.publicKey,
      signature: { integrity: session.signature },
      redirectUrl: session.redirectUrl,
      expirationTime: session.expirationTime,
      customerData: session.customer,
    });
    return new Promise((resolve) => {
      widget.open((result) => resolve({ transactionId: result.transaction?.id ?? null }));
    });
  }

  function verify(orderId: string, transactionId: string) {
    return api.post<OrderDto>(`/payments/${orderId}/verify`, { transactionId });
  }

  return { pay, verify };
}
