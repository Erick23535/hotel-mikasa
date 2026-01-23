import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetalleHabitacionPage } from './detalle-habitacion.page';

describe('DetalleHabitacionPage', () => {
  let component: DetalleHabitacionPage;
  let fixture: ComponentFixture<DetalleHabitacionPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DetalleHabitacionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
