import { Provider } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './http/auth.interceptor';
import { errorInterceptor } from './http/error.interceptor';
import { APP_CONFIG } from './config/app-config.token';
import { appConfigFromEnv } from './config/environment.adapter';
import { AuthService } from './auth/auth.service';
import { LoggerService } from './utils/logger.service';

export const CORE_PROVIDERS: any[] = [
  provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
  { provide: APP_CONFIG, useValue: appConfigFromEnv },
  AuthService,
  LoggerService,
];
