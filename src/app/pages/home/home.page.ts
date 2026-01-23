import { Component } from '@angular/core';
import { Api } from 'src/app/services/api';
import { NavController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage {

  habitaciones: any = [];
  nombreUsuario: string = '';
  private usuarioId: number | null = null;

  loadingRooms = false;

  filtro = { start: '', end: '', adultos: 1, ninos: 0 };
  busquedaActiva: boolean = false;

  promoActiva: any = null;
  notificaciones: any[] = [];
  cantidadNuevas: number = 0;

  modalOpen: boolean = false;

  // ============================
  // FAVORITOS (nuevo, sin romper)
  // ============================
  private readonly FAVOR_KEY = 'hotel_favoritos_ids_v1';
  private favoritosIds: Set<number> = new Set<number>();
  private firstGuestFavHintShown = false;

  constructor(
    private api: Api,
    private navCtrl: NavController,
    private router: Router,
    private toast: ToastController
  ) {}

  ionViewWillEnter() {
    const userStr = localStorage.getItem('usuario');

    if (userStr) {
      const user = JSON.parse(userStr);
      this.nombreUsuario = user.nombre;
      this.usuarioId = Number(user.id) || null;

      this.cargarPromo();
      this.cargarNotificaciones(user.id);

      // ✅ key: recarga ids del servidor (sin borrar local si falla)
      this.cargarFavoritosIdsDesdeServidor();
    } else {
      this.nombreUsuario = '';
      this.usuarioId = null;

      // invitado: solo local
      this.cargarFavoritosLocal();
    }

    if (!this.busquedaActiva) {
      this.cargarHabitaciones();
    }
  }

  // --- NOTIFICACIONES ---
  cargarNotificaciones(id: number) {
    this.api.obtenerNotificaciones(id).subscribe((res: any) => {
      this.notificaciones = res.lista || [];
      this.cantidadNuevas = res.nuevas || 0;
    });
  }

  verNotificaciones() {
    if (!this.notificaciones || this.notificaciones.length === 0) {
      this.mostrarToast("No tienes notificaciones nuevas");
      return;
    }
    this.modalOpen = true;
    this.cantidadNuevas = 0;
  }

  cargarPromo() {
    this.api.getPromoActiva().subscribe((res: any) => {
      if (res) this.promoActiva = res;
    });
  }

  async copiarCodigo() {
    await navigator.clipboard.writeText(this.promoActiva.codigo);
    this.mostrarToast("¡Código copiado! Úsalo al reservar.");
  }

  // --- HABITACIONES ---
  cargarHabitaciones() {
    // ✅ no rompe tu flujo
    this.busquedaActiva = false;

    // ✅ “Booking feel”: muestra skeleton mientras carga
    this.loadingRooms = true;

    this.api.getHabitaciones().subscribe({
      next: (res: any) => {
        this.habitaciones = res || [];
      },
      error: () => {
        this.habitaciones = this.habitaciones || [];
        this.mostrarToast?.("No se pudo cargar habitaciones. Intenta de nuevo.");
      },
      complete: () => {
        this.loadingRooms = false;
      }
    });
  }

  buscar() {
    if (this.filtro.start > this.filtro.end) {
      this.mostrarToast("La fecha de salida debe ser posterior a la entrada");
      return;
    }

    // guardrails tipo Booking
    if (this.filtro.adultos < 1) this.filtro.adultos = 1;
    if (this.filtro.ninos < 0) this.filtro.ninos = 0;

    const total = Number(this.filtro.adultos) + Number(this.filtro.ninos);
    if (total < 1) {
      this.mostrarToast("Selecciona al menos 1 huésped");
      return;
    }

    this.mostrarToast("Buscando disponibilidad...");
    this.busquedaActiva = true;

    // ✅ NUEVO: activa skeleton “Booking”
    this.loadingRooms = true;

    this.api.buscarDisponibles(this.filtro.start, this.filtro.end, {
      adults: this.filtro.adultos,
      children: this.filtro.ninos
    }).subscribe({
      next: (res: any) => {
        this.habitaciones = res || [];
        if (this.habitaciones.length === 0) {
          this.mostrarToast("No hay habitaciones disponibles con esos huéspedes 😔");
        }
      },
      error: () => {
        this.mostrarToast("No se pudo buscar disponibilidad. Intenta de nuevo.");
      },
      complete: () => {
        // ✅ NUEVO: apaga skeleton
        this.loadingRooms = false;
      }
    });
  }

  recargarTodo() {
    this.filtro = { start: '', end: '', adultos: 1, ninos: 0 };

    // ✅ NUEVO: skeleton mientras recarga “todas”
    this.loadingRooms = true;

    // Tu flujo intacto
    this.cargarHabitaciones();
  }

  // ✅✅✅ NUEVO: pasa fechas + huéspedes al Detalle automáticamente (Booking)
  verDetalle(habitacion: any) {
    this.router.navigate(['/detalle-habitacion'], {
      state: {
        habitacion,

        // Fechas del buscador (si están)
        fechaInicio: this.filtro?.start || '',
        fechaFin: this.filtro?.end || '',

        // Huéspedes del buscador
        adultos: Number(this.filtro?.adultos ?? 1),
        ninos: Number(this.filtro?.ninos ?? 0),

        // (opcional) por si quieres saber si venía de búsqueda
        busquedaActiva: this.busquedaActiva
      }
    });
  }

  cerrarSesion() {
    localStorage.clear();
    this.nombreUsuario = '';
    this.usuarioId = null;
    this.favoritosIds.clear();
    this.guardarFavoritosLocal();
    this.navCtrl.navigateRoot('/login');
  }

  // ============================
  // FAVORITOS
  // ============================

  isFavorito(h: any): boolean {
    const id = Number(h?.id);
    if (!id) return false;
    return this.favoritosIds.has(id);
  }

  toggleFavorito(h: any, ev?: Event) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();

    const hid = Number(h?.id);
    if (!hid) return;

    // snapshot para rollback real
    const before = new Set<number>(Array.from(this.favoritosIds));

    // ✅ Optimista
    if (this.favoritosIds.has(hid)) this.favoritosIds.delete(hid);
    else this.favoritosIds.add(hid);

    this.guardarFavoritosLocal();

    // Invitado: solo local
    if (!this.usuarioId) {
      if (!this.firstGuestFavHintShown) {
        this.firstGuestFavHintShown = true;
        this.mostrarToast('Inicia sesión para sincronizar tus favoritos');
      }
      return;
    }

    // Logueado: backend
    this.api.toggleFavorito(this.usuarioId, hid).subscribe({
      next: (res: any) => {
        // ✅ si backend dice error, rollback
        if (res && typeof res === 'object' && res.success === false) {
          this.favoritosIds = before;
          this.guardarFavoritosLocal();
          this.mostrarToast(res?.mensaje || 'No se pudo guardar favorito');
          return;
        }

        // ✅ si backend devuelve estado final, lo respetamos
        if (typeof res?.favorito === 'boolean') {
          if (res.favorito) this.favoritosIds.add(hid);
          else this.favoritosIds.delete(hid);
          this.guardarFavoritosLocal();
        }
      },
      error: () => {
        // rollback
        this.favoritosIds = before;
        this.guardarFavoritosLocal();
        this.mostrarToast('No se pudo actualizar favorito');
      }
    });
  }

  private cargarFavoritosLocal() {
    try {
      const raw = localStorage.getItem(this.FAVOR_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(arr)
        ? arr.map((x: any) => Number(x)).filter((n: any) => n > 0)
        : [];
      this.favoritosIds = new Set<number>(ids);
    } catch {
      this.favoritosIds = new Set<number>();
    }
  }

  private guardarFavoritosLocal() {
    try {
      localStorage.setItem(this.FAVOR_KEY, JSON.stringify(Array.from(this.favoritosIds)));
    } catch { /* no-op */ }
  }

  private cargarFavoritosIdsDesdeServidor() {
    if (!this.usuarioId) return;

    // pinta rápido con local
    this.cargarFavoritosLocal();

    // ✅ luego trae ids desde BD (source of truth)
    this.api.getFavoritos(this.usuarioId, 'ids').subscribe({
      next: (res: any) => {
        // si backend falla, no borres local
        if (res && typeof res === 'object' && res.success === false) return;

        const ids = Array.isArray(res?.lista)
          ? res.lista.map((x: any) => Number(x)).filter((n: any) => n > 0)
          : [];

        // ✅ aunque sea vacío, si el backend respondió bien, eso manda
        this.favoritosIds = new Set<number>(ids);
        this.guardarFavoritosLocal();
      },
      error: () => {
        // si falla, nos quedamos con local (no hacemos nada)
      }
    });
  }

  async mostrarToast(msj: string) {
    const t = await this.toast.create({ message: msj, duration: 2000, position: 'bottom' });
    t.present();
  }
}
