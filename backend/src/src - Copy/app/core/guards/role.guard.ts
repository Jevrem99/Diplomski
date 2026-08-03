import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const uloga = localStorage.getItem('uloga') || 'asistent';

    if (allowedRoles.includes(uloga)) {
      return true;
    }

    // Ako uloga nije dozvoljena, preusmeravamo ga na njegovu početnu stranicu
    if (uloga === 'asistent') {
      router.navigate(['/moja-dezurstva']);
    } else {
      router.navigate(['/main']);
    }
    return false;
  };
};