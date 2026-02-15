// src/app/services/hotel-local-ai.engine.ts
import { Injectable } from '@angular/core';

export type HotelIntent =
  | 'greeting'
  | 'app_info'
  | 'promo'
  | 'my_reservations'
  | 'reservation_detail'
  | 'search_rooms'
  | 'create_reservation'
  | 'my_favorites'
  | 'navigate'
  | 'open_room'
  | 'cancel_reservation'
  | 'change_reservation_dates'
  | 'unknown';

export type ToolName =
  | 'GET_PROMO'
  | 'GET_MY_RESERVATIONS'
  | 'GET_MY_FAVORITES'
  | 'SEARCH_AVAILABLE_ROOMS'
  | 'GET_ROOMS';

export interface ToolCall {
  name: ToolName;
  args?: any;
}

export interface AssistantPlan {
  intent: HotelIntent;
  confidence: number;          // 0..0.99
  reply?: string;
  tool?: ToolCall;
  needsConfirmation?: boolean;

  entities?: {
    start?: string;  // YYYY-MM-DD
    end?: string;    // YYYY-MM-DD
    adults?: number;
    children?: number;

    reservaId?: number;

    roomHint?: string;
    roomId?: number;

    navTo?: 'home' | 'mis_reservas' | 'favoritos' | 'login' | 'admin';
  };

