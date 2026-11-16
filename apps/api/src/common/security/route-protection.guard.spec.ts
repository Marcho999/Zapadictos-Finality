import { CanActivate, ExecutionContext, Injectable, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { Public, RouteProtectionGuard } from './route-protection.guard.js';

@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

class PublicController {
  @Public()
  open() {}
}

class GuardedController {
  @UseGuards(FakeAuthGuard)
  protectedMethod() {}
}

class ForgottenController {
  unmarked() {}
}

function contextFor(instance: object, method: string): ExecutionContext {
  const handler = (instance as Record<string, () => void>)[method];
  return {
    getHandler: () => handler,
    getClass: () => instance.constructor,
  } as unknown as ExecutionContext;
}

describe('RouteProtectionGuard', () => {
  const guard = new RouteProtectionGuard(new Reflector());

  it('deja pasar una ruta marcada con @Public()', () => {
    expect(guard.canActivate(contextFor(new PublicController(), 'open'))).toBe(true);
  });

  it('deja pasar una ruta que ya tiene @UseGuards(...)', () => {
    expect(guard.canActivate(contextFor(new GuardedController(), 'protectedMethod'))).toBe(true);
  });

  it('bloquea una ruta sin @Public() ni @UseGuards(...)', () => {
    expect(() => guard.canActivate(contextFor(new ForgottenController(), 'unmarked'))).toThrow(InternalServerErrorException);
  });

  it('no revela el nombre del controlador en el mensaje de la excepción', () => {
    try {
      guard.canActivate(contextFor(new ForgottenController(), 'unmarked'));
      expect.unreachable();
    } catch (error) {
      expect(JSON.stringify((error as InternalServerErrorException).getResponse())).not.toMatch(/ForgottenController/);
    }
  });
});
