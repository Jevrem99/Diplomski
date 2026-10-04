import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

// Kratkotrajni keš za liste koje više delova aplikacije traži istovremeno (učionice, profesori, obaveze).
// Isti zahtev se šalje jednom, a svi ostali dobijaju isti odgovor; posle isteka vremena (TTL) ide novi.
@Injectable({ providedIn: 'root' })
export class DataCacheService {
  private http = inject(HttpClient);
  private cache = new Map<string, { vreme: number; obs: Observable<any> }>();

  get<T>(putanja: string, ttlMs = 60_000): Observable<T> {
    const sada = Date.now();
    const kesirano = this.cache.get(putanja);
    if (kesirano && sada - kesirano.vreme < ttlMs) return kesirano.obs as Observable<T>;

    const obs = this.http.get<T>(`${environment.apiUrl}${putanja}`).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.cache.set(putanja, { vreme: sada, obs });
    return obs;
  }

  // Poziva se posle izmena koje menjaju te liste (bez argumenta briše sve)
  invalidate(putanja?: string): void {
    if (putanja) this.cache.delete(putanja);
    else this.cache.clear();
  }
}
