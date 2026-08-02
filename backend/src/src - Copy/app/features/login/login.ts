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
      const token = response.token;
      
      // Čuvanje osnovnih podataka
      localStorage.setItem('token', token);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', this.loginData.username);

      // Dekodiranje JWT tokena (bez eksternih biblioteka)
      try {
        const tokenPayload = token.split('.')[1];
        // atob dekodira Base64 string
        const decodedPayload = JSON.parse(atob(tokenPayload));
        
        // Čuvamo ulogu i ID u localStorage
        localStorage.setItem('user_id', decodedPayload.id);
        localStorage.setItem('uloga', decodedPayload.uloga);
        localStorage.setItem('email', decodedPayload.email);
      } catch (error) {
        console.error('Greška pri dekodiranju tokena:', error);
      }
      
      this.router.navigate(['/main']);
    },
    error: (err) => {
      console.error('Greška pri prijavi:', err);
      alert('Pogrešno korisničko ime ili lozinka!');
    }
  });
}

  hide=true;//For hide-show password
}
