import { environment } from '../../../environments/environment';
import { AppConfig } from './app-config.token';

export const appConfigFromEnv: AppConfig = { apiBaseUrl: environment.apiUrl };
