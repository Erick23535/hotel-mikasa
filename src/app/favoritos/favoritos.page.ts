import { Component } from '@angular/core';
import { Api } from 'src/app/services/api';
import { NavController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthGateService } from 'src/app/services/auth-gate.service';

@Component({
  selector: 'app-favoritos',
  templateUrl: './favoritos.page.html',
  styleUrls: ['./favoritos.page.scss'],
  standalone: false
})
export class FavoritosPage {

  usuario: any;
  favoritos: any[] = [];
  private readonly FAVOR_KEY = 'hotel_favoritos_ids_v1';

  cargando: boolean = false;

  constructor(
    private api: Api,
    private navCtrl: NavController,
    private toast: ToastController,
    private router: Router,
    private authGate: AuthGateService
  ) {}

  ionViewWillEnter() {
    const userJson = localStorage.getItem('usuario');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
      this.cargarFavoritos();
    } else {
      this.authGate.requireLogin(this.router, '/favoritos');
      return;
    }
  }

  volver() {
    this.navCtrl.navigateBack('/home');
  }

  async cargarFavoritos(event?: any) {
    if (!this.usuario?.id) {
      event?.target?.complete?.();
      return;
    }

    this.cargando = !event;

    this.api.getFavoritos(this.usuario.id, 'details').subscribe({
      next: (res: any) => {
        // ✅ si backend responde success:false, NO borres cache local
        if (res && typeof res === 'object' && res.success === false) {
          this.favoritos = [];
          this.cargando = false;
          event?.target?.complete?.();
          this.mostrarToast(res?.mensaje || 'No se pudieron cargar tus favoritos');
          return;
        }

        // backend puede devolver array directo o {lista:[]}
        const lista = Array.isArray(res?.lista) ? res.lista : (Array.isArray(res) ? res : []);
        this.favoritos = lista;

        this.cargando = false;
        event?.target?.complete?.();

        // ✅ solo actualiza cache si vino OK
        const ids = (this.favoritos || [])
          .map((x: any) => Number(x?.id))
          .filter((n: any) => n > 0);

        try { localStorage.setItem(this.FAVOR_KEY, JSON.stringify(ids)); } catch {}
      },
      error: async () => {
        this.cargando = false;
        event?.target?.complete?.();
        this.mostrarToast('No se pudieron cargar tus favoritos');
      }
    });
  }

  verDetalle(habitacion: any) {
    this.router.navigate(['/detalle-habitacion'], { state: { habitacion } });
  }

  async quitarDeFavoritos(h: any) {
    if (!h?.id || !this.usuario?.id) return;

    const before = [...this.favoritos];
    this.favoritos = this.favoritos.filter(x => x.id !== h.id);

    this.api.toggleFavorito(this.usuario.id, h.id).subscribe({
      next: async (res: any) => {
        if (res && typeof res === 'object' && res.success === false) {
          this.favoritos = before;
          this.mostrarToast(res?.mensaje || 'No se pudo actualizar');
          return;
        }

        // si backend dice que aún es favorito, rollback
        if (res?.favorito === true) {
          this.favoritos = before;
        }

        // ✅ refresca cache local ids tras quitar
        const ids = (this.favoritos || [])
          .map((x: any) => Number(x?.id))
          .filter((n: any) => n > 0);
        try { localStorage.setItem(this.FAVOR_KEY, JSON.stringify(ids)); } catch {}

        this.mostrarToast(res?.favorito === false ? 'Quitado de favoritos' : 'Actualizado');
      },
      error: async () => {
        this.favoritos = before;
        this.mostrarToast('Error quitando favorito');
      }
    });
  }

  async mostrarToast(msj: string) {
    const t = await this.toast.create({ message: msj, duration: 1800, position: 'bottom' });
    t.present();
  }
}
