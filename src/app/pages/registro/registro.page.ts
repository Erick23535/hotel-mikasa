import { Component } from '@angular/core';
import { Api } from 'src/app/services/api';
import { ToastController, NavController } from '@ionic/angular';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.page.html',
  styleUrls: ['./registro.page.scss'],
  standalone: false
})
export class RegistroPage {

  usuario = { nombre: '', email: '', password: '' };

  constructor(
    private api: Api, 
    private toastController: ToastController,
    private navCtrl: NavController
  ) { }

  async registrarse() {
    if(!this.usuario.nombre || !this.usuario.email || !this.usuario.password) {
      this.mostrarMensaje('Por favor llena todos los campos');
      return;
    }

    this.api.registrarUsuario(this.usuario).subscribe((res: any) => {
      if(res.success) {
        this.mostrarMensaje('Registro exitoso. Ahora inicia sesión.');
        this.navCtrl.navigateBack('/login');
      } else {
        this.mostrarMensaje(res.mensaje);
      }
    }, error => {
      this.mostrarMensaje('Error de conexión');
    });
  }

  async mostrarMensaje(mensaje: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2000
    });
    toast.present();
  }
}