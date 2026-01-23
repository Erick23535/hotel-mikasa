import { Component } from '@angular/core';
import { Api } from 'src/app/services/api';
import { NavController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthGateService } from 'src/app/services/auth-gate.service';

import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

@Component({
  selector: 'app-mis-reservas',
  templateUrl: './mis-reservas.page.html',
  styleUrls: ['./mis-reservas.page.scss'],
  standalone: false
})
export class MisReservasPage {

  reservas: any[] = [];
  usuario: any;

  // ✅ Loading + Pull-to-refresh
  loading: boolean = false;

  mostrarModalQR: boolean = false;
  reservaSeleccionadaQR: any = null;
  qrImage: string = '';

  // ✅ Filtro Booking/Airbnb (solo UI)
  filtroEstado: 'todas' | 'pendiente' | 'confirmada' = 'todas';

  constructor(
    private api: Api,
    private navCtrl: NavController,
    private toast: ToastController,
    private router: Router,
    private authGate: AuthGateService
  ) {
    const fontModule: any = pdfFonts;
    try {
      if (fontModule.pdfMake && fontModule.pdfMake.vfs) {
        (pdfMake as any).vfs = fontModule.pdfMake.vfs;
      } else if (fontModule.default && fontModule.default.pdfMake && fontModule.default.pdfMake.vfs) {
        (pdfMake as any).vfs = fontModule.default.pdfMake.vfs;
      } else if (fontModule["Roboto-Regular.ttf"]) {
        (pdfMake as any).vfs = fontModule;
      } else {
        console.error("Aún no encuentro las fuentes PDF.", fontModule);
      }
    } catch (e) {
      console.error("Error asignando fuentes:", e);
    }
  }

  // ----------------------------
  // Helpers (estado + fechas)
  // ----------------------------
  private normalizarEstado(r: any): string {
    return (r?.estado ?? '').toString().trim().toLowerCase();
  }

  private parseFechaToMs(raw: any): number {
    try {
      if (!raw) return 0;
      const s = raw.toString().trim();

      // YYYY-MM-DD o YYYY-MM-DD HH:mm:ss
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s.replace(' ', 'T'));
        const ms = d.getTime();
        return isNaN(ms) ? 0 : ms;
      }

