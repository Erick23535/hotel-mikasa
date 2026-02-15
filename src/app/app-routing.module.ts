import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
 
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'registro',
    loadChildren: () => import('./pages/registro/registro.module').then( m => m.RegistroPageModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./pages/home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'detalle-habitacion',
    loadChildren: () => import('./pages/detalle-habitacion/detalle-habitacion.module').then( m => m.DetalleHabitacionPageModule)
  },
  {
    path: 'mis-reservas',
    loadChildren: () => import('./pages/mis-reservas/mis-reservas.module').then( m => m.MisReservasPageModule)
  },
  {
    path: 'admin-panel',
    loadChildren: () => import('./pages/admin-panel/admin-panel.module').then( m => m.AdminPanelPageModule)
  },
  {
    path: 'perfil',
    loadChildren: () => import('./pages/perfil/perfil.module').then( m => m.PerfilPageModule)
  },
  {
    path: 'favoritos',
    loadChildren: () => import('./favoritos/favoritos.module').then( m => m.FavoritosPageModule)
  },
  {
    path: 'factura-checkout',
    loadChildren: () => import('./pages/factura-checkout/factura-checkout.module').then( m => m.FacturaCheckoutPageModule)
  },
  {
    path: 'assistant-chat',
    loadChildren: () => import('./pages/assistant-chat/assistant-chat.module').then( m => m.AssistantChatPageModule)
  },
  {
    path: 'assistant-faq-admin',
    loadChildren: () => import('./pages/assistant-faq-admin/assistant-faq-admin.module').then( m => m.AssistantFaqAdminPageModule)
  },
  {
    path: 'admin-usuarios',
    loadChildren: () => import('./pages/admin-usuarios/admin-usuarios.module').then( m => m.AdminUsuariosPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
