import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGateService {
  private readonly USER_KEY = 'usuario';
  private readonly GUEST_KEY = 'guest_mode';
  private readonly RETURN_URL_KEY = 'return_url';
  private readonly RETURN_STATE_KEY = 'return_state';

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.USER_KEY);
  }

  isGuest(): boolean {
    return !this.isLoggedIn() && localStorage.getItem(this.GUEST_KEY) === '1';
  }

  setGuestMode(): void {
    localStorage.setItem(this.GUEST_KEY, '1');
    // Ojo: no tocamos nada más. Solo aseguramos que NO haya usuario.
    localStorage.removeItem(this.USER_KEY);
  }

  clearGuestMode(): void {
    localStorage.removeItem(this.GUEST_KEY);
  }

  setReturn(url: string, state?: any): void {
    localStorage.setItem(this.RETURN_URL_KEY, url || '/home');

    if (state !== undefined) {
      try {
        localStorage.setItem(this.RETURN_STATE_KEY, JSON.stringify(state));
      } catch {
        localStorage.removeItem(this.RETURN_STATE_KEY);
      }
    } else {
      localStorage.removeItem(this.RETURN_STATE_KEY);
    }
  }

  peekReturnUrl(): string | null {
    return localStorage.getItem(this.RETURN_URL_KEY);
  }

  consumeReturn(): { url: string | null; state: any | null } {
    const url = localStorage.getItem(this.RETURN_URL_KEY);
    const stateRaw = localStorage.getItem(this.RETURN_STATE_KEY);

    localStorage.removeItem(this.RETURN_URL_KEY);
    localStorage.removeItem(this.RETURN_STATE_KEY);

    let state: any | null = null;
    if (stateRaw) {
      try { state = JSON.parse(stateRaw); } catch { state = null; }
    }

    return { url, state };
  }

  /**
   * Llama esto cuando el usuario (invitado) intenta algo protegido.
   * Guarda la ruta actual y manda al login.
   */
  requireLogin(router: Router, returnUrl?: string, state?: any): void {
    const url = returnUrl || router.url || '/home';
    this.setReturn(url, state);
    router.navigateByUrl('/login');
  }
}
