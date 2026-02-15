import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssistantFaqAdminPage } from './assistant-faq-admin.page';

describe('AssistantFaqAdminPage', () => {
  let component: AssistantFaqAdminPage;
  let fixture: ComponentFixture<AssistantFaqAdminPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AssistantFaqAdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
