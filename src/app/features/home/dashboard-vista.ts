import { AuthStore, ROL_ADMINISTRADOR, ROL_GESTOR } from '../../core/auth/auth.store';

export type VistaDashboard = 'secretario' | 'coordinador' | 'superintendente' | 'general';

export const VISTAS: { id: VistaDashboard; etiqueta: string }[] = [
  { id: 'secretario', etiqueta: 'Secretario' },
  { id: 'coordinador', etiqueta: 'Coordinador' },
  { id: 'superintendente', etiqueta: 'Superintendente' },
  { id: 'general', etiqueta: 'Publicador' },
];

/** Nombre de cada panel (para las pestañas del teléfono), en el orden en que se muestran. */
export const PANELES: Record<VistaDashboard, string[]> = {
  secretario: ['Mi semana', 'Informes', 'Pendientes', 'Por mes'],
  coordinador: ['Mi semana', 'Programa', 'Discursos', 'Pendientes'],
  superintendente: ['Mi semana', 'Territorios', 'Salidas', 'Informes'],
  general: ['Mi semana', 'Lectura', 'Salidas', 'Pendientes'],
};

const CLAVE_VISTA_GUARDADA = 'gac.dashboard.vista';

/** Quien administra (Administrador / Gestor) elige qué vista revisar. */
export function puedeElegirVista(store: Pick<AuthStore, 'hasRole'>): boolean {
  return store.hasRole(ROL_ADMINISTRADOR) || store.hasRole(ROL_GESTOR);
}

/** El rol es único por usuario (core/roles.py); Administrador y Gestor usan la vista guardada. */
export function resolverVista(store: Pick<AuthStore, 'hasRole'>, guardada: string | null): VistaDashboard {
  if (puedeElegirVista(store)) {
    return VISTAS.some(v => v.id === guardada) ? (guardada as VistaDashboard) : 'secretario';
  }
  if (store.hasRole('Secretario')) return 'secretario';
  if (store.hasRole('Coordinador')) return 'coordinador';
  if (store.hasRole('Superintendente de servicio')) return 'superintendente';
  return 'general';
}

export function leerVistaGuardada(): string | null {
  try { return localStorage.getItem(CLAVE_VISTA_GUARDADA); } catch { return null; }
}

export function guardarVista(v: VistaDashboard): void {
  try { localStorage.setItem(CLAVE_VISTA_GUARDADA, v); } catch { /* sin almacenamiento: dura la sesión */ }
}
