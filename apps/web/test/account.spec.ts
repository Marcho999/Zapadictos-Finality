import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import AddressForm from '~/components/store/AddressForm.vue';
import { safeRedirect } from '~/composables/sessionClient';

describe('safeRedirect (evita redirecciones abiertas)', () => {
  it('acepta rutas internas con el prefijo esperado', () => {
    expect(safeRedirect('/checkout', '/', '/cuenta')).toBe('/checkout');
    expect(safeRedirect('/admin/productos?tab=oferta', '/admin', '/admin/productos')).toBe('/admin/productos?tab=oferta');
  });

  it('rechaza otros sitios y trucos para salir del dominio', () => {
    for (const target of ['https://malicioso.example', '//malicioso.example', '/\\malicioso.example', 'javascript:alert(1)', undefined, ['/a']]) {
      expect(safeRedirect(target, '/', '/cuenta')).toBe('/cuenta');
    }
    expect(safeRedirect('/tienda', '/admin', '/admin/productos')).toBe('/admin/productos');
  });
});

describe('AddressForm', () => {
  it('valida con los esquemas compartidos y normaliza el celular antes de guardar', async () => {
    let saved: Record<string, unknown> | null = null;
    const form = await mountSuspended(AddressForm, {
      props: { save: async (data: Record<string, unknown>) => void (saved = data) },
    });

    await form.find('form').trigger('submit');
    await new Promise((r) => setTimeout(r, 0));
    expect(saved).toBeNull();
    expect(form.text()).toContain('Elige un departamento');
    expect(form.text()).toContain('Escribe un celular de 10 dígitos');

    const inputs = form.findAll('input');
    await inputs[0].setValue('Casa');
    await inputs[1].setValue('Laura Gómez');
    await inputs[2].setValue('300 123 4567');
    await form.find('select').setValue('Antioquia');
    await inputs[3].setValue('Medellín');
    await inputs[4].setValue('Calle 45 # 12-30');
    await form.find('form').trigger('submit');
    await new Promise((r) => setTimeout(r, 0));
    expect(saved).toMatchObject({ label: 'Casa', phone: '3001234567', department: 'Antioquia', notes: null });
  });
});
