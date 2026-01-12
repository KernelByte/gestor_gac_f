import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoggerService } from '../utils/logger.service';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      logger.error('HTTP Error', err);
      return throwError(() => err);
    })
  );
};
