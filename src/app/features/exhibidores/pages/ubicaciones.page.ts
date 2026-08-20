import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TimePickerComponent } from '../../../shared/components/time-picker/time-picker.component';
import { ExhibidoresTabsComponent } from '../components/exhibidores-tabs.component';
import { ExhibidorMapComponent } from '../components/exhibidor-map.component';
import { PuntoSacadaPickerComponent } from '../components/punto-sacada-picker.component';
import { SelectorUbicacionComponent } from '../components/selector-ubicacion.component';
import { ExhibidoresService } from '../services/exhibidores.service';
import { Hora12Pipe } from '../../../shared/pipes/hora12.pipe';
import {
  ComposicionPareja, DIAS_SEMANA, DIAS_SEMANA_CORTO, GeoJSONPoint, PuntoSacada,
  TurnoExhibidor, UbicacionExhibidor,
} from '../models/exhibidor.model';

/**
 * Estado del campo Dirección respecto al mapa:
 *   inactivo      → el valor es del usuario (o no hay nada que contar)
 *   buscando      → hay una consulta en vuelo para el punto marcado
 *   auto          → lo escribimos nosotros y sigue intacto (se puede deshacer)
 *   sin-resultado → el punto no tiene dirección conocida
 */
type EstadoDireccion = 'inactivo' | 'buscando' | 'auto' | 'sin-resultado';

interface UbicacionForm {
  nombre: string;
  direccion: string;
  coordenadas: GeoJSONPoint | null;
  id_punto_sacada: number | null;
  estado: 'activo' | 'mantenimiento';
  composicion: ComposicionPareja;
  requiere_fluidez: boolean;
  preferir_mezcla_edad: boolean;
  notas: string;
}

interface TurnoForm {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  capacidad: number;
}

interface SacadaForm {
  nombre: string;
  direccion: string;
  coordenadas: GeoJSONPoint | null;
  referencia: string;
}

