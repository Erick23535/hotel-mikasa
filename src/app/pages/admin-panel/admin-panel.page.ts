import { Component, OnInit } from '@angular/core';
import { Api } from 'src/app/services/api';
import { NavController, ToastController, AlertController } from '@ionic/angular';
import { Chart, registerables } from 'chart.js';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// Registrar componentes de Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.page.html',
  styleUrls: ['./admin-panel.page.scss'],
  standalone: false
})
export class AdminPanelPage implements OnInit {

  // VARIABLES DE DATOS
  reservas: any = [];
  reservasOriginales: any = [];
  listaHabitaciones: any = [];
  listaCupones: any = [];
  listaHuespedes: any[] = [];

  // VARIABLES DE FORMULARIOS
  mostrarFormulario: boolean = false;
  nuevoCupon = { codigo: '', descuento: '' };

  // ✅ NUEVO: campos de capacidad incluidos
  nuevaHab = {
    numero: '',
    tipo: '',
    precio: '',
    descripcion: '',
    imagen_url: '',
    max_personas: 2,
    max_adultos: 2,
    max_ninos: 0
  };

  // ✅ NUEVO: modo edición
  editHabitacionId: number | null = null;

  // VARIABLES DE RECEPCIÓN
  qrInput: string = '';
  reservaEncontrada: any = null;

  // VARIABLES VISUALES
  seccion: string = 'dashboard';
  barChart: any;
  pieChart: any;

  stats: any = {
    ingresos: 0,
    pendientes: 0,
    clientes: 0,
    top_habitacion: { numero: '', tipo: '', veces_reservada: 0 }
  };

  constructor(
    private api: Api,
    private toast: ToastController,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
  private router: Router
  ) {}

  ngOnInit() {}

ionViewWillEnter() {
  const st = history.state || {};
  if (st?.seccion) this.seccion = st.seccion;

  this.cargarDashboard();
  this.cargarDatos();
  setTimeout(() => this.cargarDatosGraficos(), 500);

  // ✅ FIX: si entras ya en recepción, cargar huéspedes
  if (this.seccion === 'recepcion') {
    this.cargarHuespedesActivos();
  }
}

openAssistantAdmin() {
  this.router.navigate(['/assistant-faq-admin']);
}

irAFacturarCheckout(idReserva: number = 0) {
  const idFinal = idReserva > 0
    ? idReserva
    : (this.reservaEncontrada ? Number(this.reservaEncontrada.id) : 0);

  if (!idFinal) {
    this.mostrarToast("Selecciona una reserva primero");
    return;
  }

  // Pasamos snapshot si existe (no es obligatorio)
  const snap = (idReserva === 0 && this.reservaEncontrada) ? this.reservaEncontrada : null;

  this.router.navigate(['/factura-checkout'], {
    state: { reservaId: idFinal, reserva: snap }
  });
}

  doRefresh(event: any) {
    this.cargarDashboard();
    this.cargarDatos();

    if (this.seccion === 'dashboard') this.cargarDatosGraficos();
    if (this.seccion === 'recepcion') this.cargarHuespedesActivos();

    setTimeout(() => { event.target.complete(); }, 1000);
  }
async exportarExcel() {
  const base =
    Capacitor.getPlatform() === 'web'
      ? 'http://localhost/api-hotel'
      : 'http://192.168.0.10/api-hotel';

  const url = `${base}/admin_exportar_excel.php`;

  if (Capacitor.getPlatform() === 'web') {
    window.open(url, '_blank');
    return;
  }

  await Browser.open({ url });
}
  cargarDashboard() {
    this.api.obtenerEstadisticas().subscribe((res: any) => {
      this.stats = res;
      this.reservasOriginales = res;
    });
  }

  cargarDatos() {
    this.api.getReservasAdmin().subscribe((res: any) => {
      this.reservas = res;
      this.api.getCupones().subscribe((res2: any) => { this.listaCupones = res2; });
    });

    this.api.getHabitaciones().subscribe((res: any) => {
      this.listaHabitaciones = res;
    });
  }

  segmentChanged(ev: any) {
    this.seccion = ev.detail.value;

    if (this.seccion === 'dashboard') {
      setTimeout(() => { this.cargarDatosGraficos(); }, 300);
    }
    if (this.seccion === 'recepcion') {
      this.cargarHuespedesActivos();
    }
  }

  // ==========================================
  //          LÓGICA DE GRÁFICOS
  // ==========================================
  cargarDatosGraficos() {
    this.api.getDatosGraficos().subscribe((res: any) => {
      if (this.seccion === 'dashboard') {
        this.crearGraficoBarras(res.barras);
        this.crearGraficoPastel(res.pastel);
      }
    });
  }

