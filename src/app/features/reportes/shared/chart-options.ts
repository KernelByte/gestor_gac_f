import type { EChartsOption } from 'echarts';
import type { PiramidePunto, SeriePunto, SeriePuntoMeta } from '../services/reportes.service';

const PALETTE = ['#6366f1', '#f97316', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#a855f7', '#ec4899'];

function baseTooltip(): any {
  return {
    trigger: 'axis',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 0,
    padding: [8, 12],
    textStyle: { color: '#f1f5f9', fontFamily: 'Manrope, sans-serif', fontSize: 12 },
  };
}

/**
 * Tooltip por elemento: solo aparece al posar el cursor sobre la barra/sector,
 * no al mover el mouse por cualquier parte de la gráfica. Es el adecuado para
 * las barras, que ya muestran su valor en la etiqueta.
 */
function itemTooltip(): any {
  return { ...baseTooltip(), trigger: 'item' };
}

/**
 * Leyenda común. El `itemGap` por defecto de ECharts (10 px) deja que las
 * entradas con etiquetas largas se solapen; con la separación y el tamaño
 * de marca explícitos, la leyenda respira y usa la tipografía de la app.
 */
function legendBase(): any {
  return {
    bottom: 0,
    itemGap: 28,
    itemWidth: 16,
    itemHeight: 9,
    icon: 'roundRect',
    textStyle: { color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontSize: 11 },
  };
}

export function pieOption(data: SeriePunto[], name = ''): EChartsOption | null {
  if (!data || data.length === 0) return null;
  return {
    color: PALETTE,
    tooltip: { trigger: 'item', backgroundColor: 'rgba(15,23,42,0.9)', textStyle: { color: '#f1f5f9' } },
    legend: legendBase(),
    series: [{
      name,
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      itemStyle: { borderRadius: 6, borderColor: '#ffffff', borderWidth: 2 },
      label: { show: true, formatter: '{b}: {c}' },
      data: data.map(d => ({ name: d.label, value: d.value })),
    }],
  };
}

export function barOption(data: SeriePunto[], opts: { horizontal?: boolean; valueSuffix?: string } = {}): EChartsOption | null {
  if (!data || data.length === 0) return null;
  const horizontal = !!opts.horizontal;
  const categories = data.map(d => d.label);
  const values = data.map(d => d.value);
  const axisCat = {
    type: 'category' as const,
    data: categories,
    axisLine: { lineStyle: { color: '#cbd5e1' } },
    axisLabel: { color: '#64748b' },
  };
  const axisVal = {
    type: 'value' as const,
    axisLine: { lineStyle: { color: '#cbd5e1' } },
    axisLabel: { color: '#64748b' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
  };
  return {
    color: PALETTE,
    tooltip: itemTooltip(),
    grid: { top: 20, right: 20, bottom: 30, left: horizontal ? 90 : 40 },
    xAxis: horizontal ? axisVal : axisCat,
    yAxis: horizontal ? axisCat : axisVal,
    series: [{
      type: 'bar',
      data: values,
      itemStyle: { borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0] },
      label: {
        show: true,
        position: horizontal ? 'right' : 'top',
        color: '#64748b',
        formatter: opts.valueSuffix ? (p: any) => `${p.value}${opts.valueSuffix}` : undefined,
      },
    }],
  };
}

/** Línea de valores reales vs línea de meta (referencia punteada). */
export function lineMetaOption(
  data: SeriePuntoMeta[],
  opts: { nombreValor?: string; nombreMeta?: string; area?: boolean } = {},
): EChartsOption | null {
  if (!data || data.length === 0) return null;
  return {
    color: ['#6366f1', '#94a3b8'],
    tooltip: baseTooltip(),
    legend: legendBase(),
    grid: { top: 20, right: 20, bottom: 78, left: 48 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.label),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
    },
    series: [
      {
        name: opts.nombreValor ?? 'Horas',
        type: 'line',
        smooth: true,
        data: data.map(d => d.value),
        symbol: 'circle',
        symbolSize: 7,
        areaStyle: opts.area !== false ? { opacity: 0.12 } : undefined,
        lineStyle: { width: 2 },
      },
      {
        name: opts.nombreMeta ?? 'Meta (50 h/precursor)',
        type: 'line',
        data: data.map(d => d.meta),
        symbol: 'none',
        lineStyle: { width: 2, type: 'dashed' },
      },
    ],
  };
}

const axisCatBase = () => ({
  type: 'category' as const,
  axisLine: { lineStyle: { color: '#cbd5e1' } },
  axisLabel: { color: '#64748b' },
});

const axisValBase = () => ({
  type: 'value' as const,
  axisLine: { lineStyle: { color: '#cbd5e1' } },
  axisLabel: { color: '#64748b' },
  splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
});

export interface SerieValores {
  nombre: string;
  valores: number[];
}