@Component({
  selector: 'app-ubicaciones-exhibidores-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, PageHeaderComponent, ModalComponent,
    ConfirmDialogComponent, EmptyStateComponent, TimePickerComponent,
    ExhibidoresTabsComponent, ExhibidorMapComponent, PuntoSacadaPickerComponent,
    SelectorUbicacionComponent, Hora12Pipe,
  ],
  template: `
    <app-page-header
      title="Exhibidores"
      subtitle="Puntos de exhibición, turnos semanales y puntos de sacada.">
      <button class="btn-secondary" (click)="abrirSacadas()">Puntos de sacada</button>
      <button class="btn-primary-blue" (click)="nuevaUbicacion()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>
        Nueva ubicación
      </button>
    </app-page-header>

    <app-exhibidores-tabs />

    <!-- xl:flex-1 xl:min-h-0: desde xl (donde hay una columna de sobra en
         horizontal) esta fila pasa a llenar TODA la altura que quede debajo
         del encabezado y las pestañas, en vez de limitarse a la altura de su
         contenido. El host de la página ya es flex-column con overflow
         oculto (ver :host abajo), así que sin esto el "espacio disponible"
         simplemente no existía como tal: la página entera hacía scroll y el
         mapa se quedaba con la altura fija que le hubiéramos puesto. -->
    <div class="grid grid-cols-1 xl:grid-cols-5 gap-6 xl:flex-1 xl:min-h-0">
      <!-- Mapa -->
      <div class="xl:col-span-3 card-elevated p-0 overflow-hidden xl:flex xl:flex-col xl:h-full">
        <!-- Alto responsive por defecto (celular/tablet, la fila no tiene
             altura propia todavía); desde xl el mapa se estira con flex-1
             para llenar la columna completa, borde a borde, en vez de topar
             en un número fijo de píxeles que a esa resolución se ve mezquino. -->
        <div class="relative h-[300px] sm:h-[380px] md:h-[480px] xl:h-auto xl:flex-1 xl:min-h-0">
          <app-exhibidor-map
            class="absolute inset-0"
            [redondeado]="false"
            [ubicaciones]="ubicaciones()"
            [puntosSacada]="puntosSacada()"
            [selectedId]="seleccionada()?.id_ubicacion_exhibidor ?? null"
            height="100%"
            (ubicacionClick)="seleccionarPorId($event)"
          />
        </div>
        <div class="shrink-0 flex items-center gap-5 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          <span class="inline-flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-exh-600 inline-block"></span> Punto de exhibición
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span> Punto de sacada
          </span>
        </div>
      </div>

      <!-- Tarjetas: columna propia con scroll interno desde xl, para que el
           mapa de al lado nunca se achique ni se pierda de vista mientras se
           revisa la lista — el patrón ya usado en Participantes/Territorios. -->
      <div class="xl:col-span-2 xl:flex xl:flex-col xl:h-full xl:min-h-0">
        <!-- xl:p-1 xl:-m-1 en los cuatro lados, no solo a la derecha: el ring-2
             de la tarjeta seleccionada pinta 2px FUERA de su caja, y un
             contenedor con overflow-y:auto recorta cualquier cosa que se salga
             de sus bordes en cualquier dirección (arriba/abajo tanto como los
             lados — la primera y la última tarjeta pierden el ring por arriba
             o por abajo igual que se perdía por la izquierda). El margen
             negativo mantiene el tamaño visual de la columna sin correrla
             respecto al mapa de al lado. -->
        <div class="space-y-3 xl:flex-1 xl:min-h-0 xl:overflow-y-auto custom-scrollbar xl:p-1 xl:-m-1">
        <app-empty-state *ngIf="!cargando() && ubicaciones().length === 0"
          accent="blue"
          icon="map-pin"
          title="Sin ubicaciones"
          description="Crea el primer punto de exhibición para empezar a programar turnos."
          actionLabel="Nueva ubicación"
          (action)="nuevaUbicacion()" />

        <div *ngFor="let u of ubicaciones()"
             class="card-elevated p-4 cursor-pointer transition-all"
             [class.ring-2]="seleccionada()?.id_ubicacion_exhibidor === u.id_ubicacion_exhibidor"
             [class.ring-exh-500]="seleccionada()?.id_ubicacion_exhibidor === u.id_ubicacion_exhibidor"
             (click)="seleccionar(u)">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-slate-900 dark:text-slate-100 truncate">{{ u.nombre }}</h3>
                <span *ngIf="u.estado === 'mantenimiento'" class="badge-warning shrink-0">Mantenimiento</span>
              </div>
              <p class="text-sm text-slate-500 dark:text-slate-400 truncate">{{ u.direccion || 'Sin dirección' }}</p>
              <p *ngIf="u.punto_sacada" class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Sacada: {{ u.punto_sacada.nombre }}
              </p>
              <div class="flex flex-wrap gap-1.5 mt-2">
                <span *ngIf="u.composicion === 'solo_varones'" class="badge-neutral">Solo varones</span>
                <span *ngIf="u.composicion === 'solo_mujeres'" class="badge-neutral">Solo hermanas</span>
                <span *ngIf="u.requiere_fluidez" class="badge-neutral">Requiere fluidez</span>
                <span *ngIf="u.preferir_mezcla_edad" class="badge-neutral">Mezclar edades</span>
              </div>
            </div>
            <!-- 44px: mínimo táctil recomendado (Apple HIG / Material). Con p-1.5
                 y un ícono de 16px el botón quedaba en ~28px, difícil de acertar
                 para alguien con menos precisión motriz o poca práctica con pantallas. -->
            <div class="flex gap-1 shrink-0">
              <button class="btn-icon-edit !w-11 !h-11 flex items-center justify-center"
                      (click)="editarUbicacion(u); $event.stopPropagation()" aria-label="Editar ubicación">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Z"/>
                </svg>
              </button>
              <button class="btn-icon-delete !w-11 !h-11 flex items-center justify-center"
                      (click)="pedirEliminar(u); $event.stopPropagation()" aria-label="Eliminar ubicación">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21.75H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397M4.75 5.75c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Turnos de la ubicación -->
          <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <div class="flex items-center justify-between mb-1.5">
              <span class="eyebrow">Turnos semanales</span>
              <button class="text-xs font-semibold text-exh-600 dark:text-exh-400 hover:underline"
                      (click)="nuevoTurno(u); $event.stopPropagation()">+ Añadir turno</button>
            </div>
            <p *ngIf="u.turnos.length === 0" class="text-xs text-slate-400 italic">Sin turnos configurados.</p>
            <div class="flex flex-wrap gap-1.5">
              <button *ngFor="let t of u.turnos"
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                             bg-exh-50 text-exh-700 hover:bg-exh-100
                             dark:bg-exh-950/60 dark:text-exh-300 dark:hover:bg-exh-900/60 transition-colors"
                      (click)="editarTurno(u, t); $event.stopPropagation()">
                {{ t.dia_nombre }} · <span class="data-num whitespace-nowrap">{{ t.hora_inicio | hora12 }} – {{ t.hora_fin | hora12 }}</span> · {{ t.capacidad }}p
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- ══ Modal Ubicación ══ -->
    <app-modal [open]="modalUbicacion()" (openChange)="modalUbicacion.set($event)"
               [title]="editandoUbicacion() ? 'Editar ubicación' : 'Nueva ubicación'"
               subtitle="Un punto donde se instala el exhibidor." size="xl">
      <!-- form-scroll: en pantallas bajas (un celular en horizontal, un
           notebook chico) este formulario no cabe entero. Que haga scroll
           el cuerpo y no el modal completo, así "Cancelar"/"Guardar" quedan
           siempre a la vista sin tener que bajar a buscarlos. -->
      <div class="form-scroll overflow-y-auto pr-1 -mr-1">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="space-y-4">
            <div>
              <label class="form-label">Nombre <span class="text-red-500">*</span></label>
              <input class="form-control" [(ngModel)]="formUbicacion.nombre" placeholder="Ej. Victoria Parque" />
            </div>
          <div>
            <div class="flex items-baseline justify-between gap-2 mb-1.5">
              <label class="form-label !mb-0" for="dir-ubicacion">Dirección</label>

              <!-- Estado del autocompletado. aria-live: el usuario está mirando
                   el mapa cuando esto cambia, no el campo. -->
              <span class="text-xs font-medium" role="status" aria-live="polite">
                <span *ngIf="direccionEstado() === 'buscando'"
                      class="inline-flex items-center gap-1.5 text-exh-600 dark:text-exh-400 animate-fadeIn">
                  <span class="w-3 h-3 rounded-full border-2 border-exh-200 dark:border-exh-800 border-t-exh-600 dark:border-t-exh-400 animate-spin"></span>
                  Buscando dirección…
                </span>
                <span *ngIf="direccionEstado() === 'auto'"
                      class="inline-flex items-center gap-1.5 text-exh-700 dark:text-exh-300 animate-fadeIn">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  Desde el mapa
                  <button type="button" (click)="deshacerDireccion()"
                          class="ml-0.5 text-slate-500 dark:text-slate-400 underline underline-offset-2
                                 hover:no-underline hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    Deshacer
                  </button>
                </span>
              </span>
            </div>

            <input id="dir-ubicacion" class="form-control" [(ngModel)]="formUbicacion.direccion"
                   (ngModelChange)="onDireccionEditada()" placeholder="Calle, referencia…" />

            <!-- El usuario ya había escrito algo: se ofrece, nunca se pisa. -->
            <div *ngIf="direccionSugerida() as sug"
                 class="flex items-start gap-2 mt-1.5 px-2.5 py-2 rounded-lg animate-fadeIn
                        bg-exh-50 dark:bg-exh-950/50 border border-exh-100 dark:border-exh-900/60">
              <p class="flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                El punto del mapa está en <span class="font-medium">«{{ sug }}»</span>.
              </p>
              <button type="button" (click)="usarSugerencia()"
                      class="shrink-0 text-xs font-semibold text-exh-600 dark:text-exh-400
                             hover:text-exh-700 dark:hover:text-exh-300 active:scale-95 transition">
                Usar
              </button>
            </div>

            <p *ngIf="ayudaDireccion() as ayuda"
               class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{{ ayuda }}</p>
          </div>
          <div>
            <label class="form-label">Punto de sacada</label>
            <app-punto-sacada-picker
              [puntos]="puntosSacada()"
              [idCongregacion]="idCong"
              [(ngModel)]="formUbicacion.id_punto_sacada"
              (creado)="onPuntoSacadaCreado($event)" />
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              Dónde se guarda y se recoge el carrito. Es opcional.
            </p>
          </div>
          <div>
            <label class="form-label">Estado</label>
            <select class="form-select" [(ngModel)]="formUbicacion.estado">
              <option value="activo">Activo</option>
              <option value="mantenimiento">En mantenimiento (no genera turnos)</option>
            </select>
          </div>

          <!-- Reglas de pareja y notas: quedan tapadas por defecto para que un
               primer vistazo al formulario no muestre más de 4 campos. Si la
               ubicación ya tenía alguna en uso (editar), avanzadoAbierto()
               arranca destapado — nunca se esconde una regla ya activa. -->
          <button type="button"
                  class="flex items-center gap-1.5 text-sm font-semibold text-exh-600 dark:text-exh-400
                         hover:text-exh-700 dark:hover:text-exh-300 transition-colors py-1"
                  (click)="avanzadoAbierto.set(!avanzadoAbierto())"
                  [attr.aria-expanded]="avanzadoAbierto()">
            <svg class="w-4 h-4 shrink-0 transition-transform duration-200" [class.rotate-90]="avanzadoAbierto()"
                 fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
            {{ avanzadoAbierto() ? 'Menos opciones' : 'Más opciones (composición, fluidez, notas)' }}
          </button>

          <div *ngIf="avanzadoAbierto()" class="space-y-4 animate-fadeIn">
            <div>
              <label class="form-label">Composición del turno</label>
              <select class="form-select" [(ngModel)]="formUbicacion.composicion">
                <option value="indistinto">Indistinto</option>
                <option value="solo_varones">Solo varones</option>
                <option value="solo_mujeres">Solo hermanas</option>
              </select>
              <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                Una pareja de hombre y mujer solo se arma si están vinculados como
                matrimonio o familia en la pestaña Participantes.
              </p>
            </div>
            <div class="space-y-2 pt-1">
              <label class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" class="accent-exh-600 w-4 h-4" [(ngModel)]="formUbicacion.requiere_fluidez" />
                Requiere a alguien que se exprese con fluidez
              </label>
              <label class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" class="accent-exh-600 w-4 h-4" [(ngModel)]="formUbicacion.preferir_mezcla_edad" />
                Preferir mezclar edades (alguien joven con alguien mayor)
              </label>
            </div>
            <div>
              <label class="form-label">Notas</label>
              <textarea class="form-control" rows="2" [(ngModel)]="formUbicacion.notas"></textarea>
            </div>
          </div>
        </div>
        <div>
          <label class="form-label">Posición en el mapa</label>
          <app-selector-ubicacion
            [tipo]="'exhibidor'"
            [value]="formUbicacion.coordenadas"
            (valueChange)="onCoordenadaSeleccionada($event)"
            [titulo]="formUbicacion.nombre.trim() || 'Nueva ubicación'"
            [ubicacionesRef]="ubicaciones()"
            [puntosRef]="puntosSacada()"
          />
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Al confirmar el punto en el mapa completamos la dirección por ti, si es posible.
          </p>
        </div>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button class="btn-secondary" (click)="modalUbicacion.set(false)">Cancelar</button>
        <button class="btn-primary-blue" [disabled]="!formUbicacion.nombre.trim() || guardando()"
                (click)="guardarUbicacion()">
          {{ guardando() ? 'Guardando…' : 'Guardar ubicación' }}
        </button>
      </div>
    </app-modal>

    <!-- ══ Modal Turno ══ -->
    <app-modal [open]="modalTurno()" (openChange)="modalTurno.set($event)"
               [title]="editandoTurno() ? 'Editar turno' : 'Nuevo turno'"
               [subtitle]="ubicacionTurno()?.nombre ?? ''" size="md">
      <div class="space-y-4">
        <!-- Editando un turno puntual: un solo día, como siempre. -->
        <div *ngIf="editandoTurno()">
          <label class="form-label">Día de la semana</label>
          <select class="form-select" [(ngModel)]="formTurno.dia_semana">
            <option *ngFor="let d of dias; let i = index" [ngValue]="i">{{ d }}</option>
          </select>
        </div>

        <!-- Creando: uno o varios días a la vez, mismo horario para todos. -->
        <div *ngIf="!editandoTurno()">
          <label class="form-label">
            Días de la semana <span class="text-slate-400 font-normal">(elige uno o varios)</span>
          </label>
          <div class="flex gap-1.5 mt-1 flex-wrap">
            <button *ngFor="let d of diasCorto; let i = index" type="button"
                    class="w-11 h-11 rounded-xl text-xs font-bold transition-colors focus-ring-blue"
                    [ngClass]="diasSeleccionados().includes(i)
                      ? 'bg-exh-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'"
                    (click)="toggleDiaTurno(i)">
              {{ d }}
            </button>
          </div>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            Se crea un turno con este mismo horario en cada día que elijas.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Hora inicio</label>
            <app-time-picker [(ngModel)]="formTurno.hora_inicio" colorScheme="blue" />
          </div>
          <div>
            <label class="form-label">Hora fin</label>
            <app-time-picker [(ngModel)]="formTurno.hora_fin" colorScheme="blue" />
          </div>
        </div>
        <div>
          <label class="form-label">Personas por turno</label>
          <select class="form-select" [(ngModel)]="formTurno.capacidad">
            <option [ngValue]="2">2 personas</option>
            <option [ngValue]="3">3 personas</option>
          </select>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            El turno es de dos; usa tres solo si el punto lo amerita.
          </p>
        </div>

        <!-- Lista viva: para horarios distintos en otros días, sin cerrar el
             modal — se ajustan las horas, se eligen los días y se agrega de
             nuevo. Cada turno ya guardado se ve aquí al toque. -->
        <div *ngIf="!editandoTurno() && (ubicacionTurno()?.turnos?.length ?? 0) > 0"
             class="pt-3 border-t border-slate-100 dark:border-slate-700">
          <p class="eyebrow mb-2">Turnos de esta ubicación</p>
          <div class="flex flex-wrap gap-1.5">
            <button *ngFor="let t of ubicacionTurno()!.turnos" type="button"
                    class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                           bg-exh-50 text-exh-700 hover:bg-exh-100
                           dark:bg-exh-950/60 dark:text-exh-300 dark:hover:bg-exh-900/60 transition-colors"
                    (click)="editarTurno(ubicacionTurno()!, t)">
              {{ t.dia_nombre }} · <span class="data-num whitespace-nowrap">{{ t.hora_inicio | hora12 }} – {{ t.hora_fin | hora12 }}</span> · {{ t.capacidad }}p
            </button>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between mt-6">
        <button *ngIf="editandoTurno()" class="btn-ghost-danger" (click)="eliminarTurno()">Eliminar turno</button>
        <span *ngIf="!editandoTurno()"></span>
        <div class="flex gap-3">
          <button class="btn-secondary" (click)="modalTurno.set(false)">
            {{ !editandoTurno() && turnosCreadosEnSesion() > 0 ? 'Listo' : 'Cancelar' }}
          </button>
          <button class="btn-primary-blue"
                  [disabled]="turnoInvalido() || guardando()"
                  (click)="guardarTurno()">
            {{ guardando() ? 'Guardando…' : etiquetaGuardarTurno() }}
          </button>
        </div>
      </div>
    </app-modal>

    <!-- ══ Modal Puntos de sacada ══ -->
    <!-- Un solo flujo a la vez (lista o formulario), nunca las dos cosas lado a
         lado: para alguien sin experiencia en sistemas, decidir dónde mirar
         primero ya es fricción. Aquí siempre hay un único siguiente paso. -->
    <app-modal [open]="modalSacadas()" (openChange)="modalSacadas.set($event)"
               title="Puntos de sacada"
               subtitle="Dónde se guarda y recoge el carrito. Un punto puede servir a varias ubicaciones."
               size="lg">

      <!-- ── Vista 1: lista de puntos ──────────────────────── -->
      <div *ngIf="!mostrandoFormSacada()">
        <button type="button" class="btn-primary-blue w-full justify-center mb-4" (click)="nuevaSacada()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          Agregar punto de sacada
        </button>

        <div class="space-y-2">
          <div *ngFor="let p of puntosSacada()"
               class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <span class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400
                         flex items-center justify-center shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/>
              </svg>
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{{ p.nombre }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                {{ p.direccion || 'Sin dirección' }}
                <span *ngIf="!p.coordenadas" class="text-amber-600 dark:text-amber-500">
                  · sin ubicación en el mapa
                </span>
              </p>
              <p *ngIf="p.referencia" class="text-xs text-slate-400 dark:text-slate-500 truncate">{{ p.referencia }}</p>
            </div>
            <div class="flex gap-1 shrink-0">
              <button class="btn-icon-edit !w-9 !h-9" (click)="editarSacada(p)" aria-label="Editar punto">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Z"/>
                </svg>
              </button>
              <button class="btn-icon-delete !w-9 !h-9" (click)="pedirEliminarSacada(p)" aria-label="Eliminar punto">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Estado vacío -->
          <div *ngIf="puntosSacada().length === 0" class="flex flex-col items-center gap-2 text-center py-8">
            <svg class="w-8 h-8 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/>
            </svg>
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">Aún no hay puntos de sacada</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              Toca «Agregar punto de sacada» arriba para crear el primero.
            </p>
          </div>
        </div>
      </div>

      <!-- ── Vista 2: formulario (crear o editar), un solo paso a la vez ── -->
      <div *ngIf="mostrandoFormSacada()">
        <button type="button" class="flex items-center gap-1.5 text-sm font-medium mb-2 -ml-2 px-2 py-2.5 rounded-lg
                       text-slate-500 hover:text-slate-700 hover:bg-slate-50
                       dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/40 transition-colors"
                (click)="resetSacada()">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Volver a la lista
        </button>

        <p class="eyebrow mb-3">
          {{ editandoSacada() ? 'Editando «' + editandoSacada()!.nombre + '»' : 'Nuevo punto de sacada' }}
        </p>

        <div class="space-y-4">
          <div>
            <label class="form-label">Nombre <span class="text-red-500">*</span></label>
            <input class="form-control" [(ngModel)]="formSacada.nombre" placeholder="Ej. Casa de Norbert" />
          </div>
          <div>
            <label class="form-label">Dirección <span class="text-slate-400 font-normal">(opcional)</span></label>
            <input class="form-control" [(ngModel)]="formSacada.direccion"
                   placeholder="Ej. Calle 19b # 13a - 77" />
          </div>
          <div>
            <label class="form-label">Referencia <span class="text-slate-400 font-normal">(opcional)</span></label>
            <input class="form-control" [(ngModel)]="formSacada.referencia" placeholder="Ej. Portón gris, timbre 2" />
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              Algo que ayude a reconocerlo además de la dirección: un color, un negocio cercano, el timbre.
            </p>
          </div>
          <div>
            <label class="form-label">Posición en el mapa <span class="text-slate-400 font-normal">(opcional)</span></label>
            <app-selector-ubicacion
              [(value)]="formSacada.coordenadas"
              [titulo]="formSacada.nombre.trim() || 'Nuevo punto de sacada'"
              [ubicacionesRef]="ubicaciones()"
              [puntosRef]="puntosSacadaOtros()"
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-5">
          <button class="btn-secondary" (click)="resetSacada()">Cancelar</button>
          <button class="btn-primary-blue" [disabled]="!formSacada.nombre.trim() || guardando()"
                  (click)="guardarSacada()">
            {{ guardando() ? 'Guardando…' : (editandoSacada() ? 'Actualizar' : 'Crear punto') }}
          </button>
        </div>
      </div>
    </app-modal>

    <app-confirm-dialog
      [open]="confirmEliminarSacada()" (openChange)="confirmEliminarSacada.set($event)"
      title="¿Eliminar punto de sacada?"
      [message]="'Se eliminará «' + (sacadaAEliminar()?.nombre ?? '') + '». Las ubicaciones que lo usan quedarán sin punto de sacada.'"
      confirmLabel="Eliminar"
      (confirmed)="eliminarSacada()" />

    <app-confirm-dialog
      [open]="confirmEliminar()" (openChange)="confirmEliminar.set($event)"
      title="¿Eliminar ubicación?"
      [message]="'Se eliminará «' + (ubicacionAEliminar()?.nombre ?? '') + '» y sus turnos. Si tiene historial, solo se desactivará.'"
      confirmLabel="Eliminar"
      (confirmed)="eliminarUbicacion()" />
  `,
  styles: [`
    /* Mismo patrón que participantes.page.ts: el host pasa a ser la columna
       flex que llena el alto que le da el shell (ver router-container en
       shell.page.ts) y deja de desbordar — el scroll lo maneja cada panel
       interno (la lista de tarjetas, el cuerpo del modal), no la página
       entera. Sin esto, xl:h-full / xl:flex-1 más abajo no tendrían de qué
       altura tomar: un hijo flex-1 dentro de un padre sin alto definido no
       "llena" nada, solo respeta su contenido. */
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

    /* min(): Tailwind v4 no genera valores arbitrarios con coma (la clase se
       escribe, no sale CSS y el límite falla en silencio) — por eso va como
       CSS de componente y no max-h-[min(58dvh,620px)]. dvh porque el modal
       vive detrás de la barra del navegador móvil, que cambia de alto. */
    .form-scroll { max-height: min(58dvh, 620px); }

    /* Scrollbar delgada para la lista de tarjetas, igual que en
       participantes.page.ts: la de sistema (ancha, siempre gris) compite
       visualmente con las tarjetas azules del mapa al lado. */
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
    :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
  `],
})
export class UbicacionesExhibidoresPage implements OnInit {
  private svc = inject(ExhibidoresService);
  private ctx = inject(CongregacionContextService);
  private toast = inject(ToastService);

