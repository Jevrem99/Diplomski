import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TerminiKolokvijuma } from './termini-kolokvijuma';

describe('TerminiKolokvijuma', () => {
  let component: TerminiKolokvijuma;
  let fixture: ComponentFixture<TerminiKolokvijuma>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminiKolokvijuma],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminiKolokvijuma);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
