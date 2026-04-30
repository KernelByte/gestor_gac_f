import type { EChartsOption } from 'echarts';
import type { SeriePunto } from '../services/reportes.service';

const PALETTE = ['#6366f1', '#f97316', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#a855f7', '#ec4899'];

function baseTooltip(): any {
  return {
    trigger: 'axis',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 0,
    textStyle: { color: '#f1f5f9' },
  };
}

export function pieOption(data: SeriePunto[], name = ''): EChartsOption | null {
  if (!data || data.length === 0) return null;
  return {
    color: PALETTE,
    tooltip: { trigger: 'item', backgroundColor: 'rgba(15,23,42,0.9)', textStyle: { color: '#f1f5f9' } },
    legend: { bottom: 0, textStyle: { color: '#64748b' } },
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
    tooltip: baseTooltip(),
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
