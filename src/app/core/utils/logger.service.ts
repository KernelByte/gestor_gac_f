import { Injectable } from '@angular/core';

@Injectable()
export class LoggerService {
  log(...args: any[]) { console.log('[LOG]', ...args); }
  info(...args: any[]) { console.info('[INFO]', ...args); }
  warn(...args: any[]) { console.warn('[WARN]', ...args); }
  error(...args: any[]) { console.error('[ERROR]', ...args); }
}
