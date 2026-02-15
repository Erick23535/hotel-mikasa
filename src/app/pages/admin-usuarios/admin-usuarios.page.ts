import { Component } from '@angular/core';
import { Api } from 'src/app/services/api';

@Component({
  selector: 'app-admin-usuarios',
  templateUrl: './admin-usuarios.page.html',
  styleUrls: ['./admin-usuarios.page.scss'],
  standalone: false
})
export class AdminUsuariosPage {
  users: any[] = [];
  q = '';
  adminKey = 'MIKASA_ADMIN_2026';

  isLoading = false;
  isSavingId: number | null = null;

  toastOpen = false;
  toastMsg = '';

  constructor(private api: Api) {}

  ionViewWillEnter() {
    // opcional: podrías cargar automáticamente si ya tienes key guardada
    // this.loadUsers();
  }

  // ✅ FIX: Angular template NO reconoce Number() global.
  // Usamos un helper del componente.
  toNum(v: any): number {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? '0'), 10);
    return isNaN(n) ? 0 : n;
  }

  private toast(m: string) {
    this.toastMsg = m;
    this.toastOpen = true;
  }

  loadUsers() {
    const key = (this.adminKey || '').trim();
    if (!key) return this.toast('Ingresa la Admin Key');

    this.isLoading = true;

    this.api.adminListUsers(key).subscribe({
      next: (r: any) => {
        this.isLoading = false;
        if (!r?.success) return this.toast(r?.mensaje || 'Error al cargar');
        this.users = r.data || [];
        this.toast('Usuarios cargados');
      },
      error: (e: any) => {
        this.isLoading = false;
        this.toast(e?.error?.mensaje || 'No autorizado o API caída');
      }
    });
  }

  filteredUsers() {
    const t = (this.q || '').trim().toLowerCase();
    if (!t) return this.users;

    return this.users.filter(u =>
      String(u?.nombre || '').toLowerCase().includes(t) ||
      String(u?.email || '').toLowerCase().includes(t)
    );
  }

  saveRole(u: any) {
    const key = (this.adminKey || '').trim();
    const id = this.toNum(u?.id);
    const rol = String(u?.rol || '').trim();

    if (!key) return this.toast('Ingresa la Admin Key');
    if (!id) return this.toast('Usuario inválido');
    if (!rol) return this.toast('Rol inválido');

    this.isSavingId = id;

    this.api.adminUpdateRole(key, id, rol).subscribe({
      next: (r: any) => {
        this.isSavingId = null;
        this.toast(r?.mensaje || 'Rol actualizado');
      },
      error: (e: any) => {
        this.isSavingId = null;
        this.toast(e?.error?.mensaje || 'No se pudo guardar');
      }
    });
  }
}
