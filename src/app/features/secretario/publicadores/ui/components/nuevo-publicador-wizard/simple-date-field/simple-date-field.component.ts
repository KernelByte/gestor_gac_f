import { Component, Input, forwardRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectPickerComponent, PickerOption } from '../../../../../../../shared/components/select-picker/select-picker.component';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Fecha como tres selectores — Día, Mes, Año — en vez de un calendario.
 *
 * Existe porque el calendario emergente compartido (`app-date-picker`) se
 * posiciona con `position: absolute` respecto a su propio campo: dentro del
 * cuerpo con scroll del asistente queda recortado o tapando otros campos (ver
 * captura del bug). Estos tres `app-select-picker` abren su lista con la API
 * `popover`, que vive en el *top layer* y no sufre ese recorte — y además
 * evita la navegación mes a mes para llegar a una fecha de nacimiento lejana:
 * el año se busca escribiendo, como cualquier lista larga de select-picker.
 */
@Component({
  selector: 'app-simple-date-field',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectPickerComponent],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SimpleDateFieldComponent),
    multi: true,
  }],
  template: `
    <div class="grid grid-cols-[4.75rem_1fr_6rem] gap-2">
      <app-select-picker
        ariaLabel="Día" placeholder="Día" [clearable]="false" [searchable]="false"
        [disabled]="disabled"
        [options]="dayOptions()"
        [ngModel]="day()" [ngModelOptions]="{ standalone: true }"
        (ngModelChange)="onDayChange($event)">
      </app-select-picker>

      <app-select-picker
        ariaLabel="Mes" placeholder="Mes" [clearable]="false" [searchable]="false"
        [disabled]="disabled"
        [options]="monthOptions()"
        [ngModel]="month()" [ngModelOptions]="{ standalone: true }"
        (ngModelChange)="onMonthChange($event)">
      </app-select-picker>

      <app-select-picker
        ariaLabel="Año" placeholder="Año" [clearable]="false"
        [disabled]="disabled"
        [options]="yearOptions()"
        [ngModel]="year()" [ngModelOptions]="{ standalone: true }"
        (ngModelChange)="onYearChange($event)">
      </app-select-picker>
    </div>
  `,
})
export class SimpleDateFieldComponent implements ControlValueAccessor {
  /** Fecha máxima seleccionable, ISO 'YYYY-MM-DD'. Sin ella no hay tope. */
  @Input() maxDate: string | null = null;
  @Input() minYear = 1900;
  disabled = false;

  private readonly currentYear = new Date().getFullYear();

  day = signal<number | null>(null);
  month = signal<number | null>(null);
  year = signal<number | null>(null);

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  private maxDateParts = computed(() => {
    if (!this.maxDate) return null;
    const [y, m, d] = this.maxDate.split('-').map(Number);
    return { y, m, d };
  });

  private maxYear = computed(() => this.maxDateParts()?.y ?? this.currentYear + 1);

  yearOptions = computed<PickerOption[]>(() => {
    const opts: PickerOption[] = [];
    for (let y = this.maxYear(); y >= this.minYear; y--) opts.push({ value: y, label: String(y) });
    return opts;
  });

  /** Los meses posteriores al tope quedan fuera de la lista en vez de
   *  permitir elegirlos y rechazarlos después. */
  monthOptions = computed<PickerOption[]>(() => {
    const max = this.maxDateParts();
    const y = this.year();
    const upper = max && y === max.y ? max.m : 12;
    return MESES.slice(0, upper).map((label, i) => ({ value: i + 1, label }));
  });

  dayOptions = computed<PickerOption[]>(() => {
    const y = this.year() ?? this.currentYear;
    const m = this.month() ?? 1;
    let total = new Date(y, m, 0).getDate();
    const max = this.maxDateParts();
    if (max && y === max.y && m === max.m) total = Math.min(total, max.d);
    const opts: PickerOption[] = [];
    for (let d = 1; d <= total; d++) opts.push({ value: d, label: String(d) });
    return opts;
  });

  onDayChange(value: number | null) {
    this.day.set(value);
    this.emit();
  }

  onMonthChange(value: number | null) {
    this.month.set(value);
    // Un día que ya no cabe en el mes nuevo (31 en un mes de 30, por ejemplo)
    // se recorta en vez de dejar una fecha inválida a medio formar.
    const maxDay = this.dayOptions().length;
    if (this.day() && this.day()! > maxDay) this.day.set(maxDay || null);
    this.emit();
  }

  onYearChange(value: number | null) {
    this.year.set(value);
    const maxMonth = this.monthOptions().length;
    if (this.month() && this.month()! > maxMonth) this.month.set(maxMonth || null);
    const maxDay = this.dayOptions().length;
    if (this.day() && this.day()! > maxDay) this.day.set(maxDay || null);
    this.emit();
  }

  private emit() {
    this.onTouched();
    const d = this.day(), m = this.month(), y = this.year();
    if (d && m && y) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      this.onChange(iso);
    } else {
      this.onChange(null);
    }
  }

  writeValue(value: string | null): void {
    if (!value) {
      this.day.set(null);
      this.month.set(null);
      this.year.set(null);
      return;
    }
    const [y, m, d] = value.split('-').map(Number);
    this.year.set(y || null);
    this.month.set(m || null);
    this.day.set(d || null);
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
