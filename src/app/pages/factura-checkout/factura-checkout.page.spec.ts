import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FacturaCheckoutPage } from './factura-checkout.page';

describe('FacturaCheckoutPage', () => {
  let component: FacturaCheckoutPage;
  let fixture: ComponentFixture<FacturaCheckoutPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FacturaCheckoutPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
