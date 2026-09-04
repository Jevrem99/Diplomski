import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../core/services/loading.service';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loadingService.isLoading()) {
      <div class="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] transition-all">
        <div class="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl shadow-2xl border border-slate-100">
          <div class="w-10 h-10 border-4 border-slate-100 border-t-[#34b9f7] rounded-full animate-spin"></div>
          <span class="text-xs font-bold text-slate-700 tracking-wide">Učitavanje podataka...</span>
        </div>
      </div>
    }
  `
})
export class SpinnerComponent {
  loadingService = inject(LoadingService);
}