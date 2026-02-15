import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { HotelAssistantService } from './services/hotel-assistant.service'; // ajusta ruta

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false
})
export class AppComponent implements OnInit {

  hideAiFab = false;
  unread = 0;

  // ✅ rutas donde NO se muestra el FAB
  private readonly HIDE_ROUTES = ['/login', '/admin-panel', '/assistant-chat'];

  constructor(
    private router: Router,
    private assistant: HotelAssistantService
  ) {}

  ngOnInit() {
    // badge live
    this.assistant.unread$.subscribe(v => this.unread = v);

    // ocultar según ruta
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const url = (e.urlAfterRedirects || e.url || '').split('?')[0];

      this.hideAiFab = this.HIDE_ROUTES.some(r => url.startsWith(r));

      // ✅ si entras al chat, se limpia el badge y el FAB ya se oculta por ruta
      if (url.startsWith('/assistant-chat')) {
        this.assistant.clearUnread();
      }
    });
  }

  openAssistantChat() {
    this.assistant.clearUnread();
    this.router.navigate(['/assistant-chat']);
  }
}
