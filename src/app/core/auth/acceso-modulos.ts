import { AuthStore } from './auth.store';

/**
 * Quién entra a cada módulo. Son las mismas condiciones que los guards de sus
 * rutas (secretario/routes.ts, app.routes.ts y cada *.routes.ts) para que el
 * menú lateral y la paleta de comandos no ofrezcan nada que la ruta rechace ni
 * escondan una ruta permitida.
 */
const algunRol = (s: AuthStore, roles: string[]) => roles.some(r => s.hasRole(r));
const algunPermiso = (s: AuthStore, permisos: string[]) => permisos.some(p => s.hasPermission(p));

export function puedeVerReuniones(s: AuthStore): boolean {
  return algunPermiso(s, [
    'reuniones.ver', 'reuniones.entre_semana', 'reuniones.fin_semana', 'reuniones.logistica',
    'reuniones.discursos', 'reuniones.asistencia', 'reuniones.configuracion',
  ]);
}

export function puedeVerInformes(s: AuthStore): boolean {
  return algunRol(s, ['Administrador', 'Secretario', 'Coordinador', 'Superintendente de servicio'])
    || algunPermiso(s, [
      'informes.ver', 'informes.editar', 'informes.editar_todos', 'informes.historial',
      'informes.historial_editar', 'informes.historial_todos', 'informes.enviar', 'informes.enviar_todos',
    ]);
}

/** Espejo de publicadoresPermissionGuard (el Gestor entra por "Acceso app"). */
export function puedeVerPublicadores(s: AuthStore): boolean {
  return algunRol(s, ['Administrador', 'Gestor Aplicación', 'Secretario', 'Coordinador', 'Superintendente de servicio'])
    || algunPermiso(s, ['publicadores.ver', 'grupos.ver', 'contactos.ver', 'publicadores.acceso_app']);
}

export function puedeVerExhibidores(s: AuthStore): boolean {
  return algunPermiso(s, [
    'exhibidores.ver', 'exhibidores.programacion', 'exhibidores.ubicaciones',
    'exhibidores.participantes', 'exhibidores.configuracion',
  ]);
}

/** 'reportes.ver' no abre ninguna ruta, así que no cuenta. */
export function puedeVerReportes(s: AuthStore): boolean {
  return algunPermiso(s, [
    'reportes.precursores', 'reportes.publicadores', 'reportes.predicacion', 'reportes.logistica',
  ]);
}

export function puedeVerTerritorios(s: AuthStore): boolean {
  return s.hasPermission('territorios.ver');
}

/** Configuración de la congregación (no la del sistema, que es del Administrador). */
export function puedeVerConfiguracion(s: AuthStore): boolean {
  return algunRol(s, ['Administrador', 'Secretario', 'Coordinador']) || s.hasPermission('configuracion.ver');
}

// ── Administración (antes «Secretario») ─────────────────────────────────────
// Cada opción del grupo tiene su propia regla; el grupo se muestra si alguna
// aplica. Son el espejo de los guards de features/secretario-tools/routes.ts (URL /administracion).

/**
 * Coordinador por contenido y sin distinguir mayúsculas, igual que
 * `es_coordinador` del backend (ILIKE '%coordinador%').
 */
export function esCoordinador(s: AuthStore): boolean {
  return s.rolesEfectivos().some(r => r.includes('coordinador'));
}

/** Agenda, Visita del SC y Transferencias. */
export function esSecretarioOAdmin(s: AuthStore): boolean {
  return algunRol(s, ['Administrador', 'Secretario']);
}

/**
 * Mi Agenda (/agenda): calendario y tareas en una sola pantalla. Va fuera de Administración.
 * - 'secretaria': Secretario y Administrador (pendientes de la secretaría).
 * - 'personal': el coordinador y los ancianos con cuenta (sus recordatorios y reuniones).
 * - 'tareas': cualquiera con acceso a Tareas; solo ve la lista de sus tareas.
 * El backend vuelve a comprobarlo en /secretario/agenda, /agenda y /tareas.
 */
export type AccesoAgenda = 'secretaria' | 'personal' | 'tareas';

export function modoAgenda(s: AuthStore): AccesoAgenda | null {
  if (esSecretarioOAdmin(s)) return 'secretaria';
  if (esCoordinador(s) || !!s.user()?.es_anciano) return 'personal';
  if (s.hasPermission('tareas.ver')) return 'tareas';
  return null;
}

export function puedeVerAgenda(s: AuthStore): boolean {
  return modoAgenda(s) !== null;
}

/** Crea, edita y convoca las reuniones de organización. */
export function puedeGestionarReunionesAncianos(s: AuthStore): boolean {
  return esSecretarioOAdmin(s) || esCoordinador(s);
}

/** Los gestores, y quien esté convocado a alguna reunión (la ve y propone puntos). */
export function puedeVerReunionesAncianos(s: AuthStore): boolean {
  // es_anciano ya no basta: el backend solo deja entrar a quien fue convocado.
  return puedeGestionarReunionesAncianos(s) || !!s.user()?.participa_reuniones;
}

/** El Coordinador ve las actas de ancianos, pero no las edita. */
export function puedeVerActas(s: AuthStore): boolean {
  return esSecretarioOAdmin(s) || esCoordinador(s);
}

export function puedeEditarActas(s: AuthStore): boolean {
  return esSecretarioOAdmin(s);
}

export function puedeVerAdministracion(s: AuthStore): boolean {
  return esSecretarioOAdmin(s) || puedeVerReunionesAncianos(s) || puedeVerActas(s);
}

/** Primera opción del grupo que esta persona puede abrir, en el orden del menú. */
export function primeraRutaAdministracion(s: AuthStore): string | null {
  if (puedeVerReunionesAncianos(s)) return '/administracion/reuniones-teocraticas';
  if (puedeVerActas(s)) return '/administracion/actas-reunion';
  return null;
}
