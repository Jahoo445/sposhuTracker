import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../config';
import { AuthService } from './auth.service';

/** Adds the session token to backend requests and sends the user to the login when it is rejected. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(API_BASE_URL) || request.url.endsWith('/auth/google')) {
    return next(request);
  }

  const auth = inject(AuthService);
  // Picks up a sign-in or sign-out in SpoShu before the request goes out.
  auth.syncSession();
  const token = auth.token;
  const authorized = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        auth.logout();
      }

      return throwError(() => error);
    })
  );
};
