import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Main } from './components/main/main'; 
import { authGuard } from './guards/auth-guard';
import { DatabaseManagement } from './components/database-management/database-management';
import { Settings } from './components/settings/settings';
import { SidebarMenu } from './components/sidebar-menu/sidebar-menu';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    {path: 'login', component: Login},
    {
        path: '',
        component: SidebarMenu,
        canActivate: [authGuard],
        children: [
            { path: 'main', component: Main },
            { path: 'database-management', component: DatabaseManagement },
            { path: 'settings', component: Settings }
        ]
    },
    { path: '**', redirectTo: 'login' }
];
