import { Component, inject } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';

// Sopstveni stilovi (ne Tailwind klase), da ih tema ne prepiše: tema boji sve ivice istom bojom
@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    @if (loadingService.isLoading()) {
      <div class="sp-pozadina">
        <div class="sp-kartica"><div class="sp-krug"></div></div>
      </div>
    }
  `,
  styles: [`
    .sp-pozadina {
      position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center;
      background: rgba(15, 23, 42, 0.3); backdrop-filter: blur(2px);
    }
    .sp-kartica { padding: 20px; border-radius: 16px; background: var(--surface, #fff); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25); }
    .sp-krug {
      width: 40px; height: 40px; border-radius: 50%;
      border: 4px solid var(--border, #e2e8f0); border-top-color: #34b9f7;
      animation: sp-okret 0.9s linear infinite;
    }
    @keyframes sp-okret { to { transform: rotate(360deg); } }
  `]
})
export class SpinnerComponent {
  loadingService = inject(LoadingService);
}