  readonly dias = DIAS_SEMANA;
  readonly diasCorto = DIAS_SEMANA_CORTO;

  cargando = signal(true);
  guardando = signal(false);
  ubicaciones = signal<UbicacionExhibidor[]>([]);
  puntosSacada = signal<PuntoSacada[]>([]);
  seleccionada = signal<UbicacionExhibidor | null>(null);

  modalUbicacion = signal(false);
  editandoUbicacion = signal<UbicacionExhibidor | null>(null);
  formUbicacion: UbicacionForm = this.formUbicacionVacio();
  /** "Más opciones" del formulario de ubicación: ver comentario junto al botón en la plantilla. */
  avanzadoAbierto = signal(false);

  modalTurno = signal(false);
  editandoTurno = signal<TurnoExhibidor | null>(null);
  ubicacionTurno = signal<UbicacionExhibidor | null>(null);
  formTurno: TurnoForm = { dia_semana: 1, hora_inicio: '06:30', hora_fin: '08:30', capacidad: 2 };
  /** Días elegidos al crear (uno o varios); en edición manda formTurno.dia_semana. */
  diasSeleccionados = signal<number[]>([]);
  /** Cuántos turnos se crearon sin cerrar el modal — cambia el texto de "Cancelar" a "Listo". */
  turnosCreadosEnSesion = signal(0);

