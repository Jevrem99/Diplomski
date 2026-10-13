import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

// Povratna stranica posle prijave na PMF (IMI): /auth/callback?token=...
// Token se odmah sklanja iz adrese, šalje našem serveru, a server ga proverava kod IMI-ja.
@Component({
  selector: 'app-pmf-callback',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full text-center">
        @if (greska()) {
          <h1 class="text-lg font-bold mb-2">Prijava preko PMF naloga nije uspela</h1>
          <p class="text-sm mb-4" data-testid="pmf-greska">{{ greska() }}</p>
          <a routerLink="/login" class="font-bold underline">Nazad na prijavu</a>
        } @else {
          <p class="text-sm" data-testid="pmf-ceka">Prijava je u toku…</p>
        }
      </div>
    </div>
  `
})
export class PmfCallback implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  greska = signal<string | null>(null);

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    // Token ne sme da ostane u adresi / istoriji pregledača
    history.replaceState(null, '', window.location.pathname);

    if (!token) {
      this.greska.set('Nedostaje podatak za prijavu. Pokušajte ponovo sa stranice za prijavu.');
      return;
    }

    this.auth.prijavaPmf(token).subscribe({
      next: (res: any) => {
        const payload = JSON.parse(atob(res.token.split('.')[1]));
        const uloga = payload.uloga || 'asistent';
        localStorage.setItem('token', res.token);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', payload.username || '');
        localStorage.setItem('email', payload.email || '');
        localStorage.setItem('uloga', uloga);
        this.router.navigate([this.auth.pocetnaStranica(uloga)], { replaceUrl: true });
      },
      error: (err) => {
        this.greska.set(err?.error?.error || 'Server trenutno nije dostupan. Pokušajte ponovo kasnije.');
      }
    });
  }
}
