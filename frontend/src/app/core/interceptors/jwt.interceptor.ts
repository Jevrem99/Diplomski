import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

const SESSION_KEYS = ['token', 'isLoggedIn', 'username', 'email', 'uloga'];

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  // Ako imamo sačuvan JWT token, lepi ga u Authorization header
  const outgoing = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      // Istekao ili nevažeći token (ne računa se pogrešna lozinka na samoj prijavi) -> nazad na login
      if (err instanceof HttpErrorResponse && err.status === 401 && token && !req.url.includes('/auth/login')) {
        SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