  modalSacadas = signal(false);
  editandoSacada = signal<PuntoSacada | null>(null);
  creandoSacada = signal(false);
  formSacada: SacadaForm = this.formSacadaVacio();

  /** Un único flujo a la vez: lista o formulario, nunca los dos juntos. */
  mostrandoFormSacada = computed(() => this.creandoSacada() || this.editandoSacada() !== null);

  confirmEliminarSacada = signal(false);
  sacadaAEliminar = signal<PuntoSacada | null>(null);

  /**
   * Los demás puntos de sacada, como referencia en el mapa grande. Se excluye
   * el que se está editando: ese ya se dibuja como punto provisional y, si no,
   * saldría duplicado (uno gris fijo y otro ámbar movible).
   */
  puntosSacadaOtros = computed(() => {
    const editando = this.editandoSacada();
    if (!editando) return this.puntosSacada();
    return this.puntosSacada().filter(p => p.id_punto_sacada !== editando.id_punto_sacada);
  });

  confirmEliminar = signal(false);
  ubicacionAEliminar = signal<UbicacionExhibidor | null>(null);

  // ── Autocompletado de dirección desde el mapa ──────────────
  direccionEstado = signal<EstadoDireccion>('inactivo');
  /** Dirección del punto que NO se aplicó porque el usuario ya había escrito. */
  direccionSugerida = signal<string | null>(null);
  /** Último valor que escribimos nosotros: si el campo sigue igual, no lo tocó. */
  private direccionAuto = '';
  /** Lo que había antes de autocompletar, para «Deshacer». */
  private direccionPrevia = '';
  private puntoAGeocodificar = new Subject<GeoJSONPoint>();

