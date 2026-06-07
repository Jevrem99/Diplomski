import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private http = inject(HttpClient); 
  
  private apiUrl = `${environment.apiUrl}/auth/login`;

  login(credentials: any): Observable<any> {
    return this.http.post(this.apiUrl, credentials);
  }
}