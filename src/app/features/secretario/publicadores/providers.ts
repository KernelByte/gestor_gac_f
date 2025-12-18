import { Provider } from '@angular/core';
import { PUBLICADOR_REPO } from './application/tokens';
import { HttpPublicadorRepo } from './infrastructure/adapters/http-publicador-repo';
import { PublicadoresFacade } from './application/publicadores.facade';

// Feature-scoped providers: bind domain port to infrastructure adapter and expose facade
export const PUBLICADORES_PROVIDERS: Provider[] = [
	{ provide: PUBLICADOR_REPO, useClass: HttpPublicadorRepo },
	PublicadoresFacade
];
