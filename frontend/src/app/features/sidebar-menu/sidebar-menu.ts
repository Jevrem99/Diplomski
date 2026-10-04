import { Component, inject, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { Header } from '../header/header';
import { RouterOutlet } from '@angular/router';
import { DesignPickerComponent } from '../../shared/components/design-picker/design-picker.component';

interface NavLink { naziv: string; ruta: string; ikona: string; }

@Component({
  selector: 'app-sidebar-menu',
  imports: [
    Header,
    MatSidenavModule,
    RouterOutlet,
    DesignPickerComponent
  ],
  templateUrl: './sidebar-menu.html',
  styleUrl: './sidebar-menu.css',
})
export class SidebarMenu {
  username = localStorage.getItem('username');
  uloga = localStorage.getItem('uloga') || 'asistent';

  private router = inject(Router);
  @ViewChild('drawer') drawer!: MatSidenav;

  izgledOtvoren = false;

  // Isti spisak stranica koristi bočni meni (dizajn "Panel"); gornja traka i fioka imaju svoje oznake
  get linkovi(): NavLink[] {
    if (this.uloga === 'admin') {
      return [
        { naziv: 'Raspored', ruta: '/main', ikona: 'assets/calendar_icon.png' },
        { naziv: 'Termini kolokvijuma', ruta: '/termini-kolokvijuma', ikona: 'assets/calendar_icon.png' },
        { naziv: 'Upravljaj bazom', ruta: '/database-management', ikona: 'assets/database_management_icon.png' },
        { naziv: 'Zahtevi za zamenu', ruta: '/zahtevi-zamena', ikona: 'assets/calendar_icon.png' },
        { naziv: 'Pregled zaduženja', ruta: '/zaduzenja', ikona: 'assets/settings_icon.png' },
      ];
    }
    return [
      { naziv: 'Moj raspored', ruta: '/moja-dezurstva', ikona: 'assets/calendar_icon.png' },
      { naziv: 'Prijavi odsustvo', ruta: '/moje-obaveze', ikona: 'assets/calendar_icon.png' },
      { naziv: 'Termini kolokvijuma', ruta: '/termini-kolokvijuma', ikona: 'assets/calendar_icon.png' },
    ];
  }

  aktivna(ruta: string): boolean {
    return this.router.url.split('?')[0] === ruta;
  }

  idi(ruta: string): void {
    this.drawer?.close?.();
    this.izgledOtvoren = false;
    this.router.navigate([ruta]);
  }

  navigateToMain() { this.idi('/main'); }
  navigateToMojaDezurstva() { this.idi('/moja-dezurstva'); }
  navigateToSettings() { this.idi('/settings'); }
  navigateToDatabaseManagement() { this.idi('/database-management'); }
  navigateToMojeObaveze() { this.idi('/moje-obaveze'); }
  navigateToZahteviZamena() { this.idi('/zahtevi-zamena'); }
  navigateToZaduzenja() { this.idi('/zaduzenja'); }
  navigateToTerminiKolokvijuma() { this.idi('/termini-kolokvijuma'); }

  logout() {
    // Brišu se samo podaci sesije; izabrana tema i dizajn ostaju za sledeću prijavu
    ['token', 'isLoggedIn', 'username', 'email', 'uloga'].forEach((k) => localStorage.removeItem(k));
    this.router.navigate(['/login']);
  }
}
