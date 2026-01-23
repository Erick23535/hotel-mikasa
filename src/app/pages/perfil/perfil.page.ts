import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: false
})
export class PerfilPage {

  usuario: any = {};
  appVersion = 'v1.0';

  constructor(private navCtrl: NavController) {}

  ionViewWillEnter() {
    const userJson = localStorage.getItem('usuario');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
    } else {
      this.navCtrl.navigateRoot('/login');
    }
  }

  cerrarSesion() {
    localStorage.clear();
    this.navCtrl.navigateRoot('/login');
  }

  irAlHome() {
    this.navCtrl.navigateBack('/home');
  }

  // ✅ helper UI (no rompe nada)
  getInitials(nombre: string | undefined | null): string {
    const s = (nombre || '').trim();
    if (!s) return 'U';
    const parts = s.split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) || 'U';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }
}