  crearGraficoBarras(datos: any) {
    if (this.barChart) this.barChart.destroy();
    const ctx = document.getElementById('barChart') as HTMLCanvasElement;
    if (!ctx) return;

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: datos.labels,
        datasets: [{
          label: 'Ingresos USD',
          data: datos.data,
          backgroundColor: '#2ecc71',
          borderWidth: 1
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  crearGraficoPastel(datos: any) {
    if (this.pieChart) this.pieChart.destroy();
    const ctx = document.getElementById('pieChart') as HTMLCanvasElement;
    if (!ctx) return;

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: datos.labels,
        datasets: [{
          data: datos.data,
          backgroundColor: ['#3498db', '#9b59b6', '#f1c40f', '#e74c3c', '#1abc9c']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // ==========================================
  //          LÓGICA DE RECEPCIÓN
  // ==========================================

cargarHuespedesActivos() {
  this.api.getHuespedesActivos().subscribe({
    next: (res: any) => {
      // ✅ robusto: si backend devuelve array directo o {data:[]}
      this.listaHuespedes = Array.isArray(res) ? res : (res?.data ?? []);
    },
    error: (err) => {
      console.error('getHuespedesActivos error', err);
      this.listaHuespedes = [];
      this.mostrarToast('No se pudo cargar huéspedes activos');
    }
  });
}
  buscarReservaQR() {
    if (!this.qrInput) {
      this.mostrarToast("Ingresa el número de reserva del QR");
      return;
    }

    this.api.buscarReservaPorID(parseInt(this.qrInput)).subscribe((res: any) => {
      if (res.success) {
        this.reservaEncontrada = res.data;
      } else {
        this.mostrarToast("❌ " + res.mensaje);
        this.reservaEncontrada = null;
      }
    });
  }

  procesarCheckIn() {
    this.api.procesarRecepcion(this.reservaEncontrada.id, 'checkin').subscribe((res: any) => {
      if (res.success) {
        this.mostrarAlerta("¡BIENVENIDO!", "Entregar Llave de Habitación " + this.reservaEncontrada.numero);
        this.limpiarRecepcion();
        this.cargarHuespedesActivos();
        this.cargarDatos();
      }
    });
  }

 procesarCheckOut(idReserva: number = 0) {
  // Si viene ID (desde la lista), usamos ese. Si no, usamos la reserva encontrada del buscador.
  const idFinal = idReserva > 0 ? idReserva : (this.reservaEncontrada ? this.reservaEncontrada.id : 0);

  if (idFinal === 0) return;

  this.api.procesarRecepcion(idFinal, 'checkout').subscribe((res: any) => {
    if (res.success) {
      this.mostrarAlerta("¡HASTA LUEGO!", "Recibir llaves y revisar habitación.");
      this.limpiarRecepcion();
      this.cargarHuespedesActivos();
      this.cargarDatos();
    }
  });
}


  limpiarRecepcion() {
    this.qrInput = '';
    this.reservaEncontrada = null;
  }

  // ==========================================
  //          LÓGICA DE RESERVAS
  // ==========================================

  cambiarEstado(reserva: any, nuevoEstado: string) {
    let data = { id: reserva.id, estado: nuevoEstado };
    this.api.actualizarReserva(data).subscribe((res: any) => {
      if (res.success) {
        this.mostrarToast(`Reserva ${nuevoEstado}`);
        this.cargarDatos();
        this.cargarDashboard();
        this.cargarDatosGraficos();
      }
    });
  }

  filtrarReservas(event: any) {
    const texto = (event.target.value || '').toLowerCase();
    if (!texto || texto.trim() === '') {
      this.cargarDatos();
      return;
    }

    this.reservas = (this.reservas || []).filter((r: any) => {
      return (
        (r.cliente || '').toLowerCase().includes(texto) ||
        (r.id || '').toString().includes(texto) ||
        (r.estado || '').toLowerCase().includes(texto)
      );
    });
  }

  // ==========================================
  //          LÓGICA DE MARKETING
  // ==========================================

  guardarCupon() {
    if (!this.nuevoCupon.codigo || !this.nuevoCupon.descuento) {
      this.mostrarToast("Completa los datos");
      return;
    }

    this.api.crearCupon(this.nuevoCupon.codigo, parseInt(this.nuevoCupon.descuento)).subscribe((res: any) => {
      if (res.success) {
        this.mostrarToast("¡Promoción Lanzada!");
        this.nuevoCupon = { codigo: '', descuento: '' };
        this.cargarDatos();
      } else {
        this.mostrarToast(res.mensaje);
      }
    });
  }

  eliminarCupon(id: number) {
    this.api.borrarCupon(id).subscribe(() => {
      this.mostrarToast("Cupón eliminado");
      this.cargarDatos();
    });
  }

  // ==========================================
  //          LÓGICA DE INVENTARIO
  // ==========================================

  // ✅ NUEVO: botón para abrir/cerrar sin romper
  toggleFormularioHabitacion() {
    if (this.mostrarFormulario) {
      // si está abierto, cerrar y reset
      this.cancelarEdicionHabitacion();
    } else {
      this.mostrarFormulario = true;
      this.editHabitacionId = null;
      this.resetNuevaHab();
    }
  }

  // ✅ NUEVO: cargar datos en el formulario para editar
  editarHabitacion(h: any) {
    if (!h) return;

    this.mostrarFormulario = true;
    this.editHabitacionId = Number(h.id) || null;

    this.nuevaHab = {
      numero: h.numero ?? '',
      tipo: h.tipo ?? '',
      precio: h.precio ?? '',
      descripcion: h.descripcion ?? '',
      imagen_url: h.imagen_url ?? '',
      max_personas: Number(h.max_personas ?? 2),
      max_adultos: Number(h.max_adultos ?? 2),
      max_ninos: Number(h.max_ninos ?? 0)
    };
  }

  // ✅ NUEVO: cancelar edición
  cancelarEdicionHabitacion() {
    this.editHabitacionId = null;
    this.mostrarFormulario = false;
    this.resetNuevaHab();
  }

  private resetNuevaHab() {
    this.nuevaHab = {
      numero: '',
      tipo: '',
      precio: '',
      descripcion: '',
      imagen_url: '',
      max_personas: 2,
      max_adultos: 2,
      max_ninos: 0
    };
  }

  guardarHabitacion() {
    // Validación básica (tu lógica intacta)
    if (!this.nuevaHab.numero || !this.nuevaHab.precio) {
      this.mostrarToast("Faltan datos obligatorios");
      return;
    }

    // ✅ NUEVO: guardrails capacidad
    const maxP = Number(this.nuevaHab.max_personas ?? 0);
    const maxA = Number(this.nuevaHab.max_adultos ?? 0);
    const maxN = Number(this.nuevaHab.max_ninos ?? 0);

    if (isNaN(maxP) || maxP < 1) {
      this.mostrarToast("Máx. huéspedes debe ser mínimo 1");
      return;
    }
    if (isNaN(maxA) || maxA < 0) {
      this.mostrarToast("Máx. adultos inválido");
      return;
    }
    if (isNaN(maxN) || maxN < 0) {
      this.mostrarToast("Máx. niños inválido");
      return;
    }
    // opcional: coherencia (no rompe si quieres permitir)
    if ((maxA + maxN) < 1) {
      this.mostrarToast("Configura al menos 1 huésped permitido");
      return;
    }
    if ((maxA + maxN) > maxP) {
      this.mostrarToast("Adultos + niños no puede superar Máx. huéspedes");
      return;
    }

    // ✅ SI ES EDICIÓN -> actualizar (endpoint nuevo)
    if (this.editHabitacionId) {
      const payload = { ...this.nuevaHab, id: this.editHabitacionId };

      this.api.actualizarHabitacion(payload).subscribe((res: any) => {
        if (res?.success) {
          this.mostrarToast("¡Habitación Actualizada!");
          this.cancelarEdicionHabitacion();
          this.cargarDatos();
        } else {
          this.mostrarToast("Error: " + (res?.mensaje || 'No se pudo actualizar'));
        }
      });
      return;
    }

    // ✅ SI ES NUEVA -> tu flujo original
    this.api.agregarHabitacion(this.nuevaHab).subscribe((res: any) => {
      if (res.success) {
        this.mostrarToast("¡Habitación Creada!");
        this.mostrarFormulario = false;
        this.editHabitacionId = null;
        this.resetNuevaHab();
        this.cargarDatos();
      } else {
        this.mostrarToast("Error: " + res.mensaje);
      }
    });
  }

  async borrarHabitacion(id: number) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar',
      message: '¿Seguro que deseas eliminar esta habitación?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.api.eliminarHabitacion(id).subscribe((res: any) => {
              if (res.success) {
                this.mostrarToast("Eliminada correctamente");
                this.cargarDatos();
              } else {
                this.mostrarToast("No se pudo eliminar: " + res.mensaje);
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async ponerOferta(habitacion: any) {
    const alert = await this.alertCtrl.create({
      header: `Oferta: ${habitacion.tipo}`,
      subHeader: 'Habitación #' + habitacion.numero,
      message: 'Ingresa el porcentaje de descuento (0 para quitar oferta).',
      inputs: [
        {
          name: 'descuento',
          type: 'number',
          placeholder: 'Ej: 20',
          min: 0,
          max: 100,
          value: habitacion.descuento
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar Oferta',
          handler: (data) => {
            this.guardarOfertaBackend(habitacion.id, data.descuento);
          }
        }
      ]
    });
    await alert.present();
  }

  guardarOfertaBackend(id: number, descuento: any) {
    this.api.actualizarOfertaHabitacion(id, descuento).subscribe((res: any) => {
      if (res.success) {
        this.mostrarToast("Oferta actualizada correctamente");
        this.cargarDatos();
      } else {
        this.mostrarToast("Error: " + res.mensaje);
      }
    });
  }

  // ==========================================
  //          UTILIDADES
  // ==========================================

  async mostrarToast(msj: string) {
    const t = await this.toast.create({ message: msj, duration: 2000 });
    t.present();
  }

  async mostrarAlerta(titulo: string, mensaje: string) {
    const alert = await this.alertCtrl.create({
      header: titulo,
      message: mensaje,
      buttons: ['OK'],
      cssClass: 'alerta-recepcion'
    });
    await alert.present();
  }

  salir() {
    localStorage.clear();
    this.navCtrl.navigateRoot('/login');
  }
}
