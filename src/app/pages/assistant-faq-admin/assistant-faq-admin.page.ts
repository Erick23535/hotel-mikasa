import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { HotelFaqService } from 'src/app/services/hotel-faq.service';

@Component({
  selector: 'app-assistant-faq-admin',
  templateUrl: './assistant-faq-admin.page.html',
  styleUrls: ['./assistant-faq-admin.page.scss'],
  standalone: false
})
export class AssistantFaqAdminPage {
  q = '';
  a = '';
  custom: any[] = [];
  loading = false;

  constructor(private faq: HotelFaqService, private toast: ToastController) {}

  async ionViewWillEnter() {
    await this.reload();
  }

  async reload() {
    this.loading = true;
    try {
      this.custom = await this.faq.listCustom();
    } finally {
      this.loading = false;
    }
  }

  async add() {
    const nq = this.q.trim();
    const na = this.a.trim();
    if (!nq || !na) {
      return this.show('Escribe pregunta y respuesta');
    }
    await this.faq.addCustomQA(nq, na);
    this.q = '';
    this.a = '';
    await this.reload();
    this.show('Q/A guardado ✅');
  }

  async del(i: number) {
    await this.faq.removeCustomByIndex(i);
    await this.reload();
    this.show('Eliminado');
  }

  async resetAll() {
    await this.faq.resetCustom();
    await this.reload();
    this.show('Entrenamiento local reiniciado');
  }

  private async show(msj: string) {
    const t = await this.toast.create({ message: msj, duration: 1700, position: 'bottom' });
    t.present();
  }
}
