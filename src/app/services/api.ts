import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class Api {
  
  // Cambia esto por tu IP local si pruebas en celular real (ej: http://192.168.1.50/api-hotel)
  url = 'http://localhost/api-hotel'; 

  constructor(private http: HttpClient) { }

  // ============================
  //      ADMINISTRACIÓN
  // ============================

  // Obtener todas las reservas (Admin)
  getTodasLasReservas() {
    return this.http.get(`${this.url}/admin_get_reservas.php`);
  }

  // Alias para compatibilidad (Arregla error 3)
  getReservasAdmin() {
    return this.getTodasLasReservas();
  }

  // Cambiar estado (Aprobar/Rechazar)
  cambiarEstadoReserva(id: number, estado: string) {
    return this.http.post(`${this.url}/admin_cambiar_estado.php`, {
      reserva_id: id,
      nuevo_estado: estado
    });
  }

  // Alias para compatibilidad (Arregla error 2)
  actualizarReserva(data: any) {
    return this.cambiarEstadoReserva(data.id, data.estado);
  }

  // Obtener estadísticas para Dashboard
  obtenerEstadisticas() {
    return this.http.get(`${this.url}/admin_stats.php`);
  }

  // Obtener datos para Gráficos
  getDatosGraficos() {
    return this.http.get(`${this.url}/admin_graficos.php`);
  }
// ... dentro de la clase Api ...
// ... dentro de la clase Api ...

  obtenerNotificaciones(usuario_id: number) {
    return this.http.get(`${this.url}/get_notificaciones.php?id=${usuario_id}`);
  }
  actualizarOfertaHabitacion(id: number, descuento: number) {
    return this.http.post(`${this.url}/admin_oferta_habitacion.php`, { 
      id: id, 
      descuento: descuento 
    });
  }
  // ... dentro de la clase Api ...
// ... (tus otras funciones) ...

  // Obtener lista de gente que está actualmente en el hotel
  getHuespedesActivos() {
    return this.http.get(`${this.url}/admin_recepcion.php?activos=true`);
  }
  // GESTIÓN DE RECEPCIÓN
  buscarReservaPorID(id: number) {
    return this.http.get(`${this.url}/admin_recepcion.php?id=${id}`);
  }

  procesarRecepcion(id: number, accion: string) {
    return this.http.post(`${this.url}/admin_recepcion.php`, { reserva_id: id, accion: accion });
  }
  // Gestión de Habitaciones
  agregarHabitacion(data: any) {
    return this.http.post(`${this.url}/admin_agregar_habitacion.php`, data);
  }
// ESTA ES LA QUE FALTA PARA ARREGLAR EL ERROR:
  validarCupon(codigo: string) {
    return this.http.post(`${this.url}/validar_cupon.php`, { codigo: codigo });
  }
  eliminarHabitacion(id: number) {
    return this.http.post(`${this.url}/admin_eliminar_habitacion.php`, { id: id });
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
// ... dentro de la clase Api ...

  // GESTIÓN DE CUPONES (ADMIN)
  getCupones() {
    return this.http.get(`${this.url}/admin_cupones.php`);
  }

  crearCupon(codigo: string, descuento: number) {
    return this.http.post(`${this.url}/admin_cupones.php`, { codigo, descuento });
  }

  borrarCupon(id: number) {
    return this.http.post(`${this.url}/admin_cupones.php`, { accion: 'borrar', id: id });
  }

  // OBTENER PROMO ACTIVA (USUARIO)
  getPromoActiva() {
    return this.http.get(`${this.url}/admin_cupones.php?promo=true`);
  }
  loginUsuario(data: any) {
    return this.http.post(`${this.url}/login.php`, data);
  }
  // ============================
//        FAVORITOS
// ============================

// FAVORITOS
getFavoritos(usuario_id: number, mode: 'ids' | 'details' = 'details') {
  return this.http.get(`${this.url}/favoritos_list.php?usuario_id=${usuario_id}&mode=${mode}`);
}

toggleFavorito(usuario_id: number, habitacion_id: number) {
  return this.http.post(`${this.url}/favoritos_toggle.php`, { usuario_id, habitacion_id });
}


// Sync (opcional) - si luego quieres sincronizar localStorage -> BD
syncFavoritos(usuario_id: number, habitacion_ids: number[]) {
  return this.http.post(`${this.url}/favoritos_sync.php`, { usuario_id, habitacion_ids });
}

}
