import { Injectable } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toDataURL } from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

@Injectable({ providedIn: 'root' })
export class FacturacionPdfService {

  buildNumeroFactura(reservaId: number) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `MIK-${y}${m}${da}-${hh}${mm}-R${reservaId}`;
  }

  private money(n: any): string {
    const v = Number(n || 0);
    return Number.isFinite(v) ? v.toFixed(2) : '0.00';
  }

  private base64ToUint8(b64: string): Uint8Array {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const sub = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode(...Array.from(sub));
    }
    return btoa(binary);
  }

  private safeText(v: any): string {
    return (v === null || v === undefined) ? '' : String(v);
  }

  private parseDate(s: any): Date {
    if (!s) return new Date();
    const d1 = new Date(s);
    if (!isNaN(d1.getTime())) return d1;
    if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00');
    return new Date();
  }

  private wrapLines(text: string, maxLen: number): string[] {
    const t = (text || '').trim();
    if (!t) return [''];
    const words = t.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (next.length > maxLen) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  async generarFacturaBase64(params: {
    empresa: any;
    reserva: any;
    numeroFactura: string;
    ivaPct?: number;
    observaciones?: string;
  }): Promise<string> {
    const { empresa, reserva, numeroFactura } = params;
    const ivaPct = Number(params.ivaPct ?? 0);

    const checkin = this.parseDate(reserva?.fecha_checkin);
    const checkout = this.parseDate(reserva?.fecha_checkout);
    const rawDiff = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));
    const nights = Number.isFinite(rawDiff) && rawDiff > 0 ? rawDiff : 1;

    const subtotal = Number(reserva?.total || 0);
    const iva = subtotal * (ivaPct / 100);
    const total = subtotal + iva;

    // QR
    const qrDataUrl = await toDataURL(`RESERVA:${reserva?.id}|FACTURA:${numeroFactura}`);
    const qrB64 = qrDataUrl.includes(',') ? qrDataUrl.split(',')[1] : qrDataUrl;
    const qrBytes = this.base64ToUint8(qrB64);

    // PDF (A4)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // 🎨 Colores (1:1 pdfMake)
    const blue = rgb(0.043, 0.369, 0.843);                       // #0b5ed7
    const footerGray = rgb(107 / 255, 114 / 255, 128 / 255);     // #6b7280
    const dark = rgb(17 / 255, 24 / 255, 39 / 255);              // #111827
    const textGray = rgb(55 / 255, 65 / 255, 81 / 255);          // #374151
    const lightLine = rgb(229 / 255, 231 / 255, 235 / 255);      // #e5e7eb
    const softBg = rgb(243 / 255, 244 / 255, 246 / 255);         // #f3f4f6
    const white = rgb(1, 1, 1);

    // 📐 Márgenes estilo pdfMake: [36, 30, 36, 40]
    const M = 36;
    const TOP = 30;
    const BOTTOM = 40;
    const FOOTER_Y = 16;

    let y = height - TOP;

    // Header bar
    const headerH = 52;
    page.drawRectangle({ x: M, y: y - headerH, width: width - M * 2, height: headerH, color: blue });
    page.drawText(this.safeText(empresa?.nombre || 'HOTEL MI KASA'), {
      x: M + 14, y: y - 34, size: 18, font: fontBold, color: white,
    });
    page.drawText('FACTURA', {
      x: width - M - 14 - fontBold.widthOfTextAtSize('FACTURA', 18),
      y: y - 34, size: 18, font: fontBold, color: white,
    });

    y -= (headerH + 18);

    const leftX = M;
    const blockW = width - M * 2;

    const h2 = (t: string) => {
      page.drawText(t, { x: leftX, y, size: 11, font: fontBold, color: dark });
      y -= 16;
    };

    const p = (t: string) => {
      page.drawText(t, { x: leftX, y, size: 10, font, color: textGray });
      y -= 14;
    };

    // Caja derecha (factura info)
    const boxW = 220;
    const boxH = 60;
    const boxX = width - M - boxW;
    const boxY = y + 14 - boxH;
    page.drawRectangle({ x: boxX, y: boxY, width: boxW, height: boxH, color: softBg });

    const nowStr = new Date().toLocaleString();
    let iy = boxY + 40;
    page.drawText(`N° Factura: ${numeroFactura}`, { x: boxX + 12, y: iy, size: 11, font: fontBold, color: dark }); iy -= 14;
    page.drawText(`Fecha: ${nowStr}`, { x: boxX + 12, y: iy, size: 10, font, color: dark }); iy -= 14;
    page.drawText(`Reserva: #${this.safeText(reserva?.id)}`, { x: boxX + 12, y: iy, size: 10, font, color: dark });

    // Establecimiento
    h2('Datos del Establecimiento');
    p(empresa?.ruc ? `RUC: ${empresa.ruc}` : 'RUC: (no configurado)');
    p(empresa?.direccion ? `Dirección: ${empresa.direccion}` : 'Dirección: (no configurada)');
    p(empresa?.telefono ? `Tel: ${empresa.telefono}` : 'Tel: (no configurado)');
    p(empresa?.email ? `Email: ${empresa.email}` : 'Email: (no configurado)');

    y -= 6;

    // Cliente / Estancia (dos columnas)
    const colGap = 10;
    const colW = (blockW - colGap) / 2;
    const col1X = M;
    const col2X = M + colW + colGap;

    const miniH = 76;
    const drawMiniBox = (x: number, title: string, lines: string[]) => {
      page.drawRectangle({ x, y: y - miniH + 10, width: colW, height: miniH, borderColor: lightLine, borderWidth: 1 });
      page.drawText(title, { x: x + 12, y: y + 62 - miniH, size: 11, font: fontBold, color: dark });

      let ty = y + 44 - miniH;
      for (const ln of lines) {
        if (!ln) continue;
        page.drawText(ln, { x: x + 12, y: ty, size: 10, font, color: textGray });
        ty -= 14;
      }
    };

    drawMiniBox(col1X, 'Cliente', [
      this.safeText(reserva?.cliente || '—'),
      reserva?.cliente_id ? `ID Cliente: ${reserva.cliente_id}` : '',
    ]);

    drawMiniBox(col2X, 'Estancia', [
      `Habitación ${this.safeText(reserva?.numero)} • ${this.safeText(reserva?.tipo)}`,
      `Check-in: ${this.safeText(reserva?.fecha_checkin)}`,
      `Check-out: ${this.safeText(reserva?.fecha_checkout)} (${nights} noche(s))`,
    ]);

    y -= (miniH + 20);

    // =========================
    // ✅ TABLA 1:1 (pdfMake look)
    // =========================
    page.drawText('Detalle de Servicios', { x: M, y, size: 11, font: fontBold, color: dark });
    y -= 16;

    const tableX = M;
    const tableW = blockW;

    // pdfMake widths: ['*', 70, 70, 80]
    const wCant = 70;
    const wUnit = 70;
    const wImp = 80;
    const wConcepto = Math.max(120, tableW - wCant - wUnit - wImp);
    const colWs = [wConcepto, wCant, wUnit, wImp];

    const rowH = 28;       // más “padding real” (parecido a paddingTop/Bottom 8)
    const padX = 10;       // paddingLeft/Right 10 (pdfMake)
    const fsHead = 10;
    const fsBody = 10;

    const colX = [tableX, tableX + colWs[0], tableX + colWs[0] + colWs[1], tableX + colWs[0] + colWs[1] + colWs[2]];

    const line = (x1: number, y1: number, x2: number, y2: number) => {
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1, color: lightLine });
    };

    const drawCellText = (
      text: string,
      x: number,
      rowTop: number,
      w: number,
      align: 'left' | 'center' | 'right',
      size: number,
      bold: boolean,
      color: any
    ) => {
      const f = bold ? fontBold : font;
      const t = this.safeText(text);
      const tw = f.widthOfTextAtSize(t, size);
      const rowBottom = rowTop - rowH;
      const ty = rowBottom + (rowH - size) / 2 + 2; // centrado visual

      let tx = x + padX;
      if (align === 'center') tx = x + (w - tw) / 2;
      if (align === 'right') tx = x + w - padX - tw;

      page.drawText(t, { x: tx, y: ty, size, font: f, color });
    };

    const drawGridRow = (rowTop: number, withInnerVLines: boolean, isFirstRowTopBorder: boolean) => {
      const rowBottom = rowTop - rowH;

      // fondo header si aplica lo pones afuera (rect)
      if (isFirstRowTopBorder) line(tableX, rowTop, tableX + tableW, rowTop); // top border 1 sola vez

      line(tableX, rowBottom, tableX + tableW, rowBottom); // bottom border de fila
      line(tableX, rowBottom, tableX, rowTop);             // left
      line(tableX + tableW, rowBottom, tableX + tableW, rowTop); // right

      if (withInnerVLines) {
        for (let i = 1; i < colWs.length; i++) {
          const vx = tableX + colWs.slice(0, i).reduce((a, b) => a + b, 0);
          line(vx, rowBottom, vx, rowTop);
        }
      }
    };

    // Header row
    {
      const rowTop = y;
      const rowBottom = y - rowH;

      page.drawRectangle({ x: tableX, y: rowBottom, width: tableW, height: rowH, color: blue });

      drawGridRow(rowTop, true, true);

      drawCellText('Concepto', tableX, rowTop, colWs[0], 'left', fsHead, true, white);
      drawCellText('Cant.', colX[1], rowTop, colWs[1], 'center', fsHead, true, white);
      drawCellText('P. Unit', colX[2], rowTop, colWs[2], 'right', fsHead, true, white);
      drawCellText('Importe', colX[3], rowTop, colWs[3], 'right', fsHead, true, white);

      y -= rowH;
    }

    // Row: Hospedaje
    {
      const rowTop = y;
      drawGridRow(rowTop, true, false);

      drawCellText(`Hospedaje (${nights} noche(s))`, tableX, rowTop, colWs[0], 'left', fsBody, false, dark);
      drawCellText(String(nights), colX[1], rowTop, colWs[1], 'center', fsBody, false, dark);
      drawCellText('—', colX[2], rowTop, colWs[2], 'right', fsBody, false, dark);
      drawCellText(`$ ${this.money(subtotal)}`, colX[3], rowTop, colWs[3], 'right', fsBody, false, dark);

      y -= rowH;
    }

    // Row(s): Extras colSpan=4 (sin líneas verticales internas)
    {
      const extras = this.safeText(reserva?.extras || 'Ninguno');
      const extraLines = this.wrapLines(`Extras: ${extras}`, 70);

      for (const ln of extraLines) {
        const rowTop = y;
        drawGridRow(rowTop, false, false); // ⬅️ SIN divisiones internas (colSpan real)
        drawCellText(ln, tableX, rowTop, tableW, 'left', fsBody, false, textGray);
        y -= rowH;
      }
    }

    y -= 14;

    // =========================
    // ✅ OBS + TOTALES (caja tipo tabla real)
    // =========================
    const obsX = M;
    const totalsW = 230;
    const totalsX = width - M - totalsW;

    const secTop = y;
    page.drawText('Observaciones', { x: obsX, y: secTop, size: 11, font: fontBold, color: dark });
    page.drawText('Totales', { x: totalsX, y: secTop, size: 11, font: fontBold, color: dark });

    const obsStartY = secTop - 16;
    const obs = this.safeText(params.observaciones || 'Gracias por hospedarse con nosotros.');
    const obsLines = this.wrapLines(obs, 58);

    let oy2 = obsStartY;
    for (const ln of obsLines.slice(0, 4)) {
      page.drawText(ln, { x: obsX, y: oy2, size: 10, font, color: textGray });
      oy2 -= 14;
    }

    // Totales como tabla 2 columnas (grid real)
    const totRowH = 26;
    const totPadX = 10;
    const valueColW = 90;
    const labelColW = totalsW - valueColW;

    const totTop = secTop - 16 + 10; // pegadito bajo el título "Totales"
    const totBottom = totTop - totRowH * 3;

    // outer box
    line(totalsX, totTop, totalsX + totalsW, totTop);
    line(totalsX, totBottom, totalsX + totalsW, totBottom);
    line(totalsX, totBottom, totalsX, totTop);
    line(totalsX + totalsW, totBottom, totalsX + totalsW, totTop);

    // vertical divider
    line(totalsX + labelColW, totBottom, totalsX + labelColW, totTop);

    // horizontals
    line(totalsX, totTop - totRowH, totalsX + totalsW, totTop - totRowH);
    line(totalsX, totTop - totRowH * 2, totalsX + totalsW, totTop - totRowH * 2);

    const drawTotText = (rowIndex: number, label: string, value: string, bold: boolean, size: number) => {
      const rowTop = totTop - totRowH * rowIndex;
      const rowBottom = rowTop - totRowH;
      const f = bold ? fontBold : font;

      const ty = rowBottom + (totRowH - size) / 2 + 2;

      // label left
      page.drawText(label, { x: totalsX + totPadX, y: ty, size, font: f, color: dark });

      // value right
      const tw = f.widthOfTextAtSize(value, size);
      page.drawText(value, { x: totalsX + totalsW - totPadX - tw, y: ty, size, font: f, color: dark });
    };

    drawTotText(0, 'Subtotal', `$ ${this.money(subtotal)}`, false, 10);
    drawTotText(1, `IVA (${ivaPct}%)`, `$ ${this.money(iva)}`, false, 10);
    drawTotText(2, 'TOTAL', `$ ${this.money(total)}`, true, 12);

    // QR (abajo derecha, encima del footer)
    const qrImg = await pdfDoc.embedPng(qrBytes);
    const qrSize = 110;
    page.drawImage(qrImg, {
      x: width - M - qrSize,
      y: BOTTOM + 20,
      width: qrSize,
      height: qrSize
    });

    // ✅ FOOTER COMPLETO: izquierda + Página X de Y
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    pages.forEach((pg, idx) => {
      const w = pg.getWidth();
      const leftText = 'Hotel Mi Kasa • Documento generado por el sistema';
      const rightText = `Página ${idx + 1} de ${totalPages}`;

      pg.drawText(leftText, { x: M, y: FOOTER_Y, size: 9, font, color: footerGray });

      const rightX = w - M - font.widthOfTextAtSize(rightText, 9);
      pg.drawText(rightText, { x: rightX, y: FOOTER_Y, size: 9, font, color: footerGray });
    });

    const pdfBytes = await pdfDoc.save();
    return this.uint8ToBase64(pdfBytes);
  }

  private async ensureFacturasDir() {
    try {
      await Filesystem.mkdir({
        path: 'facturas',
        directory: Directory.Documents,
        recursive: true
      });
    } catch {}
  }

  async guardarEnDispositivo(base64: string, fileName: string) {
    await this.ensureFacturasDir();
    const path = `facturas/${fileName}`;
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Documents
    });
    return path;
  }
}
