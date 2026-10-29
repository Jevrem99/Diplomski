import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Predmet {
  id: number;
  naziv: string;
  smer?: string;
  godina?: number;
}

export interface TerminKolokvijuma {
  id?: number;
  predmet_id: number;
  k1_datum?: string | null;
  k1_trajanje?: number | null;
  k1_racunarska_sala: boolean;
  k2_datum?: string | null;
  k2_trajanje?: number | null;
  k2_racunarska_sala: boolean;
  k3_datum?: string | null;
  k3_trajanje?: number | null;
  k3_racunarska_sala: boolean;
  popravni_u_terminu_ispita: boolean;
  popravni_trajanje?: number | null;
  popravni_racunarska_sala: boolean;
  napomena?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class TerminiKolokvijumaService {
  private http = inject(HttpClient);
  private apiUrl = '/api/termini-kolokvijuma'; // Prilagodi tvojoj backend ruti

  // Dodata metoda za dobavljanje predmeta ulogovanog korisnika
  getMojiPredmeti(): Observable<Predmet[]> {
    return this.http.get<Predmet[]>(`${this.apiUrl}/moji-predmeti`);
  }

  getByPredmetId(predmetId: number): Observable<TerminKolokvijuma> {
    return this.http.get<TerminKolokvijuma>(`${this.apiUrl}/predmet/${predmetId}`);
  }

  saveOrUpdate(data: TerminKolokvijuma): Observable<TerminKolokvijuma> {
    return this.http.post<TerminKolokvijuma>(this.apiUrl, data);
  }

  exportToExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export-excel`, {
      responseType: 'blob'
    });
  }
}