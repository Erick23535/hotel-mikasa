import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FacturaCheckoutPage } from './factura-checkout.page';

const routes: Routes = [
  {
    path: '',
    component: FacturaCheckoutPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FacturaCheckoutPageRoutingModule {}
