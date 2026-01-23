import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from 'src/app/services/api';
import { ToastController, AlertController } from '@ionic/angular';
import { AuthGateService } from 'src/app/services/auth-gate.service';

@Component({
  selector: 'app-detalle-habitacion',
  templateUrl: './detalle-habitacion.page.html',
  styleUrls: ['./detalle-habitacion.page.scss'],
  standalone: false
})
export class DetalleHabitacionPage implements OnInit {

  habitacion: any;
  usuario: any;

  adultos: number = 1;
  ninos: number = 0;

  // --- VARIABLES PARA RESERVA ---
  fechaInicio: string = '';
  fechaFin: string = '';

  totalPagar: number = 0;
  diasEstadia: number = 0;
  precioHabitacionTotal: number = 0;
  costoExtras: number = 0;

  // --- VARIABLES PARA EXTRAS ---
  extras = {
    desayuno: false,
    decoracion: false,
    mascota: false
  };

  // --- VARIABLES PARA CUPONES ---
  codigoCupon: string = '';
  descuentoAplicado: number = 0;
  mensajeCupon: string = '';
  colorMensajeCupon: string = 'medium';
  precioSinDescuento: number = 0;

  // --- VARIABLES PARA COMENTARIOS ---
  comentarios: any[] = [];
  promedio: number = 0;
  totalReviews: number = 0;
  nuevaResena = { calificacion: 0, mensaje: '' };

  constructor(
    private router: Router,
    private api: Api,
    private toast: ToastController,
    private alertCtrl: AlertController,
    private authGate: AuthGateService
  ) {
    // ✅ Soporta navegación normal + regreso desde login (history.state)
    const navState = this.router.getCurrentNavigation()?.extras?.state ?? (history.state || {});

    if (navState && navState['habitacion']) {
      this.habitacion = navState['habitacion'];
    }

    // ✅ NUEVO: si vienes desde “Buscar disponibilidad”, carga fechas automáticamente
    if (navState) {
      if (navState['fechaInicio']) this.fechaInicio = navState['fechaInicio'];
      if (navState['fechaFin']) this.fechaFin = navState['fechaFin'];

      // ✅ NUEVO: carga huéspedes automáticamente
      const a = Number(navState['adultos']);
      const n = Number(navState['ninos']);

      if (!isNaN(a) && a >= 1) this.adultos = a;
      if (!isNaN(n) && n >= 0) this.ninos = n;

      // ✅ Si volvimos “donde estaba”, restauramos selección (opcional, sin romper)
      if (navState['extras']) this.extras = { ...this.extras, ...navState['extras'] };
      if (navState['codigoCupon']) this.codigoCupon = navState['codigoCupon'];
      if (typeof navState['descuentoAplicado'] === 'number') this.descuentoAplicado = navState['descuentoAplicado'];
      if (navState['mensajeCupon']) this.mensajeCupon = navState['mensajeCupon'];
      if (navState['colorMensajeCupon']) this.colorMensajeCupon = navState['colorMensajeCupon'];
      if (typeof navState['precioSinDescuento'] === 'number') this.precioSinDescuento = navState['precioSinDescuento'];
    }
  }

  ngOnInit() {
    this.refrescarUsuario();

    if (this.habitacion) {
      this.cargarComentarios();
      // ✅ si ya vinieron fechas, recalcula total sin tocar tu lógica
      this.calcularTotal();
    }
  }

  // ✅ Clave: cuando vuelves del login, Ionic re-entra a la vista
  ionViewWillEnter() {
    this.refrescarUsuario();
  }

  private refrescarUsuario() {
    const user = localStorage.getItem('usuario');
    this.usuario = user ? JSON.parse(user) : null;
  }

  // ==========================================
  //          LÓGICA DE CUPONES (CORREGIDA)
  // ==========================================
  aplicarCupon() {
    if (!this.codigoCupon) {
      this.mostrarMensaje("Escribe un código primero");
      return;
    }

    this.api.validarCupon(this.codigoCupon).subscribe((res: any) => {
      if (res.success) {
        this.descuentoAplicado = res.descuento;
        this.mensajeCupon = res.mensaje;
        this.colorMensajeCupon = 'success';

        this.mostrarMensaje(`¡Descuento del ${res.descuento}% aplicado!`);
        this.calcularTotal();
      } else {
        this.descuentoAplicado = 0;
        this.mensajeCupon = res.mensaje;
        this.colorMensajeCupon = 'danger';
        this.precioSinDescuento = 0;

        this.calcularTotal();
        this.mostrarMensaje(res.mensaje);
      }
    }, err => {
      console.error(err);
      this.mostrarMensaje("Error al validar cupón");
    });
  }

