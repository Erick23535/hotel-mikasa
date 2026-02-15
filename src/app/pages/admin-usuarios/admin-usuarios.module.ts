import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AdminUsuariosPageRoutingModule } from './admin-usuarios-routing.module';

import { AdminUsuariosPage } from './admin-usuarios.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AdminUsuariosPageRoutingModule
  ],
  declarations: [AdminUsuariosPage]
})
export class AdminUsuariosPageModule {}
