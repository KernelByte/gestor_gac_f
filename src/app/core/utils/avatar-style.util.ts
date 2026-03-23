/**
 * Devuelve clases Tailwind para el color de fondo/texto/ring del avatar de iniciales
 * en listados. Determinista por la primera letra del nombre.
 * - Modo claro: tonos sutiles y profesionales (bg-*-50, text-*-600, ring discreto).
 * - Modo oscuro: pastel con buen contraste (bg-*-900/40, text-*-300).
 * Usar con clases base: w-10 h-10 rounded-full flex items-center justify-center
 * shrink-0 font-semibold text-sm shadow-sm ring-1 ring-white border border-white/50
 */
export function getInitialAvatarStyle(nameOrText: string): string {
  const n = (nameOrText || '').toLowerCase();
  const char = n.charCodeAt(0);
  const i = Math.abs(char) % 10;
  const palette: string[] = [
    'bg-purple-50 text-purple-600 ring-purple-200/50 dark:bg-purple-900/40 dark:text-purple-300 dark:ring-purple-400/30',
    'bg-blue-50 text-blue-600 ring-blue-200/50 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-400/30',
    'bg-emerald-50 text-emerald-600 ring-emerald-200/50 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-400/30',
    'bg-orange-50 text-orange-600 ring-orange-200/50 dark:bg-orange-900/40 dark:text-orange-300 dark:ring-orange-400/30',
    'bg-cyan-50 text-cyan-600 ring-cyan-200/50 dark:bg-cyan-900/40 dark:text-cyan-300 dark:ring-cyan-400/30',
    'bg-violet-50 text-violet-600 ring-violet-200/50 dark:bg-violet-900/40 dark:text-violet-300 dark:ring-violet-400/30',
    'bg-rose-50 text-rose-600 ring-rose-200/50 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-400/30',
    'bg-amber-50 text-amber-600 ring-amber-200/50 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-400/30',
    'bg-teal-50 text-teal-600 ring-teal-200/50 dark:bg-teal-900/40 dark:text-teal-300 dark:ring-teal-400/30',
    'bg-indigo-50 text-indigo-600 ring-indigo-200/50 dark:bg-indigo-900/40 dark:text-indigo-300 dark:ring-indigo-400/30',
  ];
  return palette[i];
}
