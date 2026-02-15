import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from 'src/app/services/api';
import { ToastController, AlertController } from '@ionic/angular';
import { FacturacionPdfService } from 'src/app/services/facturacion-pdf.service';
import { firstValueFrom, of } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-factura-checkout',
  templateUrl: './factura-checkout.page.html',
  styleUrls: ['./factura-checkout.page.scss'],
  standalone: false
})
export class FacturaCheckoutPage implements OnInit {

  reservaId: number = 0;
  reserva: any = null;

  empresa = {
    nombre: 'Hotel Mi Kasa',
    ruc: '',
    direccion: '',
    telefono: '',
    email: ''
  };

  numeroFactura = '';
  ivaPct = 0;
  observaciones = 'Gracias por hospedarse con nosotros.';

  pdfGenerado = false;
  facturaUrl: string | null = null;

  loading = false;

  constructor(
    private router: Router,
    private api: Api,
    private toast: ToastController,
    private alertCtrl: AlertController,
    private pdf: FacturacionPdfService
  ) {
    const st = this.router.getCurrentNavigation()?.extras?.state ?? (history.state || {});
    this.reservaId = Number(st?.reservaId || 0);
    this.reserva = st?.reserva || null;
  }

  ngOnInit() {
    if (!this.reservaId) {
      this.router.navigate(['/admin-panel'], { state: { seccion: 'recepcion' } });
      return;
    }

    // cargar datos empresa (si quieres guardarlo en localStorage)
    const raw = localStorage.getItem('mikasa_empresa');
    if (raw) {
      try { this.empresa = { ...this.empresa, ...JSON.parse(raw) }; } catch {}
    }

    this.numeroFactura = this.pdf.buildNumeroFactura(this.reservaId);

    // si no vino snapshot completo, lo pedimos al backend
    if (!this.reserva || !this.reserva.total) {
      this.api.buscarReservaPorID(this.reservaId).subscribe((res: any) => {
        if (res?.success) this.reserva = res.data;
      });
    }
  }

  guardarEmpresaLocal() {
    try { localStorage.setItem('mikasa_empresa', JSON.stringify(this.empresa)); } catch {}
    this.mostrarToast('Datos del hotel guardados');
  }
irRecepcion() {
  this.router.navigate(['/admin-panel'], { state: { seccion: 'recepcion' } });
}

 async generarPdf() {
  if (!this.reserva || this.loading) return;

  this.loading = true;

  // ✅ deja pintar el spinner antes de generar (evita “se congeló” visualmente)
  await new Promise(r => setTimeout(r, 50));

  try {
    const base64 = await this.pdf.generarFacturaBase64({
      empresa: this.empresa,
      reserva: this.reserva,
      numeroFactura: this.numeroFactura,
      ivaPct: this.ivaPct,
      observaciones: this.observaciones
    });

    const fileName = `FACTURA_${this.numeroFactura}.pdf`;

    // ✅ si guardar en dispositivo falla, NO bloquea el flujo
    try {
      await this.pdf.guardarEnDispositivo(base64, fileName);
    } catch (e) {
      console.warn('guardarEnDispositivo falló (no fatal)', e);
    }

    // ✅ subir al servidor (opcional)
    const up = await firstValueFrom(
      this.api.subirFacturaReserva(this.reserva.id, base64, fileName).pipe(
        timeout(20000),
        catchError(err => {
          console.error('upload factura error', err);
          return of(null);
        })
      )
    );

    if (up?.success && up?.url) this.facturaUrl = up.url;

    // ✅ IMPORTANTÍSIMO: aunque upload falle, ya hay PDF generado
    this.pdfGenerado = true;
    this.mostrarToast('Factura PDF generada ✅');

  } catch (e) {
    console.error('generarPdf error', e);
    this.mostrarToast((e as any)?.message || 'No se pudo generar la factura');
  } finally {
    this.loading = false;
  }
}


  async confirmarCheckout() {
    if (!this.reservaId) return;

    if (!this.pdfGenerado) {
      this.mostrarToast('Primero genera la factura');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmar salida',
      message: 'Se realizará el Check-out y se finalizará la reserva.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: () => this.hacerCheckout()
        }
      ]
    });
    await alert.present();
  }
private hacerCheckout() {
  this.loading = true;

  this.api.procesarRecepcion(this.reservaId, 'checkout', this.facturaUrl).pipe(
    timeout(20000),
    catchError(err => {
      console.error('checkout error', err);
      this.mostrarToast('Error de red / servidor al finalizar');
      return of({ success: false, mensaje: 'Error de conexión' });
    }),
    finalize(() => {
      this.loading = false;
    })
  ).subscribe((res: any) => {
    if (res?.success) {
      this.mostrarAlerta('Listo ✅', 'Check-out finalizado y factura registrada.');
      this.router.navigate(['/admin-panel'], { state: { seccion: 'recepcion' } });
    } else {
      this.mostrarToast(res?.mensaje || 'No se pudo finalizar');
    }
  });
}

  async mostrarToast(msj: string) {
    const t = await this.toast.create({ message: msj, duration: 2000, position: 'bottom' });
    t.present();
  }

  async mostrarAlerta(titulo: string, mensaje: string) {
    const a = await this.alertCtrl.create({ header: titulo, message: mensaje, buttons: ['OK'] });
    a.present();
  }
}
