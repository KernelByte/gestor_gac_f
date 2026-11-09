import type { EChartsOption } from 'echarts';

export const REDUCED_MOTION =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const EJE = {
  color: '#8b95a7',
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 600 as const,
};

const TOOLTIP = {
  backgroundColor: '#0f172a',
  borderColor: 'rgba(255,255,255,0.06)',
  borderWidth: 1,
  padding: [8, 12] as [number, number],
  textStyle: { color: '#e2e8f0', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" },
};

const REJILLA = { lineStyle: { color: 'rgba(148,163,184,0.12)', width: 1, type: 'solid' as const } };

export interface PuntoInformes { mes: string; recibidos: number }

/** Informes recibidos por mes: barras con su número encima; el último mes resaltado. */
export function graficoInformes(puntos: PuntoInformes[]): EChartsOption {
  return {
    animation: !REDUCED_MOTION,
    animationDuration: 650,
    animationEasing: 'cubicOut',
    animationDelay: (i: number) => 200 + i * 60,
    grid: { top: 22, right: 4, bottom: 22, left: 4 },
    xAxis: { type: 'category', data: puntos.map(p => p.mes),
      axisLine: { show: false }, axisTick: { show: false }, axisLabel: EJE },
    yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
      splitLine: REJILLA, splitNumber: 3 },
    tooltip: { ...TOOLTIP, trigger: 'axis', axisPointer: { type: 'none' },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return `<div style="font-size:12px;opacity:.65;margin-bottom:2px">${p.name}</div><strong>${p.value}</strong> informes`;
      } },
    series: [{
      name: 'Informes', type: 'bar', barMaxWidth: 34, barCategoryGap: '38%',
      data: puntos.map((p, i) => ({
        value: p.recibidos,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: i === puntos.length - 1 ? '#3b82f6' : 'rgba(96,165,250,0.45)',
        },
      })),
      label: { show: true, position: 'top', color: '#94a3b8', fontSize: 12, fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace" },
    }],
  };
}


