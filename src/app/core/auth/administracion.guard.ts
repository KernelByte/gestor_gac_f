import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from './auth.store';
import { puedeVerActas, puedeVerAdministracion, puedeVerAgenda, puedeVerReunionesAncianos } from './acceso-modulos';

/**
 * Guards del grupo Administración (/administracion/**). Las reglas viven en
 * acceso-modulos.ts para que el menú y las rutas digan lo mismo.
 */
function guardPor(regla: (s: AuthStore) => boolean): CanActivateFn {
  return () => {
    const store = inject(AuthStore);
    const router = inject(Router);
    if (!store.user()) return router.createUrlTree(['/login']);
    return regla(store) ? true : router.createUrlTree(['/']);
  };
}

/** Padre: entra quien pueda abrir al menos una opción del grupo. */
export const administracionGuard = guardPor(puedeVerAdministracion);
export const reunionesAncianosGuard = guardPor(puedeVerReunionesAncianos);
export const actasGuard = guardPor(puedeVerActas);
export const agendaGuard = guardPor(puedeVerAgenda);
