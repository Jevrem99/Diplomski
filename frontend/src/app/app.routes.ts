import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Main } from './components/main/main'; 
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    {path: 'login', component: Login},
    {path: 'main', component: Main, canActivate: [authGuard]},
    { path: '**', redirectTo: 'login' }
];
