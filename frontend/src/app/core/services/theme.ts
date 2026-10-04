import { inject, Injectable, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Koristimo Angular Signal za jednostavno praćenje stanja
  isDarkMode = signal<boolean>(false);
  private router = inject(Router);

  constructor() {
    this.initTheme();
    this.listenToRouteChanges();
  }

  private initTheme(): void {
    // Provera da li već postoji sačuvana tema u localStorage-u
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      this.isDarkMode.set(savedTheme === 'dark');
    } else {
      // Ako nema sačuvane teme, proveri sistemska podešavanja operativnog sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkMode.set(prefersDark);
    }

    this.applyTheme();
  }

  private listenToRouteChanges(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.urlAfterRedirects.includes('/login')) {
        document.body.classList.remove('dark-theme');  //Login nema svetlu temu
        document.documentElement.style.colorScheme = 'light';
      } else {
        this.applyTheme();
      }
    });
  }

  toggleTheme(): void {
    this.isDarkMode.update(isDark => !isDark);
    localStorage.setItem('theme', this.isDarkMode() ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme(): void {
    // color-scheme mora na <html>: Angular Material boje (light-dark()) se računaju na tom elementu
    document.documentElement.style.colorScheme = this.isDarkMode() ? 'dark' : 'light';
    if (this.isDarkMode()) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
}