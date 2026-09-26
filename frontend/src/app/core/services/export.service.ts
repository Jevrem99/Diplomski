// Diplomski-luka/frontend/src/app/core/services/export.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  constructor(private http: HttpClient) {}

  preuzmiKalendar() {
    return this.http.get('http://localhost:3000/api/ispiti/export', { responseType: 'blob' });
  }
}