  safety?: {
    askLogin?: boolean;
    blocked?: boolean;
    reason?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class HotelLocalAiEngine {
  private STOP = new Set([
    'de','la','el','los','las','un','una','para','por','hola','buenas','buenos','gracias','porfa','ok',
    'a','al','del','que','como','cual','cuanto','quiero','necesito','porfavor'
  ]);

  private norm(s: string) {
    return (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/[^\w\s\-\/#]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  private tokenize(s: string) {
    return this.norm(s)
      .split(/\s+/)
      .map(t => t.replace(/[^\w\-]/g,''))
      .filter(t => t && !this.STOP.has(t));
  }

  private has(text: string, re: RegExp) { return re.test(text); }

  private extractReservaId(text: string): number | null {
    const m = text.match(/(?:reserva\s*#?\s*|#)(\d{1,9})/i);
    if (!m?.[1]) return null;
    const n = Number(m[1]);
    return isNaN(n) ? null : n;
  }

  private extractRoomId(text: string): number | null {
    const m = text.match(/(?:habitacion|habitación)\s*(?:#|nro|numero)?\s*(\d{1,9})/i);
    if (!m?.[1]) return null;
    const n = Number(m[1]);
    return isNaN(n) ? null : n;
  }

  // ======= PUBLIC helpers (para pending flows en service) =======
  public parseDates(textRaw: string): { start?: string; end?: string } {
    return this.extractDates(textRaw);
  }

  public parseGuests(textRaw: string): { adults?: number; children?: number } {
    return this.extractGuests(textRaw);
  }

  // Extrae fechas comunes: "2026-01-24", "24/01/2026", "del 24 al 26"
  private extractDates(textRaw: string): { start?: string; end?: string } {
    const text = this.norm(textRaw);

    // YYYY-MM-DD
    const iso = (text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/g) ?? []);
    const iso1 = iso[0];
    const iso2 = iso[1];
    if (iso1 && iso2) return { start: iso1, end: iso2 };
    if (iso1) return { start: iso1 };

    // dd/mm/yyyy
    const dmyFull = (text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g) ?? []);
    const toIsoFull = (s: string) => {
      const parts = s.split('/');
      const dd = parts[0] ?? '';
      const mm = parts[1] ?? '';
      const yyyy = parts[2] ?? '';
      if (!dd || !mm || !yyyy) return '';
      return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
    };
    const f1 = dmyFull[0];
    const f2 = dmyFull[1];
    if (f1 && f2) {
      const a = toIsoFull(f1);
      const b = toIsoFull(f2);
      if (a && b) return { start: a, end: b };
    }
    if (f1) {
      const a = toIsoFull(f1);
      if (a) return { start: a };
    }

    // dd/mm sin año: "24/01 al 26/01"
    const dmyShort = (text.match(/\b(\d{1,2})\/(\d{1,2})\b/g) ?? []);
    const s1 = dmyShort[0];
    const s2 = dmyShort[1];
    if (s1 && s2) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const toIsoShort = (s: string) => {
        const parts = s.split('/');
        const dd = parts[0] ?? '';
        const mm = parts[1] ?? '';
        if (!dd || !mm) return '';
        return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
      };
      const a = toIsoShort(s1);
      const b = toIsoShort(s2);
      if (a && b) return { start: a, end: b };
    }

    // "del 2 al 5" (asume mes/año actual)
    const m = text.match(/\bdel?\s+(\d{1,2})\s+al\s+(\d{1,2})\b/i);
    if (m?.[1] && m?.[2]) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd1 = String(Number(m[1])).padStart(2, '0');
      const dd2 = String(Number(m[2])).padStart(2, '0');
      return { start: `${yyyy}-${mm}-${dd1}`, end: `${yyyy}-${mm}-${dd2}` };
    }

    return {};
  }

  private extractGuests(textRaw: string): { adults?: number; children?: number } {
    const t = this.norm(textRaw);

    const a1 = t.match(/(\d+)\s*(adultos?|personas?)/i);
    const n1 = t.match(/(\d+)\s*(ninos?|niños?)/i);

    // “para 2” => asumimos adultos
    const para = t.match(/\bpara\s+(\d+)\b/i);

    const adults = a1?.[1] ? Number(a1[1]) : (para?.[1] ? Number(para[1]) : undefined);
    const children = n1?.[1] ? Number(n1[1]) : undefined;

    return {
      adults: (adults && adults >= 1) ? adults : undefined,
      children: (children != null && children >= 0) ? children : undefined
    };
  }

  private isAskingOtherPeople(textRaw: string): boolean {
    const t = this.norm(textRaw);
    return /\breservas?\s+de\s+[a-z]{3,}/i.test(t) && !/\bmis\s+reservas?\b/i.test(t);
  }

  plan(userText: string, ctx: { isLogged: boolean }): AssistantPlan {
    const text = this.norm(userText);

    if (this.isAskingOtherPeople(userText)) {
      return {
        intent: 'unknown',
        confidence: 0.95,
        safety: { blocked: true, reason: 'Solo puedo mostrar información de tu cuenta.' },
        reply: 'Solo puedo mostrar información de tu cuenta. Prueba: “mis reservas” o “estado de mi reserva #ID”.'
      };
    }

    // ===== Navegación / abrir pantallas =====
    if (this.has(text, /\b(llevame|llévame|llevar|ir|abre|abrir|entrar|ir a|ver)\b/i)) {
      if (this.has(text, /\bmis reservas\b/i)) return { intent: 'navigate', confidence: 0.92, entities: { navTo: 'mis_reservas' } };
      if (this.has(text, /\b(favoritos|mis favoritos)\b/i)) return { intent: 'navigate', confidence: 0.92, entities: { navTo: 'favoritos' } };
      if (this.has(text, /\b(inicio|home|principal)\b/i)) return { intent: 'navigate', confidence: 0.88, entities: { navTo: 'home' } };
      if (this.has(text, /\b(login|iniciar sesion|iniciar sesión)\b/i)) return { intent: 'navigate', confidence: 0.88, entities: { navTo: 'login' } };
      if (this.has(text, /\b(admin|panel|gerencia|administracion|administración)\b/i)) return { intent: 'navigate', confidence: 0.88, entities: { navTo: 'admin' } };
    }

    // ===== Abrir habitación =====
    if (this.has(text, /\b(habitacion|habitación)\b/i) && this.has(text, /\b(abrir|abre|ver|detalle)\b/i)) {
      const roomId = this.extractRoomId(userText);
      if (roomId) return { intent: 'open_room', confidence: 0.9, entities: { roomId } };
      const hint = this.tokenize(userText).join(' ');
      return { intent: 'open_room', confidence: 0.7, tool: { name: 'GET_ROOMS' }, entities: { roomHint: hint } };
    }

    // ===== Cancelar reserva =====
    if (this.has(text, /\b(cancelar|anular)\b/i) && this.has(text, /\breserva\b/i)) {
      const rid = this.extractReservaId(userText);
      if (!ctx.isLogged) {
        return { intent: 'cancel_reservation', confidence: 0.95, safety: { askLogin: true }, reply: 'Para cancelar una reserva necesitas iniciar sesión.' };
      }
      return { intent: 'cancel_reservation', confidence: 0.86, entities: { reservaId: rid ?? undefined } };
    }

    // ===== Cambiar fechas reserva =====
    if (this.has(text, /\b(cambiar|modificar|reprogramar|mover)\b/i) && this.has(text, /\b(fecha|fechas)\b/i) && this.has(text, /\breserva\b/i)) {
      if (!ctx.isLogged) {
        return { intent: 'change_reservation_dates', confidence: 0.95, safety: { askLogin: true }, reply: 'Para cambiar fechas necesitas iniciar sesión.' };
      }
      const rid = this.extractReservaId(userText);
      const dates = this.extractDates(userText);
      return { intent: 'change_reservation_dates', confidence: 0.82, entities: { reservaId: rid ?? undefined, ...dates } };
    }

    // Saludos
    if (this.has(text, /\b(hola|buenas|buenos dias|buenas tardes|buenas noches)\b/i)) {
      return { intent: 'greeting', confidence: 0.95, reply: '¡Hola! Soy tu asistente de Hotel Mi Kasa. Puedo ayudarte con disponibilidad, reservas, favoritos y promociones.' };
    }

    // Info app
    if (this.has(text, /\b(que hace|como funciona|para que sirve|que puedo hacer)\b/i)) {
      return { intent: 'app_info', confidence: 0.9, reply: 'Puedes ver habitaciones, buscar disponibilidad por fechas, reservar, ver tus reservas, recibir notificaciones y guardar favoritos.' };
    }

    // Promo
    if (this.has(text, /\b(promo|promocion|descuento|cupon)\b/i)) {
      return { intent: 'promo', confidence: 0.9, tool: { name: 'GET_PROMO' } };
    }

    // Favoritos
    if (this.has(text, /\b(favoritos|mis favoritos)\b/i)) {
      if (!ctx.isLogged) return { intent: 'my_favorites', confidence: 0.95, safety: { askLogin: true }, reply: 'Para ver tus favoritos necesitas iniciar sesión.' };
      return { intent: 'my_favorites', confidence: 0.9, tool: { name: 'GET_MY_FAVORITES' } };
    }

    // Mis reservas
    if (this.has(text, /\b(mis reservas|ver reservas|tengo reservas)\b/i)) {
      if (!ctx.isLogged) return { intent: 'my_reservations', confidence: 0.95, safety: { askLogin: true }, reply: 'Para ver tus reservas necesitas iniciar sesión.' };
      return { intent: 'my_reservations', confidence: 0.9, tool: { name: 'GET_MY_RESERVATIONS' } };
    }

    // Detalle reserva #ID
    const rid = this.extractReservaId(userText);
    if (rid) {
      if (!ctx.isLogged) return { intent: 'reservation_detail', confidence: 0.95, safety: { askLogin: true }, reply: 'Para consultar una reserva necesitas iniciar sesión.' };
      return { intent: 'reservation_detail', confidence: 0.9, tool: { name: 'GET_MY_RESERVATIONS' }, entities: { reservaId: rid } };
    }

    // Buscar disponibilidad
    if (this.has(text, /\b(disponible|disponibilidad|hay habitaciones|buscar disponibilidad|buscar)\b/i)) {
      const dates = this.extractDates(userText);
      const guests = this.extractGuests(userText);
      return { intent: 'search_rooms', confidence: 0.75, tool: { name: 'SEARCH_AVAILABLE_ROOMS', args: { ...dates, ...guests } }, entities: { ...dates, ...guests } };
    }

    // Reservar
    if (this.has(text, /\b(reservar|quiero reservar|hacer reserva)\b/i)) {
      const dates = this.extractDates(userText);
      const guests = this.extractGuests(userText);
      const roomHint = this.tokenize(userText).join(' ');
      if (!ctx.isLogged) return { intent: 'create_reservation', confidence: 0.9, safety: { askLogin: true }, reply: 'Para reservar necesitas iniciar sesión. Si quieres, te llevo a Login.' };
      return { intent: 'create_reservation', confidence: 0.8, tool: { name: 'SEARCH_AVAILABLE_ROOMS', args: { ...dates, ...guests } }, needsConfirmation: true, entities: { ...dates, ...guests, roomHint } };
    }

    return {
      intent: 'unknown',
      confidence: 0.5,
      reply: 'Puedo ayudarte con: “mis reservas”, “promo”, “buscar disponibilidad…”, “reservar…”, “cancelar reserva #ID”, “cambiar fechas de reserva #ID”.'
    };
  }
}
