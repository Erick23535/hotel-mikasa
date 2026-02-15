// src/app/services/hotel-assistant.service.ts
import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Api } from 'src/app/services/api';
import { firstValueFrom, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { HotelLocalAiEngine, AssistantPlan } from './hotel-local-ai.engine';
import { HotelFaqService } from './hotel-faq.service';

export type ChatMsg = { role: 'user' | 'assistant'; text: string; at: string };

type PendingAction =
  // disponibilidad pendiente (cuando faltan fechas)
  | { kind: 'AVAIL_AWAIT_DATES'; at: string; payload: { mode: 'search' | 'create'; adults: number; children: number } }

  // reservar (ya lo tenías)
  | { kind: 'CREATE_RESERVATION_SELECT'; at: string; payload: { start: string; end: string; adults: number; children: number; options: any[] } }
  | { kind: 'CREATE_RESERVATION_CONFIRM'; at: string; payload: { data: any } }

  // abrir habitación por nombre (lista opciones)
  | { kind: 'OPEN_ROOM_SELECT'; at: string; payload: { options: any[] } }

  // cancelar reserva
  | { kind: 'CANCEL_RESERVATION_SELECT'; at: string; payload: { options: any[] } }
  | { kind: 'CANCEL_RESERVATION_CONFIRM'; at: string; payload: { reservaId: number } }

  // cambiar fechas
  | { kind: 'CHANGE_DATES_AWAIT_INFO'; at: string; payload: { reservaId?: number; start?: string; end?: string } }
  | { kind: 'CHANGE_DATES_CONFIRM'; at: string; payload: { reservaId: number; start: string; end: string } };

@Injectable({ providedIn: 'root' })
export class HotelAssistantService {
  private PENDING_KEY = 'mikasa_ai_pending_v2';

  // badge
  private unreadSubject = new BehaviorSubject<number>(0);
  unread$ = this.unreadSubject.asObservable();

  // ✅ rutas (ajusta si tus routes son diferentes)
  private readonly ROUTES = {
    home: '/home',
    mis_reservas: '/mis-reservas',
    favoritos: '/favoritos',
    login: '/login',
    admin: '/admin-panel',
    roomDetail: (id: number) => `/detalle-habitacion/${id}`, // <- ajusta si tu route difiere
  };

  constructor(
    private engine: HotelLocalAiEngine,
    private api: Api,
    private faq: HotelFaqService,
    private router: Router
  ) {}

  private now() { return new Date().toISOString(); }

  clearUnread() { this.unreadSubject.next(0); }
  private markUnread() { this.unreadSubject.next(1); }

  private maybeMarkUnread(msgs: ChatMsg[]) {
    const hasAssistant = (msgs || []).some(m => m.role === 'assistant' && (m.text || '').trim().length > 0);
    if (!hasAssistant) return;

    const url = (this.router.url || '').split('?')[0];
    if (!url.startsWith('/assistant-chat')) this.markUnread();
  }
private extractApiMensaje(err: any): string {
  // Angular HttpErrorResponse suele traer el body en err.error
  const msg =
    err?.error?.mensaje ||
    err?.error?.message ||
    err?.message ||
    'Error de red/servidor.';
  return String(msg);
}

private async tryCancelReserva(usuarioId: number, reservaId: number): Promise<{ ok: boolean; mensaje: string }> {
  const apiAny = this.api as any;

  if (typeof apiAny.cancelarReserva === 'function') {
    try {
      const res: any = await firstValueFrom(apiAny.cancelarReserva(usuarioId, reservaId));
      if (res?.success) return { ok: true, mensaje: res?.mensaje || 'Reserva cancelada.' };
      return { ok: false, mensaje: res?.mensaje || 'No se pudo cancelar.' };
    } catch (e: any) {
      // ✅ Maneja 409/400/500 sin romper el flujo
      const msg = this.extractApiMensaje(e);
      return { ok: false, mensaje: msg };
    }
  }

  return {
    ok: false,
    mensaje: 'Aún no existe Api.cancelarReserva(). Agrega el endpoint cancelar_reserva.php y el método en Api.'
  };
}

private async tryChangeDates(usuarioId: number, reservaId: number, start: string, end: string): Promise<{ ok: boolean; mensaje: string }> {
  const apiAny = this.api as any;

  if (typeof apiAny.cambiarFechasReserva === 'function') {
    try {
      const res: any = await firstValueFrom(apiAny.cambiarFechasReserva(usuarioId, reservaId, start, end));
      if (res?.success) return { ok: true, mensaje: res?.mensaje || 'Fechas actualizadas.' };
      return { ok: false, mensaje: res?.mensaje || 'No se pudo actualizar.' };
    } catch (e: any) {
      // ✅ Aquí cae tu 409 (Conflict) y devolvemos el mensaje del PHP
      const msg = this.extractApiMensaje(e);
      return { ok: false, mensaje: msg };
    }
  }

  return {
    ok: false,
    mensaje: 'Aún no existe Api.cambiarFechasReserva(). Agrega cambiar_fechas_reserva.php y el método en Api.'
  };
}

  private finalize(msgs: ChatMsg[]) {
    this.maybeMarkUnread(msgs);
    return msgs;
  }

  private getUser(): any | null {
    try {
      const raw = localStorage.getItem('usuario');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private async getPending(): Promise<PendingAction | null> {
    try {
      const r = await Preferences.get({ key: this.PENDING_KEY });
      return r?.value ? JSON.parse(r.value) : null;
    } catch { return null; }
  }

  private async setPending(p: PendingAction | null) {
    try {
      if (!p) await Preferences.remove({ key: this.PENDING_KEY });
      else await Preferences.set({ key: this.PENDING_KEY, value: JSON.stringify(p) });
    } catch {}
  }

  private isYes(text: string) {
    const t = (text || '').toLowerCase();
    return /\b(si|sí|confirmo|dale|ok|de acuerdo|confirmar)\b/i.test(t);
  }
  private isNo(text: string) {
    const t = (text || '').toLowerCase();
    return /\b(no|cancelar|mejor no|anular|salir)\b/i.test(t);
  }

  // helper: resumen corto de reserva
  private fmtReserva(r: any) {
    const id = Number(r?.id);
    const tipo = r?.tipo || 'Habitación';
    const a = r?.fecha_checkin || '?';
    const b = r?.fecha_checkout || '?';
    const st = r?.estado || '?';
    return `#${id} ${tipo} (${a}→${b}) - ${st}`;
  }

   

  // ======= MAIN =======
  async send(userText: string): Promise<ChatMsg[]> {
    const user = this.getUser();
    const isLogged = !!user?.id;

    // 0) pending flows
    const pending = await this.getPending();
    if (pending) {
      if (this.isNo(userText)) {
        await this.setPending(null);
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: 'Listo, cancelado. ¿Qué deseas hacer ahora?', at: this.now() }
        ]);
      }

      // ===== Disponibilidad esperando fechas =====
      if (pending.kind === 'AVAIL_AWAIT_DATES') {
        const dates = this.engine.parseDates(userText);
        if (!dates.start || !dates.end) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Necesito las 2 fechas. Ejemplo: “2026-02-02 a 2026-02-05”. (o escribe “cancelar”)', at: this.now() }
          ]);
        }

        const adults = pending.payload.adults ?? 1;
        const children = pending.payload.children ?? 0;

        // buscar disponibles
        const avail: any = await firstValueFrom(this.api.buscarDisponibles(dates.start, dates.end, { adults, children }));
        const list = Array.isArray(avail) ? avail : (avail?.data ?? []);

        await this.setPending(null);

        if (!list.length) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: `No encontré disponibles del ${dates.start} al ${dates.end} para ${adults} adulto(s) y ${children} niño(s).`, at: this.now() }
          ]);
        }

        // si venía de reservar → pasar a selección
        if (pending.payload.mode === 'create') {
          if (!isLogged) {
            return this.finalize([
              { role: 'user', text: userText, at: this.now() },
              { role: 'assistant', text: 'Para reservar necesitas iniciar sesión.', at: this.now() }
            ]);
          }

          const options = list.slice(0, 5).map((h: any) => ({
            id: Number(h.id),
            tipo: h.tipo,
            precio: Number(h.precio || 0),
            _estimado_total: Number(h.precio || 0)
          }));

          await this.setPending({
            kind: 'CREATE_RESERVATION_SELECT',
            at: this.now(),
            payload: { start: dates.start, end: dates.end, adults, children, options }
          });

          const txt =
            `Encontré ${list.length} opción(es). Elige una escribiendo 1, 2, 3…\n` +
            options.map((o: any, i: number) => `${i + 1}) ${o.tipo} (id ${o.id}) - $${o.precio.toFixed(2)}/noche aprox.`).join('\n');

          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: txt, at: this.now() }
          ]);
        }

        // búsqueda informativa
        const txt =
          `Disponibles del ${dates.start} al ${dates.end}:\n- ` +
          list.slice(0, 5).map((h: any) => `${h.tipo} (id ${h.id}) - $${Number(h.precio || 0).toFixed(2)}/noche`).join('\n- ') +
          `\nSi quieres reservar, dime: “reservar del ${dates.start} al ${dates.end} para ${adults} adultos y ${children} niños”.`;

        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: txt, at: this.now() }
        ]);
      }

      // ===== Abrir habitación selección (por nombre/hint) =====
      if (pending.kind === 'OPEN_ROOM_SELECT') {
        const n = Number((userText || '').trim());
        const opt = (!isNaN(n) && n >= 1) ? pending.payload.options[n - 1] : null;
        if (!opt) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Elige una opción escribiendo 1, 2, 3… o “cancelar”.', at: this.now() }
          ]);
        }
        await this.setPending(null);
        const id = Number(opt.id);
        this.router.navigate([this.ROUTES.roomDetail(id)]);
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: `Abriendo habitación: ${opt.tipo} (id ${id})…`, at: this.now() }
        ]);
      }

            // ===== Reservar: confirm (✅ re-valida disponibilidad + evita duplicados) =====
      if (pending.kind === 'CREATE_RESERVATION_CONFIRM') {
        if (!this.isYes(userText)) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Para continuar necesito un “sí/confirmo”. Si no, escribe “cancelar”.', at: this.now() }
          ]);
        }

        const data = pending.payload.data;

        const roomId = Number(data?.habitacion_id);
        const start = String(data?.fecha_checkin || '');
        const end = String(data?.fecha_checkout || '');
        const adults = Number(data?.adultos ?? 1);
        const children = Number(data?.ninos ?? 0);

        // 1) rango válido
        if (!this.isValidRange(start, end)) {
          await this.setPending(null);
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: '⚠️ Las fechas no son válidas. Ej: “2026-02-02 a 2026-02-05”.', at: this.now() }
          ]);
        }

        // 2) check disponibilidad final (anti “race condition”)
        const chk = await this.checkRoomAvailable(roomId, start, end, { adults, children });
        if (!chk.ok) {
          await this.setPending(null);
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: `⚠️ ${chk.reason || 'No pude verificar disponibilidad.'}`, at: this.now() }
          ]);
        }

        if (!chk.available) {
          // re-ofrecer opciones disponibles de nuevo
          const avail: any = await firstValueFrom(this.api.buscarDisponibles(start, end, { adults, children }));
          const list = this.extractAvailList(avail);

          await this.setPending(null);

          if (!list.length) {
            return this.finalize([
              { role: 'user', text: userText, at: this.now() },
              { role: 'assistant', text: `❌ Ya no hay disponibilidad del ${start} al ${end}. Prueba con otras fechas.`, at: this.now() }
            ]);
          }

          const options = list.slice(0, 5).map((h: any) => ({
            id: Number(h.id),
            tipo: h.tipo,
            precio: Number(h.precio || 0),
            _estimado_total: Number(h.precio || 0)
          }));

          await this.setPending({
            kind: 'CREATE_RESERVATION_SELECT',
            at: this.now(),
            payload: { start, end, adults, children, options }
          });

          const txt =
            `❌ Esa opción ya no está disponible. Te dejo otras disponibles (elige 1,2,3…):\n` +
            options.map((o: any, i: number) => `${i + 1}) ${o.tipo} (id ${o.id}) - $${o.precio.toFixed(2)}/noche aprox.`).join('\n');

          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: txt, at: this.now() }
          ]);
        }

        // 3) evitar duplicado exacto (no se repite)
        const user = this.getUser();
        if (user?.id) {
          const dupId = await this.hasDuplicateReserva(user.id, roomId, start, end);
          if (dupId) {
            await this.setPending(null);
            return this.finalize([
              { role: 'user', text: userText, at: this.now() },
              { role: 'assistant', text: `⚠️ Ya tienes una reserva igual (#${dupId}) para esas fechas. Revisa “Mis Reservas”.`, at: this.now() }
            ]);
          }
        }

        // 4) crear reserva
        try {
          const res: any = await firstValueFrom(this.api.crearReserva(data));
          await this.setPending(null);

          if (res?.success) {
            return this.finalize([
              { role: 'user', text: userText, at: this.now() },
              { role: 'assistant', text: '✅ Reserva creada con éxito. Puedes verla en “Mis Reservas”.', at: this.now() }
            ]);
          }

          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: `No se pudo crear la reserva: ${res?.mensaje || 'intenta de nuevo'}`, at: this.now() }
          ]);
        } catch {
          await this.setPending(null);
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Error de red/servidor al crear la reserva. Intenta otra vez.', at: this.now() }
          ]);
        }
      }


      // ===== Reservar: select =====
      if (pending.kind === 'CREATE_RESERVATION_SELECT') {
        if (!isLogged) {
          await this.setPending(null);
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Para reservar necesitas iniciar sesión. Ve a Login y vuelve aquí.', at: this.now() }
          ]);
        }

        const n = Number((userText || '').trim());
        const opt = (!isNaN(n) && n >= 1) ? pending.payload.options[n - 1] : null;

        if (!opt) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Elige una opción escribiendo 1, 2, 3… o “cancelar”.', at: this.now() }
          ]);
        }

        const data = {
          usuario_id: user.id,
          habitacion_id: opt.id,
          fecha_checkin: pending.payload.start,
          fecha_checkout: pending.payload.end,
          total: opt._estimado_total ?? opt.precio ?? 0,
          extras: 'Ninguno',
          adultos: pending.payload.adults,
          ninos: pending.payload.children,
          huespedes_total: pending.payload.adults + pending.payload.children
        };

        await this.setPending({
          kind: 'CREATE_RESERVATION_CONFIRM',
          at: this.now(),
          payload: { data }
        });

        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          {
            role: 'assistant',
            text: `Confirmo: reservar "${opt.tipo}" del ${pending.payload.start} al ${pending.payload.end} para ${pending.payload.adults} adultos y ${pending.payload.children} niños. ¿Confirmas? (sí/cancelar)`,
            at: this.now()
          }
        ]);
      }

      // ===== Cancelar reserva: seleccionar =====
      if (pending.kind === 'CANCEL_RESERVATION_SELECT') {
        const n = Number((userText || '').trim());
        const opt = (!isNaN(n) && n >= 1) ? pending.payload.options[n - 1] : null;
        if (!opt) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Elige 1, 2, 3… o “cancelar”.', at: this.now() }
          ]);
        }

        const reservaId = Number(opt.id);
        await this.setPending({ kind: 'CANCEL_RESERVATION_CONFIRM', at: this.now(), payload: { reservaId } });

        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: `Vas a cancelar la reserva #${reservaId}. ¿Confirmas? (sí/cancelar)`, at: this.now() }
        ]);
      }

      // ===== Cancelar reserva: confirmar =====
      if (pending.kind === 'CANCEL_RESERVATION_CONFIRM') {
        if (!this.isYes(userText)) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Para cancelar necesito “sí/confirmo”. Si no, escribe “cancelar”.', at: this.now() }
          ]);
        }

        const reservaId = pending.payload.reservaId;
        await this.setPending(null);

        if (!isLogged) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Necesitas iniciar sesión para cancelar.', at: this.now() }
          ]);
        }

        const out = await this.tryCancelReserva(user.id, reservaId);
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: out.ok ? `✅ ${out.mensaje}` : `⚠️ ${out.mensaje}`, at: this.now() }
        ]);
      }

   // ===== Cambiar fechas: esperar info =====
