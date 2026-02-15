import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AssistantFaqAdminPageRoutingModule } from './assistant-faq-admin-routing.module';

import { AssistantFaqAdminPage } from './assistant-faq-admin.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AssistantFaqAdminPageRoutingModule
  ],
  declarations: [AssistantFaqAdminPage]
})
export class AssistantFaqAdminPageModule {}
