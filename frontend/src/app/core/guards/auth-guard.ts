import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const SESSION_KEYS = ['token', 'isLoggedIn', 'username', 'email', 'uloga'];

// Token postoji i njegov "exp" još nije prošao (server svakako proverava potpis)
const tokenJeVazeci = (token: string | null): boolean => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (tokenJeVazeci(localStorage.getItem('token'))) {
    return true;
  }

  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
  router.navigate(['/login']);
  return false;
};
