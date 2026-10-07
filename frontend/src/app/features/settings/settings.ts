import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { ThemeService } from '../../core/services/theme';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';
import { DesignPickerComponent } from '../../shared/components/design-picker/design-picker.component';

import { proveriLozinku } from '../../core/utils/validacija';
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

    // Čupamo podatke iz localStorage-a da ih prikažemo korisniku
    this.userInfo.username = localStorage.getItem('username') || 'Nepoznato';
    this.userInfo.email = localStorage.getItem('email') || 'Nije uneto';
    
    const sirovaUloga = localStorage.getItem('uloga') || 'Korisnik';
    // Malo ulepšavamo ispis uloge
    this.userInfo.uloga = sirovaUloga.charAt(0).toUpperCase() + sirovaUloga.slice(1);
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