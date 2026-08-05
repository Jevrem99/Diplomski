import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { ThemeService } from '../../core/services/theme';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [SidebarMenu, CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings implements OnInit {
  themeService = inject(ThemeService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private API_URL = 'http://localhost:5000';

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

  ngOnInit(): void {
    // Čupamo podatke iz localStorage-a da ih prikažemo korisniku
    this.userInfo.username = localStorage.getItem('username') || 'Nepoznato';
    this.userInfo.email = localStorage.getItem('email') || 'Nije uneto';
    
    const sirovaUloga = localStorage.getItem('uloga') || 'Korisnik';
    // Malo ulepšavamo ispis uloge
    this.userInfo.uloga = sirovaUloga.charAt(0).toUpperCase() + sirovaUloga.slice(1);
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

    if (this.passwordData.newPassword.length < 6) {
      this.toast.show('Nova lozinka mora imati bar 6 karaktera!', 'error');
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