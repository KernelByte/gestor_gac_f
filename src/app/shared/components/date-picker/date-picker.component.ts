import { Component, Input, signal, computed, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type ViewMode = 'calendar' | 'months' | 'years';

@Component({
   selector: 'app-date-picker',
   standalone: true,
   imports: [CommonModule],
   providers: [
      {
         provide: NG_VALUE_ACCESSOR,
         useExisting: forwardRef(() => DatePickerComponent),
         multi: true
      }
   ],
   template: `
    <div class="relative">
      <!-- Backdrop -->
      <div *ngIf="isOpen()" (click)="close()" class="fixed inset-0 z-40"></div>
      
      <!-- Trigger Button -->
      <button
        type="button"
        [disabled]="disabled"
        (click)="toggle()"
        class="w-full h-11 px-3 bg-white border rounded-xl text-sm font-medium shadow-sm transition-all outline-none flex items-center gap-3 group"
        [ngClass]="{
          'border-slate-200 hover:border-slate-300 focus:border-brand-orange': !disabled,
          'border-slate-100 bg-slate-50 cursor-not-allowed': disabled
        }"
      >
        <svg class="w-4 h-4 text-slate-400 group-hover:text-brand-orange transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span [ngClass]="selectedDate() ? 'text-slate-800' : 'text-slate-400'">
          {{ displayValue() }}
        </span>
      </button>

      <!-- Calendar Dropdown -->
      <div *ngIf="isOpen()" class="absolute top-full left-0 mt-1.5 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden w-[280px]" style="animation: fadeIn 0.15s ease-out;">
        
        <!-- Header -->
        <div class="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <button type="button" (click)="prev()" class="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          
          <button 
            type="button" 
            (click)="toggleViewMode()"
            class="px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1"
          >
            <span class="text-sm font-semibold text-slate-700">
              {{ viewMode() === 'years' ? 'Seleccionar año' : viewMode() === 'months' ? currentYear() : monthNames[currentMonth()] + ' ' + currentYear() }}
            </span>
            <svg class="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          
          <button type="button" (click)="next()" class="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- Year Selector View -->
        <div *ngIf="viewMode() === 'years'" class="p-2 max-h-[240px] overflow-y-auto">
          <div class="grid grid-cols-4 gap-1">
            <button
              *ngFor="let year of yearsList()"
              type="button"
              (click)="selectYear(year)"
              class="h-9 rounded-lg text-xs font-medium transition-all"
              [ngClass]="{
                'bg-brand-orange text-white': year === currentYear(),
                'hover:bg-slate-100 text-slate-600': year !== currentYear()
              }"
            >
              {{ year }}
            </button>
          </div>
        </div>

        <!-- Month Selector View -->
        <div *ngIf="viewMode() === 'months'" class="p-2">
          <div class="grid grid-cols-3 gap-1">
            <button
              *ngFor="let month of monthNames; let i = index"
              type="button"
              (click)="selectMonth(i)"
              class="h-9 rounded-lg text-xs font-medium transition-all"
              [ngClass]="{
                'bg-brand-orange text-white': i === currentMonth(),
                'hover:bg-slate-100 text-slate-600': i !== currentMonth()
              }"
            >
              {{ month.slice(0, 3) }}
            </button>
          </div>
        </div>

        <!-- Calendar View -->
        <div *ngIf="viewMode() === 'calendar'">
          <!-- Days of Week -->
          <div class="grid grid-cols-7 px-2 pt-1">
            <div *ngFor="let day of dayNames" class="text-center text-[10px] font-semibold text-slate-400 py-1">
              {{ day }}
            </div>
          </div>

          <!-- Calendar Grid -->
          <div class="grid grid-cols-7 gap-0.5 p-2">
            <ng-container *ngFor="let day of calendarDays()">
              <button
                *ngIf="day !== null"
                type="button"
                (click)="selectDay(day)"
                class="w-8 h-8 mx-auto rounded-lg text-xs font-medium transition-all"
                [ngClass]="{
                  'bg-brand-orange text-white': isSelected(day),
                  'hover:bg-slate-100 text-slate-700': !isSelected(day) && !isToday(day),
                  'text-brand-orange font-bold': isToday(day) && !isSelected(day)
                }"
              >
                {{ day }}
              </button>
              <div *ngIf="day === null" class="w-8 h-8"></div>
            </ng-container>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
          <button type="button" (click)="clear()" class="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors">
            Borrar
          </button>
          <button type="button" (click)="selectToday()" class="text-xs font-semibold text-brand-orange hover:text-orange-600 transition-colors">
            Hoy
          </button>
        </div>
      </div>
    </div>
  `,
   styles: [`
    :host { display: block; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class DatePickerComponent implements ControlValueAccessor {
   @Input() placeholder = 'dd/mm/aaaa';
   @Input() disabled = false;

   isOpen = signal(false);
   selectedDate = signal<Date | null>(null);
   currentMonth = signal(new Date().getMonth());
   currentYear = signal(new Date().getFullYear());
   viewMode = signal<ViewMode>('calendar');
   yearRangeStart = signal(new Date().getFullYear() - 11);

   monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
   dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

   private onChange: (value: string | null) => void = () => { };
   private onTouched: () => void = () => { };

   displayValue = computed(() => {
      const date = this.selectedDate();
      if (!date) return this.placeholder;
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
   });

   yearsList = computed(() => {
      const years: number[] = [];
      const start = this.yearRangeStart();
      for (let i = start + 11; i >= start; i--) {
         years.push(i);
      }
      return years;
   });

   calendarDays = computed(() => {
      const year = this.currentYear();
      const month = this.currentMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const days: (number | null)[] = [];
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(i);

      return days;
   });

   toggle() {
      if (!this.disabled) {
         this.isOpen.update(v => !v);
         if (this.isOpen()) {
            const date = this.selectedDate() || new Date();
            this.currentMonth.set(date.getMonth());
            this.currentYear.set(date.getFullYear());
            this.yearRangeStart.set(date.getFullYear() - 11);
            this.viewMode.set('calendar');
         }
      }
   }

   close() {
      this.isOpen.set(false);
      this.viewMode.set('calendar');
      this.onTouched();
   }

   toggleViewMode() {
      const current = this.viewMode();
      if (current === 'calendar') {
         this.viewMode.set('years');
      } else if (current === 'years') {
         this.viewMode.set('months');
      } else {
         this.viewMode.set('calendar');
      }
   }

   prev() {
      if (this.viewMode() === 'years') {
         this.yearRangeStart.update(y => y - 12);
      } else if (this.viewMode() === 'months') {
         this.currentYear.update(y => y - 1);
      } else {
         if (this.currentMonth() === 0) {
            this.currentMonth.set(11);
            this.currentYear.update(y => y - 1);
         } else {
            this.currentMonth.update(m => m - 1);
         }
      }
   }

   next() {
      if (this.viewMode() === 'years') {
         this.yearRangeStart.update(y => y + 12);
      } else if (this.viewMode() === 'months') {
         this.currentYear.update(y => y + 1);
      } else {
         if (this.currentMonth() === 11) {
            this.currentMonth.set(0);
            this.currentYear.update(y => y + 1);
         } else {
            this.currentMonth.update(m => m + 1);
         }
      }
   }

   selectYear(year: number) {
      this.currentYear.set(year);
      this.viewMode.set('months');
   }

   selectMonth(month: number) {
      this.currentMonth.set(month);
      this.viewMode.set('calendar');
   }

   selectDay(day: number) {
      const date = new Date(this.currentYear(), this.currentMonth(), day);
      this.selectedDate.set(date);
      this.emitValue(date);
      this.close();
   }

   selectToday() {
      const today = new Date();
      this.selectedDate.set(today);
      this.currentMonth.set(today.getMonth());
      this.currentYear.set(today.getFullYear());
      this.emitValue(today);
      this.close();
   }

   clear() {
      this.selectedDate.set(null);
      this.onChange(null);
      this.close();
   }

   isSelected(day: number): boolean {
      const selected = this.selectedDate();
      if (!selected) return false;
      return selected.getDate() === day &&
         selected.getMonth() === this.currentMonth() &&
         selected.getFullYear() === this.currentYear();
   }

   isToday(day: number): boolean {
      const today = new Date();
      return today.getDate() === day &&
         today.getMonth() === this.currentMonth() &&
         today.getFullYear() === this.currentYear();
   }

   private emitValue(date: Date) {
      const value = date.toISOString().split('T')[0];
      this.onChange(value);
   }

   writeValue(value: string | null): void {
      if (value) {
         this.selectedDate.set(new Date(value));
      } else {
         this.selectedDate.set(null);
      }
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
