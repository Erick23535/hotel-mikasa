import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AssistantChatPageRoutingModule } from './assistant-chat-routing.module';

import { AssistantChatPage } from './assistant-chat.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AssistantChatPageRoutingModule
  ],
  declarations: [AssistantChatPage]
})
export class AssistantChatPageModule {}
