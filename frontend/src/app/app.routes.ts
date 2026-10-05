import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role.guard';

// Svaka stranica se učitava tek kad je korisnik otvori (manji početni bundle, brže pokretanje)
export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./features/login/login').then(m => m.Login) },
  {
    path: '',
    loadComponent: () => import('./features/sidebar-menu/sidebar-menu').then(m => m.SidebarMenu),
    canActivate: [authGuard],
    children: [
      {
        path: 'main',
        loadComponent: () => import('./features/main/main').then(m => m.Main),
        canActivate: [roleGuard(['admin'])]
      },
      {
        path: 'database-management',
        loadComponent: () => import('./features/database-management/database-management').then(m => m.DatabaseManagement),
        canActivate: [roleGuard(['admin'])]
      },
      {
        path: 'zahtevi-zamena',
        loadComponent: () => import('./features/zahtevi-zamena/zahtevi-zamena.component').then(m => m.ZahteviZamenaComponent),
        canActivate: [roleGuard(['admin'])]
      },
      { path: 'settings', loadComponent: () => import('./features/settings/settings').then(m => m.Settings) },
      { path: 'zaduzenja', loadComponent: () => import('./features/zaduzenja/zaduzenja.component').then(m => m.ZaduzenjaComponent) },
      { path: 'moje-obaveze', loadComponent: () => import('./features/moje-obaveze/moje-obaveze.component').then(m => m.MojeObaveze) },
      { path: 'termini-kolokvijuma', loadComponent: () => import('./termini-kolokvijuma/termini-kolokvijuma').then(m => m.TerminiKolokvijuma) },
      { path: 'moja-dezurstva', loadComponent: () => import('./features/moja-dezurstva/moja-dezurstva.component').then(m => m.MojaDezurstva) }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
