import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ThemeService } from './core/services/theme';
import { DesignService } from './core/services/design.service';
import { PismoService } from './core/services/pismo.service';
import { SpinnerComponent } from './shared/components/spinner/spinner.component'; // <--- DODAJ
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ToastComponent,
    SpinnerComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})

export class App {
  protected readonly title = signal('frontend');
  private themeService = inject(ThemeService);
  private designService = inject(DesignService);
  private pismoService = inject(PismoService);

  constructor() {
    // Ćirilica je podrazumevano pismo: tekstovi se preslovljavaju u trenutku prikaza (vidi PismoService)
    this.pismoService.pokreni();
  }
}
