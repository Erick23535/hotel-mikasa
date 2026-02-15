import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

async function preloadPdfMake(): Promise<void> {
  const g: any = globalThis as any;

  // Si ya está listo, no hagas nada
  if (g.pdfMake?.createPdf && g.pdfMake?.vfs) return;

  // ✅ Carga dinámica (evita tree-shaking / problemas de empaquetado)
  const pmMod: any = await import('pdfmake/build/pdfmake');
  const fontsMod: any = await import('pdfmake/build/vfs_fonts');

  const pmAny: any = pmMod?.default ?? pmMod;
  const pdfMake: any = pmAny?.pdfMake ?? pmAny;

  const fontsAny: any = fontsMod?.default ?? fontsMod;

  // vfs puede venir en varias formas según bundler/versión
  const vfs: any =
    fontsAny?.pdfMake?.vfs ||
    fontsAny?.vfs ||
    (fontsAny && fontsAny['Roboto-Regular.ttf'] ? fontsAny : null) ||
    g?.pdfMake?.vfs;

  if (!pdfMake?.createPdf) {
    throw new Error('pdfMake no cargó correctamente (createPdf missing)');
  }
  if (!vfs) {
    throw new Error('vfs_fonts no cargó (vfs undefined)');
  }

  pdfMake.vfs = vfs;
  pdfMake.fonts = pdfMake.fonts || {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  };
  pdfMake.disableWorker = true;

  // ✅ Deja listo en global
  g.pdfMake = pdfMake;
}

// ✅ IMPORTANTÍSIMO: bootstrap DESPUÉS del preload
preloadPdfMake()
  .catch((err) => console.error('PDFMAKE preload error:', err))
  .finally(() => {
    platformBrowserDynamic()
      .bootstrapModule(AppModule)
      .catch((err) => console.log(err));
  });
