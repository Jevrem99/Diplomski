import { TestBed } from '@angular/core/testing';

import { TerminiKolokvijumaService } from './termini-kolokvijuma.service';

describe('TerminiKolokvijumaService', () => {
  let service: TerminiKolokvijumaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TerminiKolokvijumaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
