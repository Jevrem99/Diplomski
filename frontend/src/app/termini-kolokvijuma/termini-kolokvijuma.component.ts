import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TerminiKolokvijumaService, TerminKolokvijuma, Predmet } from '../core/services/termini-kolokvijuma.service';

@Component({
  selector: 'app-termini-kolokvijuma',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './termini-kolokvijuma.component.html',
  styleUrls: ['./termini-kolokvijuma.component.css']
})
export class TerminiKolokvijumaComponent implements OnInit {
  private fb = inject(FormBuilder);
  private terminiService = inject(TerminiKolokvijumaService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  successMessage = signal<string | null>(null);

  mojiPredmeti = signal<Predmet[]>([]);
  selectedPredmetId = signal<number | null>(null);
  uloga = signal<string>('asistent');

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.loadZaduzenePredmete();
  }

  private initForm(): void {
    this.form = this.fb.group({
      id: [null],
      predmet_id: [null],
      k1_datum: [''],
      k1_trajanje: [null],
      k1_racunarska_sala: [false],
      k2_datum: [''],
      k2_trajanje: [null],
      k2_racunarska_sala: [false],
      k3_datum: [''],
      k3_trajanje: [null],
      k3_racunarska_sala: [false],
      popravni_u_terminu_ispita: [false],
      popravni_trajanje: [null],
      popravni_racunarska_sala: [false],
      napomena: ['']
    });
  }

  loadZaduzenePredmete(): void {
    this.loading.set(true);

    this.terminiService.getMojiPredmeti().subscribe({
      next: (predmeti: Predmet[]) => {
        this.mojiPredmeti.set(predmeti);
        if (predmeti && predmeti.length > 0) {
          this.onPredmetSelect(predmeti[0].id);
        } else {
          this.loading.set(false);
        }
      },
      error: (err: any) => {
        console.error('Greška pri učitavanju zaduženja:', err);
        this.loading.set(false);
      }
    });
  }

  onPredmetSelect(predmetId: number): void {
    this.selectedPredmetId.set(predmetId);
    this.loading.set(true);

    this.terminiService.getByPredmetId(predmetId).subscribe({
      next: (data: TerminKolokvijuma) => {
        this.form.reset({
          k1_racunarska_sala: false,
          k2_racunarska_sala: false,
          k3_racunarska_sala: false,
          popravni_u_terminu_ispita: false,
          popravni_racunarska_sala: false
        });

        if (data) {
          this.form.patchValue(data);
        } else {
          this.form.patchValue({ predmet_id: predmetId });
        }
        this.loading.set(false);
      },
      error: (err: any) => {
        console.error('Greška pri učitavanju termina:', err);
        this.loading.set(false);
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid || !this.selectedPredmetId()) return;

    this.saving.set(true);
    this.successMessage.set(null);

    const formValues: TerminKolokvijuma = {
      ...this.form.value,
      predmet_id: this.selectedPredmetId()!
    };

    this.terminiService.saveOrUpdate(formValues).subscribe({
      next: (res: TerminKolokvijuma) => {
        this.saving.set(false);
        this.successMessage.set('Termini uspešno sačuvani!');
        if (res.id) {
          this.form.patchValue({ id: res.id });
        }
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (err: any) => {
        this.saving.set(false);
        console.error('Greška pri čuvanju:', err);
      }
    });
  }

  exportExcel(): void {
    this.terminiService.exportToExcel().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Izbor_termina_kolokvijuma.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err: any) => {
        console.error('Greška pri preuzimanju Excel-a:', err);
      }
    });
  }
}