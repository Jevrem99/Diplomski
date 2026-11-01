// Tipovi podataka koje koristi glavna stranica (raspored)
export interface Profesor {
  id?: number;
  ime: string;
  prezime: string;
  email?: string;
}

export interface Predmet {
  nema_kolokvijume?: boolean;
  broj_studenata?: number;
  id: number;
  sifra: string;
  naziv: string;
  godina: number;
  semestar?: string;
  status?: string;
  profesor_id?: number;
  profesor?: Profesor;
  profesorImePrezime?: string;
  saradnici?: any[];
}
