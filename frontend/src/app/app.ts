import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Login } from './features/login/login';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ThemeService } from './core/services/theme';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Login,ToastComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})

export class App {
  protected readonly title = signal('frontend');
  private themeService = inject(ThemeService);
}
