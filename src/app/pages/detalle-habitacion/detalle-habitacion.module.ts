import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DetalleHabitacionPageRoutingModule } from './detalle-habitacion-routing.module';

import { DetalleHabitacionPage } from './detalle-habitacion.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DetalleHabitacionPageRoutingModule
  ],
  declarations: [DetalleHabitacionPage]
})
export class DetalleHabitacionPageModule {}
