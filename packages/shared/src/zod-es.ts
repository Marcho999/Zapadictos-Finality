import { z } from 'zod';

// Mensajes de validación en español para la web y la API.
// Se importa desde index.ts, así que basta con importar @zapadictos/shared.
z.config(z.locales.es());

export { z };
