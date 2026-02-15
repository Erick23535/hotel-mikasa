import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssistantChatPage } from './assistant-chat.page';

describe('AssistantChatPage', () => {
  let component: AssistantChatPage;
  let fixture: ComponentFixture<AssistantChatPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AssistantChatPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
