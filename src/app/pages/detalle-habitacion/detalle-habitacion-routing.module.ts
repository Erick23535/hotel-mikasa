import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DetalleHabitacionPage } from './detalle-habitacion.page';

const routes: Routes = [
  {
    path: '',
    component: DetalleHabitacionPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DetalleHabitacionPageRoutingModule {}
