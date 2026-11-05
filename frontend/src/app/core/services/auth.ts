import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private http = inject(HttpClient); 
  
  private apiUrl = `${environment.apiUrl}/auth/login`;

  login(credentials: any): Observable<any> {
    return this.http.post(this.apiUrl, credentials);
  }

  // Posle povratka sa PMF prijave: server proverava token kod IMI-ja i izdaje našu sesiju
  prijavaPmf(token: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/pmf`, { token });
  }

  // Adresa PMF prijave dolazi sa servera (.env); IMI posle prijave vraća korisnika na našu /auth/callback stranicu
  pmfPodesavanja(): Observable<{ prijavaUrl: string }> {
    return this.http.get<{ prijavaUrl: string }>(`${environment.apiUrl}/auth/pmf-podesavanja`);
  }

  pmfPrijavaAdresa(osnova: string): string {
    const povratak = `${window.location.origin}/auth/callback`;
    return `${osnova}?redirect_uri=${encodeURIComponent(povratak)}`;
  }

  pocetnaStranica(uloga: string): string {
    if (uloga === 'admin') return '/raspored';
    if (uloga === 'profesor') return '/termini-kolokvijuma';
    return '/moja-dezurstva';
  }
}