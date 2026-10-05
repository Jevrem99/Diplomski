import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DESIGNS, DesignId, DesignService } from '../../../core/services/design.service';
import { ThemeService } from '../../../core/services/theme';

// Izbor dizajna (4 kartice sa malim pregledom) + prekidač svetle/tamne teme.
// Koristi se u Podešavanjima i u iskačućem meniju "Izgled" u gornjoj traci.
@Component({
  selector: 'app-design-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dp-root">
      <div class="dp-grid" role="radiogroup" aria-label="Izbor dizajna">
        @for (d of designs; track d.id) {
          <button type="button" class="dp-card" role="radio" [attr.aria-checked]="designService.design() === d.id"
                  [class.dp-active]="designService.design() === d.id" (click)="izaberi(d.id)">
            <!-- mali pregled rasporeda -->
            <span class="dp-preview" [ngClass]="'dp-' + d.id" aria-hidden="true">
              <span class="dp-nav"></span>
              <span class="dp-body">
                <span class="dp-side"></span>
                <span class="dp-main"><i></i><i></i><i></i></span>
              </span>
            </span>
            <span class="dp-name">{{ d.naziv }}</span>
          </button>
        }
      </div>

      <label class="dp-theme">
        <span>Tamna tema</span>
        <input type="checkbox" [checked]="themeService.isDarkMode()" (change)="themeService.toggleTheme()" />
      </label>
    </div>
  `,
  styles: [`
    .dp-root { display: flex; flex-direction: column; gap: 14px; }
    .dp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
    .dp-card {
      display: flex; flex-direction: column; gap: 6px; text-align: left; cursor: pointer;
      padding: 10px; border-radius: 12px; border: 2px solid var(--border-strong);
      background: var(--surface); color: var(--text); font: inherit;
      transition: border-color .15s, transform .15s;
    }
    .dp-card:hover { border-color: var(--primary); transform: translateY(-1px); }
    .dp-active { border-color: var(--primary); box-shadow: 0 0 0 3px var(--tint-blue-bd); }
    .dp-name { font-weight: 800; font-size: .95rem; }

    /* ---- mali pregledi (fiksne boje, ne zavise od izabranog dizajna) ---- */
    .dp-preview { display: flex; flex-direction: column; height: 84px; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; background: #e9f0f8; }
    .dp-nav { height: 14px; background: #1F63A0; flex-shrink: 0; }
    .dp-body { display: flex; flex: 1; gap: 5px; padding: 5px; min-height: 0; }
    .dp-side { width: 26%; background: #fff; border-radius: 3px; border: 1px solid #cbd5e1; }
    .dp-main { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
    .dp-main i { background: #fff; border: 1px solid #cbd5e1; border-radius: 3px; display: block; }

    .dp-staklo { background: linear-gradient(135deg, #a5b4fc, #7dd3fc 55%, #f0abfc); }
    .dp-staklo .dp-nav { background: rgba(255,255,255,.55); margin: 5px 6px 0; border-radius: 8px; height: 12px; border: 1px solid rgba(255,255,255,.8); }
    .dp-staklo .dp-side, .dp-staklo .dp-main i { background: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.85); border-radius: 6px; }

    .dp-panel { flex-direction: row; background: #f3f5f9; }
    .dp-panel .dp-nav { width: 24%; height: auto; background: #0b1f2a; }
    .dp-panel .dp-body { flex-direction: row; }
    .dp-panel .dp-side { background: #0f766e; border: 0; width: 18%; opacity: .85; }
    .dp-panel .dp-main i { border-radius: 4px; }

    .dp-minimal { background: #fafafa; }
    .dp-minimal .dp-nav { background: #fff; border-bottom: 1px solid #d4d4d8; }
    .dp-minimal .dp-side { background: #fff; border: 1px solid #e4e4e7; border-radius: 2px; }
    .dp-minimal .dp-main i { background: transparent; border: 0; border-bottom: 1px solid #d4d4d8; border-radius: 0; }
    .dp-minimal .dp-main i:nth-child(2) { border-left: 3px solid #18181b; }

    .dp-mekano { background: #e0e5ec; }
    .dp-mekano .dp-nav { background: #e0e5ec; box-shadow: 0 3px 6px #a3b1c6; }
    .dp-mekano .dp-side { background: #e0e5ec; border: 0; border-radius: 6px; box-shadow: 2px 2px 4px #a3b1c6, -2px -2px 4px #fff; }
    .dp-mekano .dp-main i { background: #e0e5ec; border: 0; border-radius: 6px; box-shadow: inset 2px 2px 4px #a3b1c6, inset -2px -2px 4px #fff; }

    .dp-organski { background: #f3eee3; }
    .dp-organski .dp-nav { background: #4d6b45; margin: 5px 6px 0; border-radius: 999px; height: 11px; }
    .dp-organski .dp-side { background: #fffaf0; border: 1px solid #e6dcc6; border-radius: 12px; }
    .dp-organski .dp-main i { background: #fffaf0; border: 1px solid #e6dcc6; border-radius: 12px; }
    .dp-organski .dp-main i:nth-child(2) { background: #dfeccf; }

    .dp-kontrast { background: #fff4d6; }
    .dp-kontrast .dp-nav { background: #ffd23f; border-bottom: 2px solid #111; }
    .dp-kontrast .dp-side, .dp-kontrast .dp-main i { border: 2px solid #111; border-radius: 3px; box-shadow: 2px 2px 0 #111; }
    .dp-kontrast .dp-main i:nth-child(2) { background: #8ec5ff; }

    .dp-theme { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-weight: 700; font-size: .9rem; color: var(--text); cursor: pointer;
      padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
    .dp-theme input { width: 38px; height: 20px; accent-color: var(--primary); cursor: pointer; }
  `]
})
export class DesignPickerComponent {
  designService = inject(DesignService);
  themeService = inject(ThemeService);
  designs = DESIGNS;

  izaberi(id: DesignId): void {
    this.designService.set(id);
  }
}
