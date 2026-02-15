import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FacturaCheckoutPageRoutingModule } from './factura-checkout-routing.module';

import { FacturaCheckoutPage } from './factura-checkout.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FacturaCheckoutPageRoutingModule
  ],
  declarations: [FacturaCheckoutPage]
})
export class FacturaCheckoutPageModule {}