/** Varias líneas sobre las mismas categorías (ej. participaron vs sin informe). */
export function multiLineOption(
  categorias: string[],
  series: SerieValores[],
  opts: { colores?: string[]; area?: boolean } = {},
): EChartsOption | null {
  if (!categorias.length || !series.length) return null;
  return {
    color: opts.colores ?? PALETTE,
    tooltip: baseTooltip(),
    legend: legendBase(),
    grid: { top: 20, right: 20, bottom: 56, left: 40 },
    xAxis: { ...axisCatBase(), data: categorias },
    yAxis: axisValBase(),
    series: series.map(s => ({
      name: s.nombre,
      type: 'line' as const,
      smooth: true,
      data: s.valores,
      symbol: 'circle',
      symbolSize: 7,
      areaStyle: opts.area ? { opacity: 0.1 } : undefined,
      lineStyle: { width: 2 },
    })),
  };
}

/** Barras agrupadas por categoría (ej. publicadores / ancianos / siervos por grupo). */
export function multiBarOption(
  categorias: string[],
  series: SerieValores[],
  opts: { colores?: string[]; horizontal?: boolean } = {},
): EChartsOption | null {
  if (!categorias.length || !series.length) return null;
  const horizontal = !!opts.horizontal;
  const axisCat = { ...axisCatBase(), data: categorias };
  const axisVal = axisValBase();
  return {
    color: opts.colores ?? PALETTE,
    tooltip: itemTooltip(),
    legend: legendBase(),
    grid: { top: 20, right: 20, bottom: 56, left: horizontal ? 90 : 40 },
    xAxis: horizontal ? axisVal : axisCat,
    yAxis: horizontal ? axisCat : axisVal,
    series: series.map(s => ({
      name: s.nombre,
      type: 'bar' as const,
      data: s.valores,
      itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    })),
  };
}

/**
 * Pirámide poblacional: barras espejadas por sexo. Los valores masculinos van
 * en negativo hacia la izquierda; ejes y tooltip muestran el valor absoluto.
 */
export function pyramidOption(data: PiramidePunto[]): EChartsOption | null {
  if (!data || data.length === 0) return null;
  const abs = (v: unknown) => Math.abs(Number(v) || 0);
  return {
    color: ['#f97316', '#6366f1'],
    tooltip: {
      ...itemTooltip(),
      formatter: (p: any) => `${p.name}<br/>${p.marker} ${p.seriesName}: ${abs(p.value)}`,
    },
    legend: legendBase(),
    grid: { top: 20, right: 30, bottom: 56, left: 50 },
    xAxis: { ...axisValBase(), axisLabel: { color: '#64748b', formatter: (v: number) => String(abs(v)) } },
    yAxis: { ...axisCatBase(), data: data.map(d => d.rango) },
    series: [
      {
        name: 'M',
        type: 'bar',
        stack: 'piramide',
        data: data.map(d => -d.masculino),
        itemStyle: { borderRadius: [6, 0, 0, 6] },
        label: { show: true, position: 'left', color: '#64748b', formatter: (p: any) => (abs(p.value) || '') as any },
      },
      {
        name: 'F',
        type: 'bar',
        stack: 'piramide',
        data: data.map(d => d.femenino),
        itemStyle: { borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: 'right', color: '#64748b', formatter: (p: any) => (abs(p.value) || '') as any },
      },
    ],
  };
}

/**
 * Barras divergentes: la serie positiva sube y la negativa baja desde cero
 * (ej. reactivaciones vs nuevas inactividades por mes).
 */
export function divergingBarOption(
  categorias: string[],
  positiva: SerieValores,
  negativa: SerieValores,
): EChartsOption | null {
  if (!categorias.length) return null;
  const abs = (v: unknown) => Math.abs(Number(v) || 0);
  return {
    color: ['#22c55e', '#ef4444'],
    tooltip: {
      ...itemTooltip(),
      formatter: (p: any) => `${p.name}<br/>${p.marker} ${p.seriesName}: ${abs(p.value)}`,
    },
    legend: legendBase(),
    grid: { top: 20, right: 20, bottom: 56, left: 40 },
    xAxis: { ...axisCatBase(), data: categorias },
    yAxis: { ...axisValBase(), axisLabel: { color: '#64748b', formatter: (v: number) => String(abs(v)) } },
    series: [
      {
        name: positiva.nombre,
        type: 'bar',
        stack: 'flujo',
        data: positiva.valores,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
      {
        name: negativa.nombre,
        type: 'bar',
        stack: 'flujo',
        data: negativa.valores.map(v => -v),
        itemStyle: { borderRadius: [0, 0, 4, 4] },
      },
    ],
  };
}

export function lineOption(data: SeriePunto[], opts: { area?: boolean; smooth?: boolean } = {}): EChartsOption | null {
  if (!data || data.length === 0) return null;
  return {
    color: PALETTE,
    tooltip: baseTooltip(),
    grid: { top: 20, right: 20, bottom: 30, left: 40 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.label),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
    },
    series: [{
      type: 'line',
      smooth: opts.smooth !== false,
      data: data.map(d => d.value),
      symbol: 'circle',
      symbolSize: 8,
      areaStyle: opts.area ? { opacity: 0.15 } : undefined,
      lineStyle: { width: 2 },
    }],
  };
}
