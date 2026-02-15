import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class Api {

  private readonly WEB_URL = 'http://localhost/api-hotel';
  private readonly LAN_URL = 'http://192.168.0.10/api-hotel';

  // ✅ Base URL final (web/android/ios)
  readonly baseUrl: string = this.getBaseUrl(); // ✅ FIX: ahora existe baseUrl
  readonly url: string = this.baseUrl;          // ✅ mantiene tu "url" como siempre

  private jsonHeaders = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  private getBaseUrl(): string {
    try {
      const platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

      // ✅ En Android/iOS usa LAN
      if (platform !== 'web') return this.LAN_URL;

      // ✅ En web:
      // - Si estás en localhost => API local
      // - Si NO estás en localhost (ej: abres desde celular/otra PC) => usa LAN
      const host =
        (typeof window !== 'undefined' && window.location && window.location.hostname)
          ? window.location.hostname
          : 'localhost';

      const isLocal = host === 'localhost' || host === '127.0.0.1';
      return isLocal ? this.WEB_URL : this.LAN_URL;

    } catch {
      return this.WEB_URL;
    }
  }

  // ============================
  //      ADMINISTRACIÓN
  // ============================

  getTodasLasReservas() {
    return this.http.get(`${this.url}/admin_get_reservas.php`);
  }

  getReservasAdmin() {
    return this.getTodasLasReservas();
  }

  cambiarEstadoReserva(id: number, estado: string) {
    return this.http.post(`${this.url}/admin_cambiar_estado.php`, {
      reserva_id: id,
      nuevo_estado: estado
    });
  }

  actualizarReserva(data: any) {
    return this.cambiarEstadoReserva(data.id, data.estado);
  }

  obtenerEstadisticas() {
    return this.http.get(`${this.url}/admin_stats.php`);
  }

  getDatosGraficos() {
    return this.http.get(`${this.url}/admin_graficos.php`);
  }

  obtenerNotificaciones(usuario_id: number) {
    return this.http.get(`${this.url}/get_notificaciones.php?id=${usuario_id}`);
  }

  actualizarOfertaHabitacion(id: number, descuento: number) {
    return this.http.post(`${this.url}/admin_oferta_habitacion.php`, { id, descuento });
  }
requestPasswordReset(email: string) {
  return this.http.post<any>(`${this.baseUrl}/solicitar_recuperacion.php`, { email });
}

resetPassword(email: string, code: string, new_password: string) {
  return this.http.post<any>(`${this.baseUrl}/reset_password.php`, { email, code, new_password });
}

// Admin
adminListUsers(adminKey: string) {
  return this.http.post<any>(`${this.baseUrl}/admin_listar_usuarios.php`, { adminKey });
}

adminUpdateRole(adminKey: string, user_id: number, rol: string) {
  return this.http.post<any>(`${this.baseUrl}/admin_actualizar_rol.php`, {
    adminKey,
    user_id,
    rol
  });
}


  // ============================
  //      RECEPCIÓN
  // ============================

  getHuespedesActivos() {
    return this.http.get(`${this.url}/admin_recepcion.php?activos=1`);
  }

  buscarReservaPorID(id: number) {
    return this.http.get(`${this.url}/admin_recepcion.php?id=${id}`);
  }

  procesarRecepcion(reservaId: number, accion: 'checkin' | 'checkout', facturaUrl?: string | null) {
    const body: any = { reserva_id: reservaId, accion };
    if (facturaUrl) body.factura_url = facturaUrl;

    return this.http.post(
      `${this.url}/admin_recepcion.php`,
      body,
      { headers: this.jsonHeaders }
    );
  }

  subirFacturaCheckout(reservaId: number, base64: string, fileName: string) {
    const body = { reserva_id: reservaId, base64, fileName };

    return this.http.post<any>(
      `${this.url}/admin_upload_factura.php`,
      body,
      { headers: this.jsonHeaders }
    );
  }

  // ============================
  //      HABITACIONES (ADMIN)
  // ============================

  agregarHabitacion(data: any) {
    return this.http.post(`${this.url}/admin_agregar_habitacion.php`, data);
  }

  eliminarHabitacion(id: number) {
    return this.http.post(`${this.url}/admin_eliminar_habitacion.php`, { id });
  }

  actualizarHabitacion(data: any) {
    return this.http.post(`${this.url}/admin_actualizar_habitacion.php`, data);
  }

  // ============================
  //        USUARIO / APP
  // ============================

  getHabitaciones() {
    return this.http.get(`${this.url}/get_habitaciones.php`);
  }

  buscarDisponibles(
    fechaIn: string,
    fechaOut: string,
    guests?: { adults?: number; children?: number }
  ) {
    const body: any = { fecha_in: fechaIn, fecha_out: fechaOut };
    if (guests?.adults != null) body.adultos = guests.adults;
    if (guests?.children != null) body.ninos = guests.children;
    return this.http.post(`${this.url}/buscar_disponibles.php`, body);
  }

  getReservasUsuario(usuario_id: any) {
    return this.http.get(`${this.url}/get_reservas.php?id=${usuario_id}`);
  }

  crearReserva(data: any) {
    return this.http.post(`${this.url}/crear_reserva.php`, data);
  }

  subirComprobante(reserva_id: any, archivoBlob: File) {
    const formData = new FormData();
    formData.append('foto', archivoBlob);
    formData.append('reserva_id', reserva_id);
    return this.http.post(`${this.url}/subir_comprobante.php`, formData);
  }

  subirFacturaReserva(reservaId: number, base64: string, fileName: string) {
    return this.subirFacturaCheckout(reservaId, base64, fileName);
  }

  // ============================
  //      COMENTARIOS / AUTH
  // ============================

  getComentarios(habitacionId: number) {
    return this.http.get(`${this.url}/get_comentarios.php?id=${habitacionId}`);
  }

  enviarComentario(data: any) {
    return this.http.post(`${this.url}/guardar_comentario.php`, data);
  }

  registrarUsuario(data: any) {
    return this.http.post(`${this.url}/registro.php`, data);
  }

  loginUsuario(data: any) {
    return this.http.post(`${this.url}/login.php`, data);
  }

  // ============================
  //      CUPONES (ADMIN/USER)
  // ============================

  getCupones() {
    return this.http.get(`${this.url}/admin_cupones.php`);
  }

  crearCupon(codigo: string, descuento: number) {
    return this.http.post(`${this.url}/admin_cupones.php`, { codigo, descuento });
  }

  borrarCupon(id: number) {
    return this.http.post(`${this.url}/admin_cupones.php`, { accion: 'borrar', id });
  }

  getPromoActiva() {
    return this.http.get(`${this.url}/admin_cupones.php?promo=true`);
  }

  validarCupon(codigo: string) {
    return this.http.post(`${this.url}/validar_cupon.php`, { codigo });
  }

  // ============================
  //        FAVORITOS
  // ============================

  getFavoritos(usuario_id: number, mode: 'ids' | 'details' = 'details') {
    return this.http.get(`${this.url}/favoritos_list.php?usuario_id=${usuario_id}&mode=${mode}`);
  }

  toggleFavorito(usuario_id: number, habitacion_id: number) {
    return this.http.post(`${this.url}/favoritos_toggle.php`, { usuario_id, habitacion_id });
  }

  syncFavoritos(usuario_id: number, habitacion_ids: number[]) {
    return this.http.post(`${this.url}/favoritos_sync.php`, { usuario_id, habitacion_ids });
  }

  // ============================
  //   RESERVAS (NUEVO - ASISTENTE)
  // ============================

  checkHabitacionDisponible(habitacionId: number, start: string, end: string, excludeReservaId?: number) {
    return this.http.post<any>(`${this.url}/check_habitacion_disponible.php`, {
      habitacion_id: habitacionId,
      fecha_checkin: start,
      fecha_checkout: end,
      exclude_reserva_id: excludeReservaId ?? null
    }, { headers: this.jsonHeaders });
  }

  cancelarReserva(usuario_id: number, reserva_id: number) {
    return this.http.post(`${this.url}/cancelar_reserva.php`, {
      usuario_id,
      reserva_id
    }, { headers: this.jsonHeaders });
  }

  cambiarFechasReserva(usuario_id: number, reserva_id: number, start: string, end: string) {
    return this.http.post(`${this.url}/cambiar_fechas_reserva.php`, {
      usuario_id,
      reserva_id,
      fecha_checkin: start,
      fecha_checkout: end
    }, { headers: this.jsonHeaders });
  }
}
