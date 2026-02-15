import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AssistantChatPage } from './assistant-chat.page';

const routes: Routes = [
  {
    path: '',
    component: AssistantChatPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AssistantChatPageRoutingModule {}
