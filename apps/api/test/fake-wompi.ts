import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';

/** Servidor que imita GET /v1/transactions/:id de Wompi para las pruebas. */
export class FakeWompi {
  readonly transactions = new Map<string, Record<string, unknown>>();
  private server?: Server;

  start(port = 4999) {
    this.server = createServer((req, res) => {
      const match = req.url?.match(/^\/v1\/transactions\/([\w-]+)$/);
      const tx = match && this.transactions.get(match[1]);
      res.setHeader('Content-Type', 'application/json');
      if (!tx) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: { type: 'NOT_FOUND_ERROR' } }));
        return;
      }
      res.end(JSON.stringify({ data: tx }));
    });
    return new Promise<void>((resolve) => this.server!.listen(port, '127.0.0.1', resolve));
  }

  stop() {
    return new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}

/** Evento transaction.updated firmado como lo firma Wompi. */
export function signedEvent(
  transaction: { id: string; status: string; amount_in_cents: number; reference: string; currency?: string },
  secret = process.env.WOMPI_EVENTS_SECRET!,
) {
  const tx = { currency: 'COP', payment_method_type: 'CARD', ...transaction };
  const timestamp = Math.floor(Date.now() / 1000);
  const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const checksum = createHash('sha256')
    .update(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${secret}`)
    .digest('hex');
  return {
    event: 'transaction.updated',
    data: { transaction: tx },
    environment: 'test',
    signature: { properties, checksum },
    timestamp,
    sent_at: new Date().toISOString(),
  };
}
