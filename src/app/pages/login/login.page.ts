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

  returnUrl: string | null = null;

  // =========================
  // ✅ 3.3 Recuperación clave
  // =========================
  recoveryOpen = false;
  recoveryStep = 1;
  recoveryEmail = '';
  recoveryCode = '';
  recoveryNewPass = '';
  recoveryNewPass2 = '';
  loadingRec = false;

  toastOpen = false;
  toastMsg = '';

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

  // =========================
  // ✅ NUEVO: Recuperar contraseña (modal)
  // =========================

  openRecovery() {
    this.recoveryStep = 1;

    // ✅ Si ya escribió email en login, lo reutilizamos (mejor UX, no rompe)
    this.recoveryEmail = (this.credenciales?.email || '').trim();

    this.recoveryCode = '';
    this.recoveryNewPass = '';
    this.recoveryNewPass2 = '';
    this.recoveryOpen = true;
  }

  private toast(msg: string) {
    this.toastMsg = msg;
    this.toastOpen = true;
  }

  sendRecoveryCode() {
    if (!this.recoveryEmail) return this.toast('Escribe tu correo');

    this.loadingRec = true;

    // ⚠️ Requiere que existan estos métodos en tu Api service:
    // requestPasswordReset(email)
    // resetPassword(email, code, newPass)
    this.api.requestPasswordReset(this.recoveryEmail).subscribe({
      next: (r: any) => {
        this.loadingRec = false;

        // Modo DEV: si viene dev_code lo mostramos para probar
        if (r?.dev_code) this.toast(`CÓDIGO (DEV): ${r.dev_code}`);
        else this.toast(r?.mensaje || 'Revisa tu correo');

        this.recoveryStep = 2;
      },
      error: () => {
        this.loadingRec = false;
        this.toast('No se pudo enviar el código');
      }
    });
  }

  confirmReset() {
    if (!/^\d{6}$/.test(this.recoveryCode)) return this.toast('Código inválido');
    if (!this.recoveryNewPass || this.recoveryNewPass.length < 6) return this.toast('Mínimo 6 caracteres');
    if (this.recoveryNewPass !== this.recoveryNewPass2) return this.toast('No coinciden las contraseñas');

    this.loadingRec = true;

    this.api.resetPassword(this.recoveryEmail, this.recoveryCode, this.recoveryNewPass).subscribe({
      next: (r: any) => {
        this.loadingRec = false;
        this.toast(r?.mensaje || 'Contraseña cambiada');
        this.recoveryOpen = false;

        // ✅ opcional: dejar el email listo en el login (no rompe)
        this.credenciales.email = this.recoveryEmail;
        this.credenciales.password = '';
      },
      error: (e: any) => {
        this.loadingRec = false;
        this.toast(e?.error?.mensaje || 'No se pudo cambiar');
      }
    });
  }
}
