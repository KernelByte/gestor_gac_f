import { Pipe, PipeTransform } from '@angular/core';

/**
 * "HH:MM" (24h, como viaja desde el backend) → "04:30 PM".
 *
 * La hora va con dos dígitos a propósito: en los listados de turnos las horas
 * se leen en columna con `data-num` (tabular), y sin el cero a la izquierda las
 * filas se desalinean. Mismo formato que muestra `app-time-picker`.
 */
@Pipe({ name: 'hora12', standalone: true })
export class Hora12Pipe implements PipeTransform {
  transform(hora: string | null | undefined): string {
    if (!hora) return '';
    const [h, m] = hora.split(':');
    const horas = Number(h);
    const minutos = Number(m);
    if (Number.isNaN(horas) || Number.isNaN(minutos)) return hora;

    const meridiano = horas < 12 ? 'AM' : 'PM';
    const h12 = horas % 12 === 0 ? 12 : horas % 12;
    return `${String(h12).padStart(2, '0')}:${String(minutos).padStart(2, '0')} ${meridiano}`;
  }
}
