import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Only logged-in users get into the tracker. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  auth.syncSession();

  return auth.token
    ? true
    : inject(Router).createUrlTree([ '/login' ], { queryParams: { returnUrl: state.url } });
};

/** A logged-in user has nothing to do on the login page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  auth.syncSession();

  return auth.token ? inject(Router).createUrlTree([ '/' ]) : true;
};
