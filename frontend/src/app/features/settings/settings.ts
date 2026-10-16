import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { ThemeService } from '../../core/services/theme';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';
import { DesignPickerComponent } from '../../shared/components/design-picker/design-picker.component';

import { proveriLozinku } from '../../core/utils/validacija';
import { PotvrdaService } from '../../core/services/potvrda.service';
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [SidebarMenu, CommonModule, FormsModule, DesignPickerComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {
  themeService = inject(ThemeService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private potvrda = inject(PotvrdaService);
  private cdr = inject(ChangeDetectorRef);
  private API_URL = environment.apiUrl;

  // Podaci za prikaz
  userInfo = {
    username: '',
    email: '',
    uloga: ''
  };

  // Podaci za promenu lozinke
  passwordData = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  // --- LOGIKA ZA BOJE GODINA ---
  defaultGodinaColors: Record<number, string> = {
    1: '#8EA9DB',
    2: '#F4B183',
    3: '#FFD966',
    4: '#A9D18E',
    5: '#00B0F0'
  };

  godinaColors: Record<number, string> = { ...this.defaultGodinaColors };

  ngOnInit(): void {
    this.loadSavedColors();
    if (localStorage.getItem('uloga') === 'admin') this.ucitajIntegraciju();

    // Čupamo podatke iz localStorage-a da ih prikažemo korisniku
    this.userInfo.username = localStorage.getItem('username') || 'Nepoznato';
    this.userInfo.email = localStorage.getItem('email') || 'Nije uneto';
    
    const sirovaUloga = localStorage.getItem('uloga') || 'Korisnik';
    // Malo ulepšavamo ispis uloge
    this.userInfo.uloga = sirovaUloga.charAt(0).toUpperCase() + sirovaUloga.slice(1);
  }

  // Integracija (samo administrator)
  integracija: { kljucPodesen: boolean; kljucIzvor: string | null; postUrl: string | null; postKljucPodesen: boolean } | null = null;
  noviKljuc: string | null = null;
  postUrlUnos = '';
  postKljucUnos = '';
  slanjeUToku = false;

  get jeAdmin(): boolean {
    return localStorage.getItem('uloga') === 'admin';
  }

  get adresaPreuzimanja(): string {
    const osnova = this.API_URL.startsWith('http') ? this.API_URL : window.location.origin + this.API_URL;
    return `${osnova}/integracije/rezervacije-sala`;
  }

  private primeniIntegraciju(i: any): void {
    this.integracija = i;
    this.postUrlUnos = i.postUrl || '';
    this.postKljucUnos = '';
    this.cdr.detectChanges();
  }

  ucitajIntegraciju(): void {
    this.http.get<any>(`${this.API_URL}/admin/integracija`).subscribe({
      next: (i) => this.primeniIntegraciju(i),
      error: () => this.toast.show('Podešavanja nisu učitana.', 'error')
    });
  }

  async napraviNoviKljuc(): Promise<void> {
    if (this.integracija?.kljucPodesen) {
      const ok = await this.potvrda.pitaj({
        naslov: 'Novi ključ',
        poruka: 'Sadašnji ključ prestaje da važi. Novi ključ morate poslati fakultetu.',
        potvrdi: 'Napravi',
        opasno: true
      });
      if (!ok) return;
    }
    this.http.post<{ kljuc: string }>(`${this.API_URL}/admin/integracija/kljuc`, {}).subscribe({
      next: (r) => {
        this.noviKljuc = r.kljuc;
        this.ucitajIntegraciju();
      },
      error: () => this.toast.show('Ključ nije napravljen.', 'error')
    });
  }

  async ukloniKljuc(): Promise<void> {
    const ok = await this.potvrda.pitaj({
      naslov: 'Uklanjanje ključa',
      poruka: 'Preuzimanje sa ovim ključem prestaje da radi.',
      potvrdi: 'Ukloni',
      opasno: true
    });
    if (!ok) return;
    this.http.delete<any>(`${this.API_URL}/admin/integracija/kljuc`).subscribe({
      next: (i) => { this.noviKljuc = null; this.primeniIntegraciju(i); this.toast.show('Ključ je uklonjen.', 'success'); },
      error: () => this.toast.show('Ključ nije uklonjen.', 'error')
    });
  }

  kopiraj(tekst: string): void {
    navigator.clipboard?.writeText(tekst).then(
      () => this.toast.show('Kopirano.', 'success'),
      () => this.toast.show('Kopiranje nije uspelo, označite tekst ručno.', 'error')
    );
  }

  sacuvajSlanje(): void {
    const telo: any = { url: this.postUrlUnos.trim() };
    if (this.postKljucUnos) telo.kljuc = this.postKljucUnos;
    this.http.put<any>(`${this.API_URL}/admin/integracija/slanje`, telo).subscribe({
      next: (i) => { this.primeniIntegraciju(i); this.toast.show('Sačuvano.', 'success'); },
      error: (err) => this.toast.show(err.error?.error || 'Čuvanje nije uspelo.', 'error')
    });
  }

  obrisiKljucZaSlanje(): void {
    this.http.put<any>(`${this.API_URL}/admin/integracija/slanje`, { url: this.integracija?.postUrl || '', kljuc: '' }).subscribe({
      next: (i) => { this.primeniIntegraciju(i); this.toast.show('Ključ za slanje je obrisan.', 'success'); },
      error: (err) => this.toast.show(err.error?.error || 'Brisanje nije uspelo.', 'error')
    });
  }

  probnoSlanje(): void {
    this.slanjeUToku = true;
    this.http.post<any>(`${this.API_URL}/admin/integracija/slanje/proba`, {}).subscribe({
      next: (r) => {
        this.slanjeUToku = false;
        this.toast.show(r.poslato ? `Poslato (${r.broj}).` : `Slanje nije uspelo: ${r.greska}`, r.poslato ? 'success' : 'error');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.slanjeUToku = false;
        this.toast.show(err.error?.error || 'Slanje nije uspelo.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  loadSavedColors(): void {
    if (localStorage.getItem('app_godina_colors_v') !== '2') {
      localStorage.removeItem('app_godina_colors');
      localStorage.setItem('app_godina_colors_v', '2');
    }
    const saved = localStorage.getItem('app_godina_colors');
    if (saved) {
      try {
        this.godinaColors = { ...this.defaultGodinaColors, ...JSON.parse(saved) };
      } catch (e) {
        this.godinaColors = { ...this.defaultGodinaColors };
      }
    }
  }

  saveColors(): void {
    localStorage.setItem('app_godina_colors', JSON.stringify(this.godinaColors));
    this.toast.show('Boje godina su uspešno sačuvane!', 'success');
  }

  resetColorsToDefault(): void {
    this.godinaColors = { ...this.defaultGodinaColors };
    this.saveColors();
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  promeniLozinku() {
    if (!this.passwordData.oldPassword || !this.passwordData.newPassword || !this.passwordData.confirmPassword) {
      this.toast.show('Sva polja moraju biti popunjena!', 'error');
      return;
    }

    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.toast.show('Nove lozinke se ne poklapaju!', 'error');
      return;
    }

    const greskaLozinke = proveriLozinku(this.passwordData.newPassword);
    if (greskaLozinke) {
      this.toast.show(greskaLozinke, 'error');
      return;
    }

    const payload = {
      username: this.userInfo.username,
      oldPassword: this.passwordData.oldPassword,
      newPassword: this.passwordData.newPassword
    };

    this.http.post(`${this.API_URL}/users/change-password`, payload).subscribe({
      next: (res: any) => {
        this.toast.show(res.message || 'Lozinka uspešno promenjena!', 'success');
        
        // Eksplicitno čišćenje svakog polja
        this.passwordData.oldPassword = '';
        this.passwordData.newPassword = '';
        this.passwordData.confirmPassword = '';
      },
      error: (err) => {
        console.error('Greška:', err);
        this.toast.show(err.error?.error || 'Došlo je do greške.', 'error');
      }
    });
  }
}