      // dd/mm/yyyy
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split('/');
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        const ms = d.getTime();
        return isNaN(ms) ? 0 : ms;
      }

      // Fallback
      const d = new Date(s);
      const ms = d.getTime();
      return isNaN(ms) ? 0 : ms;
    } catch {
      return 0;
    }
  }

  private ordenarReservas(arr: any[]): any[] {
    const list = Array.isArray(arr) ? [...arr] : [];
    // ✅ Más recientes primero por fecha_checkin (fallback: id)
    list.sort((a: any, b: any) => {
      const fa = this.parseFechaToMs(a?.fecha_checkin);
      const fb = this.parseFechaToMs(b?.fecha_checkin);
      if (fb !== fa) return fb - fa;
      const ida = Number(a?.id || 0);
      const idb = Number(b?.id || 0);
      return idb - ida;
    });
    return list;
  }

  // ----------------------------
  // Computed (chips)
  // ----------------------------
  get countPendientes(): number {
    return (this.reservas || []).filter((r: any) => this.normalizarEstado(r) === 'pendiente').length;
  }

  get countConfirmadas(): number {
    return (this.reservas || []).filter((r: any) => this.normalizarEstado(r) === 'confirmada').length;
  }

  get reservasFiltradas(): any[] {
    const arr = (this.reservas || []);
    if (this.filtroEstado === 'todas') return arr;
    return arr.filter((r: any) => this.normalizarEstado(r) === this.filtroEstado);
  }

  setFiltroEstado(v: 'todas' | 'pendiente' | 'confirmada') {
    this.filtroEstado = v;
    // opcional pro: scroll suave
    try {
      const content: any = document.querySelector('ion-content');
      content?.scrollToTop?.(250);
    } catch { /* no-op */ }
  }

  // ----------------------------
  // Lifecycle
  // ----------------------------
  ionViewWillEnter() {
    const userJson = localStorage.getItem('usuario');
    if (userJson) {
      this.usuario = JSON.parse(userJson);
      this.cargarReservas(this.usuario.id, true);
    } else {
      this.authGate.requireLogin(this.router, '/mis-reservas');
      return;
    }
  }

  // ----------------------------
  // Loading + Refresh
  // showLoading=true => muestra skeleton si lista vacía
  // ----------------------------
  cargarReservas(id: any, showLoading: boolean = true): Promise<void> {
    if (showLoading) this.loading = true;

    return new Promise((resolve) => {
      this.api.getReservasUsuario(id).subscribe({
        next: (res: any) => {
          const list = Array.isArray(res) ? res : (res?.data ?? []);
          this.reservas = this.ordenarReservas(list);
          if (showLoading) this.loading = false;
          resolve();
        },
        error: (err: any) => {
          console.error("Error cargando reservas:", err);
          if (showLoading) this.loading = false;
          this.mostrarMensaje("No se pudo cargar tus reservas.");
          resolve();
        }
      });
    });
  }

  async handleRefresh(ev: any) {
    try {
      if (this.usuario?.id) {
        await this.cargarReservas(this.usuario.id, false);
      }
    } finally {
      try { ev?.target?.complete?.(); } catch { /* no-op */ }
    }
  }

  // ----------------------------
  // Navegación
  // ----------------------------
  volver() {
    this.navCtrl.navigateBack('/home');
  }

  // ----------------------------
  // Pase QR
  // ----------------------------
  abrirPase(reserva: any) {
    this.reservaSeleccionadaQR = reserva;

    const data = `HOTEL-MIKASA|R:${reserva.id}|H:${reserva.habitacion || reserva.tipo}|U:${this.usuario?.nombre || ''}`;
    this.qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}&color=000000&bgcolor=ffffff`;

    this.mostrarModalQR = true;
  }

  cerrarPase() {
    this.mostrarModalQR = false;
    this.reservaSeleccionadaQR = null;
  }

  // ----------------------------
  // Subir comprobante
  // ----------------------------
  abrirSelector(idReserva: any) {
    document.getElementById('file-' + idReserva)?.click();
  }

  seleccionarArchivo(event: any, idReserva: any) {
    const archivo = event.target.files?.[0];
    if (archivo) this.subirFoto(idReserva, archivo);
  }

  subirFoto(id: any, archivo: File) {
    this.mostrarMensaje("Subiendo comprobante...");
    this.api.subirComprobante(id, archivo).subscribe((res: any) => {
      if (res?.success) {
        this.mostrarMensaje("¡Comprobante enviado!");
        // refresco sin skeleton (pro)
        this.cargarReservas(this.usuario.id, false);
      } else {
        this.mostrarMensaje("Error: " + (res?.mensaje || 'No se pudo subir'));
      }
    });
  }

  // ----------------------------
  // PDF PREMIUM (pdfMake)
  // ----------------------------
  private money(n: any): string {
    const v = Number(n ?? 0);
    if (isNaN(v)) return '$0.00';
    return `$${v.toFixed(2)}`;
  }

  private formatEmitido(): string {
    try {
      const d = new Date();
      return d.toLocaleString('es-EC', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    } catch {
      return new Date().toLocaleString();
    }
  }

  generarPDF(r: any) {
    if (!(pdfMake as any).vfs) {
      alert("Error: Las fuentes no se cargaron correctamente. Recarga la página.");
      return;
    }

    const fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };

    const estadoNorm = this.normalizarEstado(r);
    const estadoLabel = (estadoNorm || 'pendiente').toUpperCase();

    const estadoColor =
      estadoNorm === 'confirmada' ? '#16a34a' :
      estadoNorm === 'pendiente' ? '#f59e0b' :
      '#ef4444';

    const qrData = `HOTEL-MIKASA|R:${r?.id}|H:${r?.habitacion || r?.tipo}|U:${this.usuario?.nombre || ''}`;

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [40, 70, 40, 60],

      background: (currentPage: number, pageSize: any) => {
        return {
          canvas: [
            { type: 'rect', x: 0, y: 0, w: pageSize.width, h: 135, color: '#0b1220' },
            { type: 'rect', x: 0, y: 135, w: pageSize.width, h: pageSize.height - 135, color: '#ffffff' }
          ]
        };
      },

      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'HOTEL MI KASA', style: 'brand' },
                { text: 'Comprobante de Reserva', style: 'title' },
                { text: 'Puyo, Pastaza - Ecuador', style: 'subtleWhite' }
              ]
            },
            {
              width: 190,
              alignment: 'right',
              stack: [
                { text: `Reserva #${r?.id}`, style: 'metaWhite' },
                { text: `Emitido: ${this.formatEmitido()}`, style: 'metaWhite' }
              ]
            }
          ],
          margin: [0, 0, 0, 14]
        },

        // Card de datos
        {
          table: {
            widths: ['*', '*'],
            body: [
              [{ text: 'Huéspedes', style: 'cellLabel' }, { text: `${r?.adultos ?? 1} Adultos, ${r?.ninos ?? 0} Niños`, style: 'cellValue' }],

              [{ text: 'Huésped', style: 'cellLabel' }, { text: (this.usuario?.nombre || '—'), style: 'cellValue' }],
              [{ text: 'Correo', style: 'cellLabel' }, { text: (this.usuario?.email || '—'), style: 'cellValue' }],
              [{ text: 'Habitación', style: 'cellLabel' }, { text: (r?.tipo || r?.habitacion || '—'), style: 'cellValue' }],
              [{ text: 'Check-in', style: 'cellLabel' }, { text: (r?.fecha_checkin || '—'), style: 'cellValue' }],
              [{ text: 'Check-out', style: 'cellLabel' }, { text: (r?.fecha_checkout || '—'), style: 'cellValue' }],
              [
                { text: 'Estado', style: 'cellLabel' },
                { text: estadoLabel, style: 'cellValue', color: estadoColor, bold: true }
              ],
              [
                { text: 'Total', style: 'cellLabel' },
                { text: this.money(r?.total), style: 'totalValue' }
              ],
            ]
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex % 2 === 0 ? '#F6F8FB' : null),
            hLineColor: () => '#E6EAF2',
            vLineColor: () => '#E6EAF2',
            paddingLeft: () => 10,
            paddingRight: () => 10,
            paddingTop: () => 8,
            paddingBottom: () => 8
          },
          margin: [0, 0, 0, 18]
        },

        // QR + instrucciones
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Pase digital (QR)', style: 'secTitle' },
                {
                  text: 'Presenta este código en recepción para agilizar tu ingreso. Este comprobante es válido únicamente para la reserva indicada.',
                  style: 'p'
                },
                {
                  text: 'Soporte: +593 • contacto@hotelmikasa.com',
                  style: 'smallMuted',
                  margin: [0, 10, 0, 0]
                }
              ]
            },
            {
              width: 170,
              stack: [
                { qr: qrData, fit: 135, alignment: 'center', margin: [0, 0, 0, 6] },
                { text: 'Validación segura', style: 'smallCenter' },
              ]
            }
          ],
          columnGap: 14
        },

        // Footer
        {
          text: 'Gracias por elegir Hotel Mi Kasa • Documento generado automáticamente',
          style: 'footer',
          margin: [0, 18, 0, 0]
        }
      ],

      styles: {
        brand: { fontSize: 18, bold: true, color: '#ffffff', letterSpacing: -0.3 },
        title: { fontSize: 13, bold: true, color: 'rgba(255,255,255,0.92)', margin: [0, 4, 0, 0] },
        subtleWhite: { fontSize: 9.5, color: 'rgba(255,255,255,0.75)', margin: [0, 6, 0, 0] },
        metaWhite: { fontSize: 9.5, color: 'rgba(255,255,255,0.78)' },

        cellLabel: { fontSize: 10, color: '#475569', bold: true },
        cellValue: { fontSize: 10.5, color: '#0f172a' },
        totalValue: { fontSize: 12.5, bold: true, color: '#0b1220' },

        secTitle: { fontSize: 12, bold: true, color: '#0b1220', margin: [0, 2, 0, 6] },
        p: { fontSize: 10.2, color: '#334155', lineHeight: 1.2 },
        smallMuted: { fontSize: 9, color: '#64748b' },
        smallCenter: { fontSize: 9, color: '#64748b', alignment: 'center' },

        footer: { fontSize: 9, color: '#94a3b8', alignment: 'center' }
      },

      defaultStyle: { font: 'Roboto' }
    };

    try {
      this.mostrarMensaje("Generando PDF...");
      pdfMake.createPdf(docDefinition, undefined, fonts).download(`Reserva_${r?.id}.pdf`);
    } catch (err: any) {
      console.error("Error PDF:", err);
      alert("Error al generar PDF: " + (err?.message || err));
    }
  }

  async mostrarMensaje(msj: string) {
    const t = await this.toast.create({ message: msj, duration: 2000 });
    t.present();
  }
}
