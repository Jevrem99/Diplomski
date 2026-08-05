import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatabaseManagement } from './database-management';

describe('DatabaseManagement', () => {
  let component: DatabaseManagement;
  let fixture: ComponentFixture<DatabaseManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatabaseManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(DatabaseManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