  // ==========================================
  //          LÓGICA DE CÁLCULO TOTAL
  // ==========================================
  calcularTotal() {
    if (this.fechaInicio && this.fechaFin) {
      const fecha1 = new Date(this.fechaInicio);
      const fecha2 = new Date(this.fechaFin);

      const diffTime = Math.abs(fecha2.getTime() - fecha1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      this.diasEstadia = diffDays;

      if (fecha1 >= fecha2) {
        this.totalPagar = 0;
        this.diasEstadia = 0;
        return;
      }

      let precioBase = parseFloat(this.habitacion.precio);

      if (this.habitacion.descuento && this.habitacion.descuento > 0) {
        let rebajaHabitacion = (precioBase * this.habitacion.descuento) / 100;
        precioBase = precioBase - rebajaHabitacion;
      }

      this.precioHabitacionTotal = this.diasEstadia * precioBase;

      this.costoExtras = 0;
      if (this.extras.desayuno) this.costoExtras += (10 * this.diasEstadia);
      if (this.extras.decoracion) this.costoExtras += 30;
      if (this.extras.mascota) this.costoExtras += 20;

      let subtotal = this.precioHabitacionTotal + this.costoExtras;

      if (this.descuentoAplicado > 0) {
        this.precioSinDescuento = subtotal;
        let dineroDescontado = (subtotal * this.descuentoAplicado) / 100;
        this.totalPagar = subtotal - dineroDescontado;
      } else {
        this.totalPagar = subtotal;
        this.precioSinDescuento = 0;
      }
    }
  }

  resetearCalculos() {
    this.totalPagar = 0;
    this.diasEstadia = 0;
    this.precioHabitacionTotal = 0;
    this.costoExtras = 0;
  }

  // ✅ Invitado: ve todo, pero al reservar -> login y vuelve aquí con el estado
  reservar() {
    if (!this.usuario) {
      this.mostrarMensaje("Debes iniciar sesión para reservar");

      this.authGate.requireLogin(this.router, this.router.url, {
        habitacion: this.habitacion,
        fechaInicio: this.fechaInicio,
        fechaFin: this.fechaFin,
        adultos: this.adultos,     // ✅ NUEVO (sin romper)
        ninos: this.ninos,         // ✅ NUEVO (sin romper)
        extras: this.extras,
        codigoCupon: this.codigoCupon,
        descuentoAplicado: this.descuentoAplicado,
        mensajeCupon: this.mensajeCupon,
        colorMensajeCupon: this.colorMensajeCupon,
        precioSinDescuento: this.precioSinDescuento
      });
      return;
    }

    if (this.totalPagar <= 0) {
      this.mostrarMensaje("Selecciona fechas válidas");
      return;
    }

    let listaExtras: string[] = [];
    if (this.extras.desayuno) listaExtras.push("Desayuno");
    if (this.extras.decoracion) listaExtras.push("Decoración");
    if (this.extras.mascota) listaExtras.push("Mascota");

    if (this.codigoCupon && this.descuentoAplicado > 0) {
      listaExtras.push(`CUPÓN: ${this.codigoCupon} (-${this.descuentoAplicado}%)`);
    }

    const textoExtras = listaExtras.length > 0 ? listaExtras.join(", ") : "Ninguno";

    let datosReserva = {
      usuario_id: this.usuario.id,
      habitacion_id: this.habitacion.id,
      fecha_checkin: this.fechaInicio,
      fecha_checkout: this.fechaFin,
      total: this.totalPagar,
      extras: textoExtras,

      // ✅ NUEVO
      adultos: this.adultos,
      ninos: this.ninos,
      huespedes_total: (Number(this.adultos) + Number(this.ninos))
    };

    const totalH = Number(this.adultos) + Number(this.ninos);

    // si existen campos nuevos en la habitación, validamos
    const maxP = Number(this.habitacion?.max_personas || 0);
    const maxA = Number(this.habitacion?.max_adultos || 0);
    const maxN = Number(this.habitacion?.max_ninos || 0);

    if (maxP > 0 && totalH > maxP) {
      this.mostrarMensaje(`Esta habitación permite máximo ${maxP} huéspedes`);
      return;
    }
    if (maxA > 0 && Number(this.adultos) > maxA) {
      this.mostrarMensaje(`Máximo adultos permitidos: ${maxA}`);
      return;
    }
    if (maxN > 0 && Number(this.ninos) > maxN) {
      this.mostrarMensaje(`Máximo niños permitidos: ${maxN}`);
      return;
    }

    this.api.crearReserva(datosReserva).subscribe((res: any) => {
      if (res.success) {
        this.mostrarMensaje("¡Reserva Confirmada!");
        this.router.navigate(['/mis-reservas']);
      } else {
        this.mostrarMensaje(res.mensaje);
      }
    });
  }

  // ==========================================
  //      LÓGICA DE COMENTARIOS
  // ==========================================
  cargarComentarios() {
    this.api.getComentarios(this.habitacion.id).subscribe((res: any) => {
      if (res.lista) {
        this.comentarios = res.lista;
        this.promedio = res.promedio;
        this.totalReviews = res.total_reviews;
      }
    });
  }

  setEstrellas(numero: number) {
    this.nuevaResena.calificacion = numero;
  }

  async enviarOpinion() {
    if (!this.usuario) {
      this.mostrarMensaje("Inicia sesión para opinar");

      // ✅ NUEVO: así también vuelve con fechas/huéspedes y no se pierde nada
      this.authGate.requireLogin(this.router, this.router.url, {
        habitacion: this.habitacion,
        fechaInicio: this.fechaInicio,
        fechaFin: this.fechaFin,
        adultos: this.adultos,
        ninos: this.ninos,
        extras: this.extras,
        codigoCupon: this.codigoCupon,
        descuentoAplicado: this.descuentoAplicado,
        mensajeCupon: this.mensajeCupon,
        colorMensajeCupon: this.colorMensajeCupon,
        precioSinDescuento: this.precioSinDescuento
      });
      return;
    }

    if (this.nuevaResena.calificacion === 0) {
      this.mostrarMensaje("Selecciona las estrellas");
      return;
    }

    const data = {
      habitacion_id: this.habitacion.id,
      usuario_id: this.usuario.id,
      calificacion: this.nuevaResena.calificacion,
      mensaje: this.nuevaResena.mensaje
    };

    this.api.enviarComentario(data).subscribe((res: any) => {
      if (res.success) {
        this.mostrarMensaje("¡Gracias por tu opinión!");
        this.nuevaResena = { calificacion: 0, mensaje: '' };
        this.cargarComentarios();
      }
    });
  }

  async mostrarMensaje(msj: string) {
    const t = await this.toast.create({ message: msj, duration: 2000, position: 'bottom' });
    t.present();
  }
}