  constructor() {
    // switchMap: cada clic cancela la petición del clic anterior, así que la
    // respuesta que llega siempre corresponde al punto que está en el mapa.
    this.puntoAGeocodificar.pipe(
      debounceTime(400),
      switchMap(p => this.svc
        .geocodificarInverso(p.coordinates[1], p.coordinates[0])
        .pipe(catchError(() => of({ direccion: null })))),
      takeUntilDestroyed(),
    ).subscribe(res => this.aplicarDireccionDelMapa(res.direccion));
  }

  /** Público: lo consume <app-punto-sacada-picker> desde la plantilla. */
  get idCong(): number | null {
    return this.ctx.effectiveCongregacionId();
  }

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.svc.getUbicaciones(this.idCong).subscribe({
      next: data => {
        this.ubicaciones.set(data);
        this.cargando.set(false);
        // El modal de turnos puede seguir abierto tras crear (ver guardarTurno):
        // su "lista viva" de turnos necesita la versión fresca de la ubicación,
        // no la que tenía cuando se abrió.
        const abierta = this.ubicacionTurno();
        if (abierta) {
          const fresca = data.find(x => x.id_ubicacion_exhibidor === abierta.id_ubicacion_exhibidor);
          if (fresca) this.ubicacionTurno.set(fresca);
        }
      },
      error: () => { this.cargando.set(false); this.toast.error('Error', 'No se pudieron cargar las ubicaciones.'); },
    });
    this.svc.getPuntosSacada(this.idCong).subscribe({
      next: data => this.puntosSacada.set(data),
      error: () => {},
    });
  }

  /**
   * El picker ya creó el punto en el backend y lo dejó seleccionado en el
   * formulario; aquí solo lo insertamos en la lista local para que aparezca
   * de inmediato en el desplegable y en el mapa, sin recargar todo.
   */
  onPuntoSacadaCreado(punto: PuntoSacada): void {
    this.puntosSacada.update(lista =>
      [...lista, punto].sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
  }

  seleccionar(u: UbicacionExhibidor): void {
    this.seleccionada.set(this.seleccionada()?.id_ubicacion_exhibidor === u.id_ubicacion_exhibidor ? null : u);
  }

  seleccionarPorId(id: number): void {
    const u = this.ubicaciones().find(x => x.id_ubicacion_exhibidor === id) ?? null;
    this.seleccionada.set(u);
  }

  // ── Dirección autocompletada desde el mapa ─────────────────

  /**
   * Confirmar un punto en el mapa fija la coordenada y dispara la búsqueda de
   * su dirección. Nunca bloquea: si falla o no hay nada cerca, el campo se
   * escribe a mano como siempre. `null` = el usuario quitó la ubicación desde
   * el selector; no hay nada que geocodificar.
   */
  onCoordenadaSeleccionada(punto: GeoJSONPoint | null): void {
    this.formUbicacion.coordenadas = punto;
    if (!punto) return;
    this.direccionSugerida.set(null);
    this.direccionEstado.set('buscando');
    this.puntoAGeocodificar.next(punto);
  }

  /**
   * Regla central: el texto del usuario es sagrado. Sólo escribimos en el
   * campo si está vacío o si lo que hay es una dirección nuestra que no ha
   * tocado. En cualquier otro caso la ofrecemos como sugerencia.
   */
  private aplicarDireccionDelMapa(direccion: string | null): void {
    if (!direccion) {
      this.direccionEstado.set(this.formUbicacion.direccion.trim() ? 'inactivo' : 'sin-resultado');
      return;
    }
    const actual = this.formUbicacion.direccion.trim();
    if (actual && actual !== this.direccionAuto) {
      this.direccionEstado.set('inactivo');
      this.direccionSugerida.set(direccion);
      return;
    }
    this.direccionPrevia = this.formUbicacion.direccion;
    this.formUbicacion.direccion = direccion;
    this.direccionAuto = direccion;
    this.direccionEstado.set('auto');
  }

  /** En cuanto el usuario escribe, el valor pasa a ser suyo: fuera la insignia. */
  onDireccionEditada(): void {
    if (this.direccionEstado() === 'auto' && this.formUbicacion.direccion !== this.direccionAuto) {
      this.direccionEstado.set('inactivo');
      this.direccionAuto = '';
    }
  }

  deshacerDireccion(): void {
    this.formUbicacion.direccion = this.direccionPrevia;
    this.direccionAuto = '';
    this.direccionEstado.set('inactivo');
  }

  usarSugerencia(): void {
    const sug = this.direccionSugerida();
    if (!sug) return;
    this.direccionPrevia = this.formUbicacion.direccion;
    this.formUbicacion.direccion = sug;
    this.direccionAuto = sug;
    this.direccionSugerida.set(null);
    this.direccionEstado.set('auto');
  }

  /** Texto de ayuda bajo el campo; null cuando la insignia ya lo explica. */
  ayudaDireccion(): string | null {
    if (this.direccionEstado() === 'sin-resultado') {
      return 'No encontramos una dirección para ese punto. Escríbela a mano.';
    }
    if (this.direccionEstado() === 'inactivo' && !this.formUbicacion.coordenadas
        && !this.formUbicacion.direccion.trim()) {
      return 'Si marcas el punto en el mapa, la completamos por ti.';
    }
    return null;
  }

  private resetDireccion(): void {
    this.direccionEstado.set('inactivo');
    this.direccionSugerida.set(null);
    this.direccionAuto = '';
    this.direccionPrevia = '';
  }

  // ── Ubicaciones ────────────────────────────────────────────
  private formUbicacionVacio(): UbicacionForm {
    return {
      nombre: '', direccion: '', coordenadas: null, id_punto_sacada: null,
      estado: 'activo', composicion: 'indistinto', requiere_fluidez: false,
      preferir_mezcla_edad: false, notas: '',
    };
  }

  nuevaUbicacion(): void {
    this.editandoUbicacion.set(null);
    this.formUbicacion = this.formUbicacionVacio();
    this.resetDireccion();
    this.avanzadoAbierto.set(false);
    this.modalUbicacion.set(true);
  }

  editarUbicacion(u: UbicacionExhibidor): void {
    this.editandoUbicacion.set(u);
    this.resetDireccion();
    this.formUbicacion = {
      nombre: u.nombre,
      direccion: u.direccion ?? '',
      coordenadas: u.coordenadas,
      id_punto_sacada: u.id_punto_sacada,
      estado: u.estado,
      composicion: u.composicion,
      requiere_fluidez: u.requiere_fluidez,
      preferir_mezcla_edad: u.preferir_mezcla_edad,
      notas: u.notas ?? '',
    };
    // Nunca se esconde una regla que ya está activa.
    this.avanzadoAbierto.set(
      u.composicion !== 'indistinto' || u.requiere_fluidez || u.preferir_mezcla_edad || !!u.notas?.trim(),
    );
    this.modalUbicacion.set(true);
  }

  guardarUbicacion(): void {
    const f = this.formUbicacion;
    const payload = {
      nombre: f.nombre.trim(),
      direccion: f.direccion.trim() || null,
      coordenadas: f.coordenadas,
      id_punto_sacada: f.id_punto_sacada,
      estado: f.estado,
      composicion: f.composicion,
      requiere_fluidez: f.requiere_fluidez,
      preferir_mezcla_edad: f.preferir_mezcla_edad,
      notas: f.notas.trim() || null,
    };
    this.guardando.set(true);
    const editando = this.editandoUbicacion();
    const req = editando
      ? this.svc.actualizarUbicacion(editando.id_ubicacion_exhibidor, payload, this.idCong)
      : this.svc.crearUbicacion(payload, this.idCong);
    req.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalUbicacion.set(false);
        this.toast.success(editando ? 'Ubicación actualizada' : 'Ubicación creada');
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        this.toast.error('Error al guardar', err?.error?.detail ?? 'Inténtalo de nuevo.');
      },
    });
  }

  pedirEliminar(u: UbicacionExhibidor): void {
    this.ubicacionAEliminar.set(u);
    this.confirmEliminar.set(true);
  }

  eliminarUbicacion(): void {
    const u = this.ubicacionAEliminar();
    if (!u) return;
    this.svc.eliminarUbicacion(u.id_ubicacion_exhibidor, this.idCong).subscribe({
      next: () => { this.toast.success('Ubicación eliminada'); this.cargar(); },
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo eliminar.'),
    });
  }

  // ── Turnos ─────────────────────────────────────────────────
  nuevoTurno(u: UbicacionExhibidor): void {
    this.ubicacionTurno.set(u);
    this.editandoTurno.set(null);
    this.turnosCreadosEnSesion.set(0);
    const ultimo = u.turnos[u.turnos.length - 1];
    this.formTurno = ultimo
      ? { dia_semana: (ultimo.dia_semana + 1) % 7, hora_inicio: ultimo.hora_inicio, hora_fin: ultimo.hora_fin, capacidad: ultimo.capacidad }
      : { dia_semana: 1, hora_inicio: '06:30', hora_fin: '08:30', capacidad: 2 };
    // Arranca con el día sugerido ya marcado: sigue siendo un solo clic para
    // el caso de siempre (un turno), y el punto de partida para elegir más.
    this.diasSeleccionados.set([this.formTurno.dia_semana]);
    this.modalTurno.set(true);
  }

  editarTurno(u: UbicacionExhibidor, t: TurnoExhibidor): void {
    this.ubicacionTurno.set(u);
    this.editandoTurno.set(t);
    this.formTurno = {
      dia_semana: t.dia_semana, hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin, capacidad: t.capacidad,
    };
    this.modalTurno.set(true);
  }

  toggleDiaTurno(i: number): void {
    this.diasSeleccionados.update(dias =>
      dias.includes(i) ? dias.filter(d => d !== i) : [...dias, i].sort((a, b) => a - b)
    );
  }

  /** Deshabilita "Guardar"/"Agregar": en edición basta el horario, al crear hace falta además algún día elegido. */
  turnoInvalido(): boolean {
    if (!this.formTurno.hora_inicio || !this.formTurno.hora_fin) return true;
    return !this.editandoTurno() && this.diasSeleccionados().length === 0;
  }

  etiquetaGuardarTurno(): string {
    if (this.editandoTurno()) return 'Guardar turno';
    const n = this.diasSeleccionados().length;
    return n > 1 ? `Agregar ${n} turnos` : 'Agregar turno';
  }

  guardarTurno(): void {
    const u = this.ubicacionTurno();
    if (!u) return;
    if (this.formTurno.hora_fin <= this.formTurno.hora_inicio) {
      this.toast.warning('Horario inválido', 'La hora fin debe ser posterior a la de inicio.');
      return;
    }

    const editando = this.editandoTurno();
    if (editando) {
      this.guardando.set(true);
      this.svc.actualizarTurno(editando.id_turno_exhibidor, this.formTurno, this.idCong).subscribe({
        next: () => {
          this.guardando.set(false);
          this.modalTurno.set(false);
          this.toast.success('Turno actualizado');
          this.cargar();
        },
        error: err => {
          this.guardando.set(false);
          this.toast.error('Error al guardar', err?.error?.detail ?? 'Inténtalo de nuevo.');
        },
      });
      return;
    }

    // Crear: uno por cada día elegido, en paralelo, sin cerrar el modal — así
    // se puede seguir agregando otro grupo de días con un horario distinto
    // sin perder el punto de partida ni tener que reabrir el diálogo.
    const dias = this.diasSeleccionados();
    if (dias.length === 0) return;
    this.guardando.set(true);
    const creaciones = dias.map(dia_semana => this.svc.crearTurno(
      { ...this.formTurno, dia_semana, id_ubicacion_exhibidor: u.id_ubicacion_exhibidor },
      this.idCong,
    ));
    forkJoin(creaciones).subscribe({
      next: () => {
        this.guardando.set(false);
        this.turnosCreadosEnSesion.update(n => n + dias.length);
        this.toast.success(dias.length > 1 ? `${dias.length} turnos creados` : 'Turno creado');
        this.diasSeleccionados.set([]);
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        this.toast.error('Error al guardar', err?.error?.detail ?? 'Inténtalo de nuevo.');
        this.cargar(); // por si alguno de los días sí alcanzó a crearse
      },
    });
  }

  eliminarTurno(): void {
    const t = this.editandoTurno();
    if (!t) return;
    this.svc.eliminarTurno(t.id_turno_exhibidor, this.idCong).subscribe({
      next: () => {
        this.modalTurno.set(false);
        this.toast.success('Turno eliminado');
        this.cargar();
      },
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo eliminar.'),
    });
  }

  // ── Puntos de sacada ───────────────────────────────────────
  private formSacadaVacio(): SacadaForm {
    return { nombre: '', direccion: '', coordenadas: null, referencia: '' };
  }

  abrirSacadas(): void {
    this.resetSacada();
    this.modalSacadas.set(true);
  }

  resetSacada(): void {
    this.editandoSacada.set(null);
    this.creandoSacada.set(false);
    this.formSacada = this.formSacadaVacio();
  }

  /** Botón "Agregar punto de sacada": deja la lista y muestra el formulario vacío. */
  nuevaSacada(): void {
    this.editandoSacada.set(null);
    this.formSacada = this.formSacadaVacio();
    this.creandoSacada.set(true);
  }

  editarSacada(p: PuntoSacada): void {
    this.creandoSacada.set(false);
    this.editandoSacada.set(p);
    this.formSacada = {
      nombre: p.nombre, direccion: p.direccion ?? '',
      coordenadas: p.coordenadas, referencia: p.referencia ?? '',
    };
  }

  guardarSacada(): void {
    const f = this.formSacada;
    const payload = {
      nombre: f.nombre.trim(),
      direccion: f.direccion.trim() || null,
      coordenadas: f.coordenadas,
      referencia: f.referencia.trim() || null,
    };
    this.guardando.set(true);
    const editando = this.editandoSacada();
    const req = editando
      ? this.svc.actualizarPuntoSacada(editando.id_punto_sacada, payload, this.idCong)
      : this.svc.crearPuntoSacada(payload, this.idCong);
    req.subscribe({
      next: () => {
        this.guardando.set(false);
        this.toast.success(editando ? 'Punto actualizado' : 'Punto creado');
        this.resetSacada();
        this.svc.getPuntosSacada(this.idCong).subscribe({ next: d => this.puntosSacada.set(d) });
      },
      error: err => {
        this.guardando.set(false);
        this.toast.error('Error al guardar', err?.error?.detail ?? 'Inténtalo de nuevo.');
      },
    });
  }

  pedirEliminarSacada(p: PuntoSacada): void {
    this.sacadaAEliminar.set(p);
    this.confirmEliminarSacada.set(true);
  }

  eliminarSacada(): void {
    const p = this.sacadaAEliminar();
    if (!p) return;
    this.svc.eliminarPuntoSacada(p.id_punto_sacada, this.idCong).subscribe({
      next: () => {
        this.toast.success('Punto eliminado');
        this.svc.getPuntosSacada(this.idCong).subscribe({ next: d => this.puntosSacada.set(d) });
      },
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo eliminar.'),
    });
  }
}
