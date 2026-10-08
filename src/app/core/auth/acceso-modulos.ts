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
