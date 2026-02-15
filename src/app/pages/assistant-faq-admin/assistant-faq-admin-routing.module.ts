import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AssistantFaqAdminPage } from './assistant-faq-admin.page';

const routes: Routes = [
  {
    path: '',
    component: AssistantFaqAdminPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AssistantFaqAdminPageRoutingModule {}
