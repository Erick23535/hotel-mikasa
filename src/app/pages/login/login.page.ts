import { Component } from '@angular/core';
import { Api } from 'src/app/services/api';
import { NavController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthGateService } from 'src/app/services/auth-gate.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage {
  credenciales = { email: '', password: '' };

  // Solo para UI: mostrar “Volver” si hay retorno guardado
  returnUrl: string | null = null;

  constructor(
    private api: Api,
    private navCtrl: NavController,
    private toastController: ToastController,
    private router: Router,
    private authGate: AuthGateService
  ) {}

  ionViewWillEnter() {
    this.returnUrl = this.authGate.peekReturnUrl();
  }

  continuarComoInvitado() {
    this.authGate.setGuestMode();
    // No guardamos usuario, solo entramos a Home
    this.navCtrl.navigateRoot('/home');
  }

  volver() {
    // Si venía de una acción protegida, volvemos al retorno
    const ret = this.authGate.consumeReturn();
    if (ret.url) {
      this.router.navigateByUrl(ret.url, { state: ret.state ?? undefined });
      return;
    }
    this.navCtrl.navigateRoot('/home');
  }

  async ingresar() {
    this.api.loginUsuario(this.credenciales).subscribe(
      (res: any) => {
        if (res.success) {
          localStorage.setItem('usuario', JSON.stringify(res.usuario));
          this.authGate.clearGuestMode();

          // ✅ regresar “donde estaba” (si existía)
          const ret = this.authGate.consumeReturn();

          // Admin: prioriza panel admin (salvo que retorno sea /admin...)
          if (res.usuario?.rol === 'admin') {
            if (ret.url && ret.url.startsWith('/admin')) {
              this.router.navigateByUrl(ret.url, { state: ret.state ?? undefined });
            } else {
              this.navCtrl.navigateRoot('/admin-panel');
            }
            return;
          }

          // Cliente: si hay retorno, vuelve ahí; si no, Home normal
          if (ret.url) {
            this.router.navigateByUrl(ret.url, { state: ret.state ?? undefined });
          } else {
            this.navCtrl.navigateRoot('/home');
          }
        } else {
          this.mostrarMensaje(res.mensaje || 'Credenciales inválidas');
        }
      },
      () => this.mostrarMensaje('Error conectando al servidor')
    );
  }

  async mostrarMensaje(texto: string) {
    const toast = await this.toastController.create({
      message: texto,
      duration: 2000,
      color: 'danger'
    });
    toast.present();
  }
}
