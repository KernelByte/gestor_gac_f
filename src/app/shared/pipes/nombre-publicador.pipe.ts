import { Pipe, PipeTransform } from '@angular/core';
import {
  ConNombre,
  FormatoNombre,
  inicialesDe,
  nombreLegal,
  nombreMostrado,
} from '../../core/utils/nombre.util';

/**
 * Publicador → el nombre con el que se le conoce en la app.
 *
 * `{{ pub | nombrePublicador }}` en vez de repetir la concatenación de los
 * cuatro campos en cada plantilla. Antes había ~55 sitios haciéndolo por su
 * cuenta y con tres formatos distintos, así que el mismo publicador salía
 * escrito de forma diferente según la pantalla.
 *
 * Es puro: sólo recalcula si cambia la referencia del publicador.
 */
@Pipe({ name: 'nombrePublicador', standalone: true })
export class NombrePublicadorPipe implements PipeTransform {
  transform(pub: ConNombre | null | undefined, formato: FormatoNombre = 'completo'): string {
    return nombreMostrado(pub, formato);
  }
}

/**
 * Publicador → el nombre de su ficha, sin alias ni regla.
 *
 * Para la línea secundaria de la pantalla de Publicadores, donde hay que poder
 * ver a quién corresponde realmente un alias como "Juanca".
 */
@Pipe({ name: 'nombreLegalPublicador', standalone: true })
export class NombreLegalPublicadorPipe implements PipeTransform {
  transform(pub: ConNombre | null | undefined): string {
    return nombreLegal(pub);
  }
}

/**
 * Publicador → sus iniciales, derivadas del nombre mostrado.
 *
 * Evita el desajuste de un avatar "JP" junto al texto "Juan Gómez".
 */
@Pipe({ name: 'inicialesPublicador', standalone: true })
export class InicialesPublicadorPipe implements PipeTransform {
  transform(
    pub: ConNombre | string | null | undefined,
    formato: FormatoNombre = 'completo',
  ): string {
    return inicialesDe(pub, formato);
  }
}
