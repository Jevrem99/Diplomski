import { Component, inject} from '@angular/core';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button'
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms'; 
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [
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
export class Login{

  private router = inject(Router);
  private authService = inject(AuthService);

  loginData = { username: '', password: '' };

  onLogin() {
    this.authService.login(this.loginData).subscribe({
      next: (response) => {
        // Dekodiramo ulogu iz JWT tokena ili iz servisa
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
      error: (err) => {
        console.error('Greška pri prijavi:', err);
        alert('Pogrešno korisničko ime ili lozinka!');
      }
    });
  }

  hide=true;//For hide-show password
}
