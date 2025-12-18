import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { CORE_PROVIDERS } from './core/providers';
import { PUBLICADOR_REPO } from './features/secretario/publicadores/application/tokens';
import { HttpPublicadorRepo } from './features/secretario/publicadores/infrastructure/adapters/http-publicador-repo';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    ...CORE_PROVIDERS,
    // global repo binding for Publicadores feature
    { provide: PUBLICADOR_REPO, useClass: HttpPublicadorRepo },
  ]
};
