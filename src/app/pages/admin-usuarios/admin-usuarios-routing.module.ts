import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminUsuariosPage } from './admin-usuarios.page';

const routes: Routes = [
  {
    path: '',
    component: AdminUsuariosPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminUsuariosPageRoutingModule {}
