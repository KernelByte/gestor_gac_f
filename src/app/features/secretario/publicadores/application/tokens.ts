import { InjectionToken } from '@angular/core';
import { PublicadorRepo } from '../domain/ports/publicador-repo';
import { PublicadoresFacade } from './publicadores.facade';

export const PUBLICADOR_REPO = new InjectionToken<PublicadorRepo>('PublicadorRepo');

export const PUBLICADORES_FACADE = new InjectionToken<PublicadoresFacade>('PublicadoresFacade');