if (pending.kind === 'CHANGE_DATES_AWAIT_INFO') {
  const plan = this.engine.plan(userText, { isLogged });
  const rid = plan.entities?.reservaId;
  const dates = this.engine.parseDates(userText);

  const merged: { reservaId?: number; start?: string; end?: string } = {
    reservaId: pending.payload.reservaId ?? (rid != null ? Number(rid) : undefined),
    start: pending.payload.start ?? dates.start ?? undefined,
    end: pending.payload.end ?? dates.end ?? undefined
  };

  // 1) falta ID
  if (!merged.reservaId || isNaN(Number(merged.reservaId))) {
    await this.setPending({
      kind: 'CHANGE_DATES_AWAIT_INFO',
      at: this.now(),
      payload: { reservaId: undefined, start: merged.start, end: merged.end }
    });

    return this.finalize([
      { role: 'user', text: userText, at: this.now() },
      { role: 'assistant', text: 'Dime el número de tu reserva (ej: “reserva #12”). (o “cancelar”)', at: this.now() }
    ]);
  }

  // 2) faltan fechas
  if (!merged.start || !merged.end) {
    await this.setPending({
      kind: 'CHANGE_DATES_AWAIT_INFO',
      at: this.now(),
      payload: { reservaId: Number(merged.reservaId), start: merged.start, end: merged.end }
    });

    return this.finalize([
      { role: 'user', text: userText, at: this.now() },
      { role: 'assistant', text: 'Dime las nuevas fechas: “2026-02-02 a 2026-02-05”. (o “cancelar”)', at: this.now() }
    ]);
  }

  const reservaIdNum = Number(merged.reservaId);
  const startStr = String(merged.start);
  const endStr = String(merged.end);

  // 3) rango válido (evita errores y confirma antes)
  if (!this.isValidRange(startStr, endStr)) {
    await this.setPending({
      kind: 'CHANGE_DATES_AWAIT_INFO',
      at: this.now(),
      payload: { reservaId: reservaIdNum }
    });

    return this.finalize([
      { role: 'user', text: userText, at: this.now() },
      { role: 'assistant', text: '⚠️ Las fechas no son válidas. Ej: “2026-02-02 a 2026-02-05”.', at: this.now() }
    ]);
  }

  // ✅ precheck disponibilidad antes de confirmar el cambio
  if (!isLogged) {
    await this.setPending(null);
    return this.finalize([
      { role: 'user', text: userText, at: this.now() },
      { role: 'assistant', text: 'Necesitas iniciar sesión.', at: this.now() }
    ]);
  }

  const reserva = await this.getReservaFromUser(user.id, reservaIdNum);
  if (!reserva) {
    await this.setPending({
      kind: 'CHANGE_DATES_AWAIT_INFO',
      at: this.now(),
      payload: { reservaId: reservaIdNum }
    });

    return this.finalize([
      { role: 'user', text: userText, at: this.now() },
      { role: 'assistant', text: `No encontré la reserva #${reservaIdNum} en tu cuenta. Verifica el ID.`, at: this.now() }
    ]);
  }

  const roomId = Number(reserva?.habitacion_id ?? reserva?.habitacionId ?? reserva?.room_id);

  if (roomId > 0) {
    const chk = await this.checkRoomAvailable(
      roomId,
      startStr,
      endStr,
      { adults: Number(reserva?.adultos ?? 1), children: Number(reserva?.ninos ?? 0) },
      reservaIdNum // excludeReservaId (si existe endpoint, perfecto; si no, igual funciona con fallback)
    );

    if (!chk.ok) {
      return this.finalize([
        { role: 'user', text: userText, at: this.now() },
        { role: 'assistant', text: `⚠️ ${chk.reason || 'No pude verificar disponibilidad.'}`, at: this.now() }
      ]);
    }

    if (!chk.available) {
      await this.setPending(null);
      return this.finalize([
        { role: 'user', text: userText, at: this.now() },
        {
          role: 'assistant',
          text: '❌ No hay disponibilidad para esa habitación en esas fechas. Prueba otras fechas o pide: “buscar disponibilidad …”.',
          at: this.now()
        }
      ]);
    }
  }

  // 4) listo → confirm (YA con strings, sin undefined)
  await this.setPending({
    kind: 'CHANGE_DATES_CONFIRM',
    at: this.now(),
    payload: { reservaId: reservaIdNum, start: startStr, end: endStr }
  });

  return this.finalize([
    { role: 'user', text: userText, at: this.now() },
    { role: 'assistant', text: `Confirmo cambiar la reserva #${reservaIdNum} a ${startStr} → ${endStr}. ¿Confirmas? (sí/cancelar)`, at: this.now() }
  ]);
}

      // ===== Cambiar fechas: confirmar =====
      if (pending.kind === 'CHANGE_DATES_CONFIRM') {
        if (!this.isYes(userText)) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Para aplicar el cambio necesito “sí/confirmo”. Si no, escribe “cancelar”.', at: this.now() }
          ]);
        }

        await this.setPending(null);

        if (!isLogged) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Necesitas iniciar sesión.', at: this.now() }
          ]);
        }

        const { reservaId, start, end } = pending.payload;
                // ✅ re-check final antes de ejecutar (evita carreras)
        const reserva = await this.getReservaFromUser(user.id, reservaId);
        const roomId = Number(reserva?.habitacion_id ?? reserva?.habitacionId ?? reserva?.room_id);

        if (roomId > 0) {
          const chk = await this.checkRoomAvailable(roomId, start, end, {
            adults: Number(reserva?.adultos ?? 1),
            children: Number(reserva?.ninos ?? 0)
          }, reservaId);

          if (!chk.ok) {
            return this.finalize([
              { role: 'user', text: userText, at: this.now() },
              { role: 'assistant', text: `⚠️ ${chk.reason || 'No pude verificar disponibilidad.'}`, at: this.now() }
            ]);
          }

          if (!chk.available) {
            return this.finalize([
              { role: 'user', text: userText, at: this.now() },
              { role: 'assistant', text: '❌ Ya no hay disponibilidad para ese cambio de fechas. Prueba con otras fechas.', at: this.now() }
            ]);
          }
        }

        const out = await this.tryChangeDates(user.id, reservaId, start, end);

        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: out.ok ? `✅ ${out.mensaje}` : `⚠️ ${out.mensaje}`, at: this.now() }
        ]);
      }
    }

    // 1) plan
    const plan: AssistantPlan = this.engine.plan(userText, { isLogged });

    // safety
    if (plan.safety?.blocked) {
      return this.finalize([
        { role: 'user', text: userText, at: this.now() },
        { role: 'assistant', text: plan.reply || plan.safety.reason || 'No puedo ayudar con eso.', at: this.now() }
      ]);
    }
    if (plan.safety?.askLogin) {
      return this.finalize([
        { role: 'user', text: userText, at: this.now() },
        { role: 'assistant', text: plan.reply || 'Necesitas iniciar sesión.', at: this.now() }
      ]);
    }

    // 2) navegación
    if (plan.intent === 'navigate' && plan.entities?.navTo) {
      const target = plan.entities.navTo;
      const route = (this.ROUTES as any)[target];
      if (route) {
        this.router.navigate([route]);
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: `Abriendo ${target.replace('_',' ')}…`, at: this.now() }
        ]);
      }
      return this.finalize([
        { role: 'user', text: userText, at: this.now() },
        { role: 'assistant', text: 'No tengo configurada esa ruta todavía.', at: this.now() }
      ]);
    }

    // 3) abrir habitación
    if (plan.intent === 'open_room') {
      // por id directo
      if (plan.entities?.roomId) {
        const id = Number(plan.entities.roomId);
        this.router.navigate([this.ROUTES.roomDetail(id)]);
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: `Abriendo habitación (id ${id})…`, at: this.now() }
        ]);
      }

      // por hint => tool GET_ROOMS
      if (plan.tool?.name === 'GET_ROOMS') {
        const apiAny = this.api as any;
        if (typeof apiAny.getHabitaciones !== 'function') {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Para abrir por nombre necesito Api.getHabitaciones(). Si ya tienes get_habitaciones.php, agrega ese método en Api.', at: this.now() }
          ]);
        }

        const rooms: any = await firstValueFrom(apiAny.getHabitaciones());
        const list = Array.isArray(rooms) ? rooms : (rooms?.data ?? rooms?.lista ?? []);

        const hint = (plan.entities?.roomHint || '').toLowerCase();
        const filtered = (list || []).filter((r: any) => String(r?.tipo || '').toLowerCase().includes(hint.split(' ')[0] || ''));

        const options = (filtered.length ? filtered : list).slice(0, 5).map((r: any) => ({
          id: Number(r.id),
          tipo: r.tipo || 'Habitación'
        }));

        if (!options.length) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'No encontré habitaciones para abrir.', at: this.now() }
          ]);
        }

        await this.setPending({ kind: 'OPEN_ROOM_SELECT', at: this.now(), payload: { options } });

        const txt =
          `¿Cuál deseas abrir? Escribe 1, 2, 3…\n` +
          options.map((o: any, i: number) => `${i + 1}) ${o.tipo} (id ${o.id})`).join('\n');

        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: txt, at: this.now() }
        ]);
      }
    }

    // 4) cancelar reserva
    if (plan.intent === 'cancel_reservation') {
      if (!isLogged) {
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: 'Para cancelar una reserva necesitas iniciar sesión.', at: this.now() }
        ]);
      }

      // si viene con ID → confirm
      if (plan.entities?.reservaId) {
        const reservaId = Number(plan.entities.reservaId);
        await this.setPending({ kind: 'CANCEL_RESERVATION_CONFIRM', at: this.now(), payload: { reservaId } });
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: `Vas a cancelar la reserva #${reservaId}. ¿Confirmas? (sí/cancelar)`, at: this.now() }
        ]);
      }

      // si no viene ID → listar últimas para elegir
      const res: any = await firstValueFrom(this.api.getReservasUsuario(user.id));
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      const options = (list || []).slice(0, 5).map((r: any) => ({ id: Number(r.id), label: this.fmtReserva(r) }));

      if (!options.length) {
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: 'No tienes reservas para cancelar.', at: this.now() }
        ]);
      }

      await this.setPending({ kind: 'CANCEL_RESERVATION_SELECT', at: this.now(), payload: { options } });

      const txt =
        `¿Cuál deseas cancelar? Escribe 1, 2, 3…\n` +
        options.map((o: any, i: number) => `${i + 1}) ${o.label}`).join('\n');

      return this.finalize([
        { role: 'user', text: userText, at: this.now() },
        { role: 'assistant', text: txt, at: this.now() }
      ]);
    }

    // 5) cambiar fechas
    if (plan.intent === 'change_reservation_dates') {
      if (!isLogged) {
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: 'Para cambiar fechas necesitas iniciar sesión.', at: this.now() }
        ]);
      }

      const rid = plan.entities?.reservaId;
      const start = plan.entities?.start;
      const end = plan.entities?.end;

      // falta algo → pending ask
      if (!rid || !start || !end) {
        await this.setPending({
          kind: 'CHANGE_DATES_AWAIT_INFO',
          at: this.now(),
          payload: { reservaId: rid ?? undefined, start: start ?? undefined, end: end ?? undefined }
        });

        const parts: string[] = [];
        if (!rid) parts.push('la reserva (#ID)');
        if (!start || !end) parts.push('las nuevas fechas (YYYY-MM-DD a YYYY-MM-DD)');

        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: `Para cambiar fechas necesito: ${parts.join(' y ')}. (o “cancelar”)`, at: this.now() }
        ]);
      }

      await this.setPending({ kind: 'CHANGE_DATES_CONFIRM', at: this.now(), payload: { reservaId: Number(rid), start, end } });

      return this.finalize([
        { role: 'user', text: userText, at: this.now() },
        { role: 'assistant', text: `Confirmo cambiar la reserva #${rid} a ${start} → ${end}. ¿Confirmas? (sí/cancelar)`, at: this.now() }
      ]);
    }

    // reply directo
    if (plan.reply && !plan.tool) {
      return this.finalize([
        { role: 'user', text: userText, at: this.now() },
        { role: 'assistant', text: plan.reply, at: this.now() }
      ]);
    }

    // 6) tools
    if (plan.tool) {
      const toolName = plan.tool.name;

      // GET_PROMO
      if (toolName === 'GET_PROMO') {
        const promo: any = await firstValueFrom(this.api.getPromoActiva());
        const txt = promo?.codigo
          ? `🎁 Promo activa: código ${promo.codigo} (${promo.descuento || promo.porcentaje || ''}%). Úsalo al reservar.`
          : 'No hay promo activa en este momento.';
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: txt, at: this.now() }
        ]);
      }

      // GET_MY_FAVORITES
      if (toolName === 'GET_MY_FAVORITES') {
        if (!isLogged) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Para ver tus favoritos debes iniciar sesión.', at: this.now() }
          ]);
        }
        const r: any = await firstValueFrom(this.api.getFavoritos(user.id, 'details'));
        const list = r?.lista || [];
        const txt = list.length
          ? `⭐ Tus favoritos (${list.length}):\n- ` + list.slice(0, 5).map((x: any) => `${x.tipo} (id ${x.id})`).join('\n- ')
          : 'Aún no tienes favoritos. Puedes marcar el ❤️ en Home.';
        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: txt, at: this.now() }
        ]);
      }

      // GET_MY_RESERVATIONS
      if (toolName === 'GET_MY_RESERVATIONS') {
        if (!isLogged) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Para ver tus reservas debes iniciar sesión.', at: this.now() }
          ]);
        }

        const res: any = await firstValueFrom(this.api.getReservasUsuario(user.id));
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        const rid = plan.entities?.reservaId;

        if (rid) {
          const one = (list || []).find((x: any) => Number(x?.id) === Number(rid));
          const txt = one
            ? `Reserva #${one.id}: ${one.tipo} | ${one.fecha_checkin} → ${one.fecha_checkout} | Estado: ${one.estado} | Total: $${Number(one.total || 0).toFixed(2)}`
            : `No encontré una reserva #${rid} en tu cuenta.`;
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: txt, at: this.now() }
          ]);
        }

        const txt = (list && list.length)
          ? `📌 Tienes ${list.length} reserva(s). Últimas:\n- ` + list.slice(0, 5).map((x: any) =>
              `#${x.id} ${x.tipo} (${x.fecha_checkin}→${x.fecha_checkout}) - ${x.estado}`
            ).join('\n- ')
          : 'No tienes reservas todavía. Si quieres, dime: “buscar disponibilidad…” o “reservar…”';

        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: txt, at: this.now() }
        ]);
      }

      // SEARCH_AVAILABLE_ROOMS (mejorado con confirm/pending de fechas)
      if (toolName === 'SEARCH_AVAILABLE_ROOMS') {
        const start = plan.entities?.start || plan.tool.args?.start;
        const end = plan.entities?.end || plan.tool.args?.end;

        const adults = Number(plan.entities?.adults ?? plan.tool.args?.adults ?? 1);
        const children = Number(plan.entities?.children ?? plan.tool.args?.children ?? 0);

        // ✅ si faltan fechas → pending ask (NO se pierde el flujo)
        if (!start || !end) {
          await this.setPending({
            kind: 'AVAIL_AWAIT_DATES',
            at: this.now(),
            payload: { mode: plan.intent === 'create_reservation' ? 'create' : 'search', adults, children }
          });

          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: 'Perfecto 👍 ¿Desde cuándo y hasta cuándo? (Ej: “2026-02-02 a 2026-02-05”). Puedes escribir “cancelar”.', at: this.now() }
          ]);
        }

        const avail: any = await firstValueFrom(this.api.buscarDisponibles(start, end, { adults, children }));
        const list = Array.isArray(avail) ? avail : (avail?.data ?? []);

        if (!list.length) {
          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: `No encontré disponibles del ${start} al ${end} para ${adults} adulto(s) y ${children} niño(s).`, at: this.now() }
          ]);
        }

        // si era reservar y logged
        if (plan.intent === 'create_reservation') {
          if (!isLogged) {
            return this.finalize([
              { role: 'user', text: userText, at: this.now() },
              { role: 'assistant', text: 'Para reservar necesitas iniciar sesión.', at: this.now() }
            ]);
          }

          const options = list.slice(0, 5).map((h: any) => ({
            id: Number(h.id),
            tipo: h.tipo,
            precio: Number(h.precio || 0),
            _estimado_total: Number(h.precio || 0)
          }));

          await this.setPending({
            kind: 'CREATE_RESERVATION_SELECT',
            at: this.now(),
            payload: { start, end, adults, children, options }
          });

          const txt =
            `Encontré ${list.length} opción(es). Elige una escribiendo 1, 2, 3…\n` +
            options.map((o: any, i: number) => `${i + 1}) ${o.tipo} (id ${o.id}) - $${o.precio.toFixed(2)}/noche aprox.`).join('\n');

          return this.finalize([
            { role: 'user', text: userText, at: this.now() },
            { role: 'assistant', text: txt, at: this.now() }
          ]);
        }

        // informativo
        const txt =
          `Disponibles del ${start} al ${end}:\n- ` +
          list.slice(0, 5).map((h: any) => `${h.tipo} (id ${h.id}) - $${Number(h.precio || 0).toFixed(2)}/noche`).join('\n- ') +
          `\nSi quieres reservar, dime: “reservar del ${start} al ${end} para ${adults} adultos y ${children} niños”.`;

        return this.finalize([
          { role: 'user', text: userText, at: this.now() },
          { role: 'assistant', text: txt, at: this.now() }
        ]);
      }
    }

    // 7) FAQ fallback
    const ans = await this.faq.tryAnswer(userText);
    if (ans.ok && ans.answer) {
      return this.finalize([
        { role: 'user', text: userText, at: this.now() },
        { role: 'assistant', text: ans.answer, at: this.now() }
      ]);
    }

    return this.finalize([
      { role: 'user', text: userText, at: this.now() },
      { role: 'assistant', text: plan.reply || 'No entendí bien. Prueba: “mis reservas”, “promo”, “buscar disponibilidad…”, “cancelar reserva #ID”.', at: this.now() }
    ]);
  }
    private parseYmdToUtcMs(ymd: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return null;
    const [yS, mS, dS] = ymd.split('-');
    const y = Number(yS), m = Number(mS), d = Number(dS);
    if (!y || !m || !d) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== (m - 1) || dt.getUTCDate() !== d) return null;
    return dt.getTime();
  }

  private isValidRange(start: string, end: string): boolean {
    const a = this.parseYmdToUtcMs(start);
    const b = this.parseYmdToUtcMs(end);
    return a != null && b != null && a < b;
  }

  private extractAvailList(avail: any): any[] {
    if (Array.isArray(avail)) return avail;
    if (Array.isArray(avail?.data)) return avail.data;
    return [];
  }

  private async getReservaFromUser(usuarioId: number, reservaId: number): Promise<any | null> {
    try {
      const res: any = await firstValueFrom(this.api.getReservasUsuario(usuarioId));
      const list = this.extractAvailList(res); // reutilizo extractor (array o .data)
      const one = (list || []).find((x: any) => Number(x?.id) === Number(reservaId));
      return one || null;
    } catch {
      return null;
    }
  }

  private async checkRoomAvailable(
    habitacionId: number,
    start: string,
    end: string,
    opts?: { adults?: number; children?: number },
    excludeReservaId?: number
  ): Promise<{ ok: boolean; available: boolean; reason?: string }> {
    if (!this.isValidRange(start, end)) {
      return { ok: true, available: false, reason: 'Rango de fechas inválido. (check-in debe ser menor que check-out)' };
    }

    const apiAny = this.api as any;

    // ✅ check exacto si existe
    if (typeof apiAny.checkHabitacionDisponible === 'function') {
      try {
        const r: any = await firstValueFrom(apiAny.checkHabitacionDisponible(habitacionId, start, end, excludeReservaId));
        const disponible = !!(r?.disponible ?? r?.available ?? r?.ok);
        return { ok: true, available: disponible, reason: disponible ? undefined : 'La habitación no está disponible en esas fechas.' };
      } catch {
        // si falla el endpoint, pasamos a fallback
      }
    }

    // ✅ fallback: buscarDisponibles y ver si está en la lista (sirve perfecto para CREAR; para CAMBIAR puede fallar si se cruza con su propia reserva)
    try {
      const adults = Number(opts?.adults ?? 1);
      const children = Number(opts?.children ?? 0);
      const avail: any = await firstValueFrom(this.api.buscarDisponibles(start, end, { adults, children }));
      const list = this.extractAvailList(avail);
      const found = (list || []).some((h: any) => Number(h?.id) === Number(habitacionId));
      return { ok: true, available: found, reason: found ? undefined : 'La habitación no aparece como disponible en esas fechas.' };
    } catch {
      return { ok: false, available: false, reason: 'No pude verificar disponibilidad (error de red/servidor).' };
    }
  }

  private isActiveReservaEstado(estado: string): boolean {
    const e = String(estado || '').toLowerCase();
    return e !== 'cancelada' && e !== 'finalizado';
  }

  private async hasDuplicateReserva(usuarioId: number, habitacionId: number, start: string, end: string): Promise<number | null> {
    try {
      const res: any = await firstValueFrom(this.api.getReservasUsuario(usuarioId));
      const list = this.extractAvailList(res);
      const dup = (list || []).find((r: any) =>
        Number(r?.habitacion_id ?? r?.habitacionId ?? r?.room_id) === Number(habitacionId) &&
        String(r?.fecha_checkin) === String(start) &&
        String(r?.fecha_checkout) === String(end) &&
        this.isActiveReservaEstado(r?.estado)
      );
      return dup ? Number(dup.id) : null;
    } catch {
      return null;
    }
  }

}
