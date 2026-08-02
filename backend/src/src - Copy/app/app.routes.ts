import { Routes } from '@angular/router';
import { Login } from './features/login/login';
import { Main } from './features/main/main'; 
import { authGuard } from './core/guards/auth-guard';
import { DatabaseManagement } from './features/database-management/database-management';
import { Settings } from './features/settings/settings';
import { SidebarMenu } from './features/sidebar-menu/sidebar-menu';
import { MojeObaveze } from './features/moje-obaveze/moje-obaveze.component';
import { MojaDezurstva } from './features/moja-dezurstva/moja-dezurstva.component';
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
            { path: 'settings', component: Settings },
            { path: 'moje-obaveze', component: MojeObaveze },
            { path: 'moja-dezurstva', component: MojaDezurstva }
        ]
    },
    { path: '**', redirectTo: 'login' }
];
