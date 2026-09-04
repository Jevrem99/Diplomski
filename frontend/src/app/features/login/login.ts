import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NgOptimizedImage, CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    NgOptimizedImage,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    FormsModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private API_URL = 'http://localhost:5000';

  loginData = { username: '', password: '' };
  hide = true;

  // Stanja za forgot / reset
  prikazModala = 'login'; // 'login' | 'forgot' | 'reset'
  forgotEmail = '';
  newPassword = '';
  confirmNewPassword = '';
  resetToken = '';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['resetToken']) {
        this.resetToken = params['resetToken'];
        this.prikazModala = 'reset';
      }
    });
  }

  onLogin() {
    this.authService.login(this.loginData).subscribe({
      next: (response) => {
        const payload = JSON.parse(atob(response.token.split('.')[1]));
        const uloga = payload.uloga || 'asistent';
        localStorage.setItem('token', response.token);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', this.loginData.username);
        localStorage.setItem('email', payload.email || '');
        localStorage.setItem('uloga', uloga);
        
        if (uloga === 'asistent') {
          this.router.navigate(['/moja-dezurstva']);
        } else {
          this.router.navigate(['/main']);
        }
      },
      error: () => {
        this.toast.show('Pogrešno korisničko ime ili lozinka!', 'error');
      }
    });
  }

  posaljiResetEmail() {
    if (!this.forgotEmail) {
      this.toast.show('Unesite vašu email adresu!', 'error');
      return;
    }
    this.http.post<any>(`${this.API_URL}/auth/forgot-password`, { email: this.forgotEmail }).subscribe({
      next: (res) => {
        this.toast.show(res.message || 'Zahtev je poslat.', 'success');
        this.prikazModala = 'login';
        this.forgotEmail = '';
      },
      error: (err) => {
        this.toast.show(err.error?.error || 'Došlo je do greške.', 'error');
      }
    });
  }

  promeniZaboravljenuLozinku() {
    if (!this.newPassword || !this.confirmNewPassword) {
      this.toast.show('Popunite sva polja!', 'error');
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      this.toast.show('Lozinke se ne poklapaju!', 'error');
      return;
    }

    this.http.post<any>(`${this.API_URL}/auth/reset-password`, {
      token: this.resetToken,
      newPassword: this.newPassword
    }).subscribe({
      next: (res) => {
        this.toast.show('Lozinka je uspešno promenjena!', 'success');

        if (res.token) {
          const payload = JSON.parse(atob(res.token.split('.')[1]));
          const uloga = payload.uloga || 'asistent';

          localStorage.setItem('token', res.token);
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('username', payload.username || '');
          localStorage.setItem('email', payload.email || '');
          localStorage.setItem('uloga', uloga);

          // Čistimo query parametar iz URL-a
          this.router.navigate([], { queryParams: {} });

          // Redirekcija na odgovarajući početni ekran
          if (uloga === 'asistent') {
            this.router.navigate(['/moja-dezurstva']);
          } else {
            this.router.navigate(['/main']);
          }
        } else {
          this.prikazModala = 'login';
          this.router.navigate(['/login']);
        }
      },
      error: (err) => {
        this.toast.show(err.error?.error || 'Link je nevažeći ili je istekao.', 'error');
      }
    });
  }
}