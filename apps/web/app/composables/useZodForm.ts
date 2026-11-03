import type { z } from '@zapadictos/shared';

/** Respuesta de error de la API: { message, errors?: [{ field, message }] }. */
export interface ApiErrorBody {
  message?: string;
  errors?: { field: string | null; message: string }[];
}

export function apiErrorBody(error: unknown): ApiErrorBody {
  const data = (error as { data?: unknown })?.data;
  return data && typeof data === 'object' ? (data as ApiErrorBody) : {};
}

/**
 * Formulario validado con los mismos esquemas Zod que usa la API (D-21, D-26).
 * - `errors[campo]` tiene el primer mensaje de cada campo.
 * - `submit(fn)` valida, llama a `fn` con los datos ya transformados y, si la
 *   API responde con errores por campo, los muestra en el mismo lugar.
 */
export function useZodForm<S extends z.ZodType>(schema: S, initial: z.input<S>) {
  const values = reactive({ ...(initial as object) }) as z.input<S>;
  const errors = ref<Record<string, string>>({});
  const formError = ref<string | null>(null);
  const pending = ref(false);

  function setErrors(issues: { field: string | null; message: string }[]) {
    const next: Record<string, string> = {};
    for (const issue of issues) {
      const key = issue.field ?? '_form';
      next[key] ??= issue.message;
    }
    errors.value = next;
    formError.value = next._form ?? null;
  }

  async function submit(handler: (data: z.output<S>) => Promise<unknown>) {
    formError.value = null;
    const parsed = schema.safeParse(toRaw(values));
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => ({ field: i.path.join('.') || null, message: i.message })));
      return false;
    }
    errors.value = {};
    pending.value = true;
    try {
      await handler(parsed.data);
      return true;
    } catch (error) {
      const body = apiErrorBody(error);
      if (body.errors?.length) setErrors(body.errors);
      formError.value = body.message ?? 'No se pudo guardar. Inténtalo de nuevo.';
      return false;
    } finally {
      pending.value = false;
    }
  }

  function reset(next: z.input<S>) {
    Object.assign(values as object, next);
    errors.value = {};
    formError.value = null;
  }

  return { values, errors, formError, pending, submit, reset };
}
