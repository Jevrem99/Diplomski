import { Component, inject, ViewChild} from '@angular/core';
import { Router } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { Header } from '../header/header';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-sidebar-menu',
  imports: [
    Header,
    MatSidenavModule,
    RouterOutlet
  ],
  templateUrl: './sidebar-menu.html',
  styleUrl: './sidebar-menu.css',
})
export class SidebarMenu {
 username = localStorage.getItem('username');
  uloga = localStorage.getItem('uloga') || 'asistent';
  
  private router = inject(Router);
  @ViewChild('drawer') drawer!: MatSidenav;

  navigateToMain() {
    this.drawer.close();
    this.router.navigate(['/main']);
  }
  navigateToMojaDezurstva() {
    this.drawer.close();
    this.router.navigate(['/moja-dezurstva']);
  }
  navigateToSettings() {
    this.drawer.close();
    this.router.navigate(['/settings']);
  }

  navigateToDatabaseManagement() {
    this.drawer.close();
    this.router.navigate(['/database-management']);
  }

  // Nova funkcija za asistente
  navigateToMojeObaveze() {
    this.drawer.close();
    this.router.navigate(['/moje-obaveze']);
  }

  logout() {
    localStorage.clear(); // Briše sve ključeve odjednom
    this.router.navigate(['/login']);
  }
}