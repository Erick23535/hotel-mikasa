import { Component, ViewChild } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';
import { HotelAssistantService } from 'src/app/services/hotel-assistant.service';
import { Preferences } from '@capacitor/preferences';
import { NavController } from '@ionic/angular';

type UiMsg = { role: 'user' | 'assistant'; text: string; at: string };

@Component({
  selector: 'app-assistant-chat',
  templateUrl: './assistant-chat.page.html',
  styleUrls: ['./assistant-chat.page.scss'],
  standalone: false
})
export class AssistantChatPage {
  @ViewChild(IonContent) content!: IonContent;

  inputText = '';
  sending = false;

  messages: UiMsg[] = [];
  private readonly CHAT_KEY = 'mikasa_ai_chat_history_v1';

  quickActions = [
    { label: '¿Qué hace la app?', text: '¿Qué hace la app?' },
    { label: 'Promo', text: '¿Hay promo activa?' },
    { label: 'Mis reservas', text: 'Mis reservas' },
    { label: 'Favoritos', text: 'Mis favoritos' },
    { label: 'Disponibilidad', text: 'Buscar disponibilidad del 2 al 5 para 2 adultos' },
  ];

  constructor(
    private assistant: HotelAssistantService,
    private toast: ToastController, private nav: NavController
  ) {}

  async ionViewWillEnter() {
    await this.loadHistory();
    this.scrollBottom(0);
  }

  private now() { return new Date().toISOString(); }

  async send(text?: string) {
    const msg = (text ?? this.inputText ?? '').trim();
    if (!msg || this.sending) return;

    this.sending = true;

    // pinta inmediato el user en UI
    const u: UiMsg = { role: 'user', text: msg, at: this.now() };
    this.messages.push(u);
    this.inputText = '';
    await this.saveHistory();
    this.scrollBottom(80);

    try {
      const msgs = await this.assistant.send(msg);
      // assistant.send ya devuelve (user+assistant) pero nosotros ya pintamos el user,
      // así que solo agregamos los assistant.
      const onlyAssistant = (msgs || []).filter(m => m.role === 'assistant')
        .map(m => ({ role: 'assistant', text: m.text, at: m.at })) as UiMsg[];

      this.messages.push(...onlyAssistant);
      await this.saveHistory();
      this.scrollBottom(120);
    } catch (e: any) {
      await this.showToast(e?.message || 'No se pudo procesar el mensaje');
    } finally {
      this.sending = false;
    }
  }

  async tapQuick(q: any) {
    await this.send(q?.text);
  }

  async clearChat() {
    this.messages = [];
    await Preferences.remove({ key: this.CHAT_KEY });
    await this.showToast('Chat limpiado');
  }

  // -----------------------
  // Persistencia simple
  // -----------------------
  private async loadHistory() {
    try {
      const r = await Preferences.get({ key: this.CHAT_KEY });
      this.messages = r?.value ? JSON.parse(r.value) : [];
      if (!Array.isArray(this.messages)) this.messages = [];
      // limita tamaño
      if (this.messages.length > 200) this.messages = this.messages.slice(-200);
    } catch {
      this.messages = [];
    }
  }

  private async saveHistory() {
    try {
      const list = (this.messages || []).slice(-200);
      await Preferences.set({ key: this.CHAT_KEY, value: JSON.stringify(list) });
    } catch {}
  }

  private async showToast(msj: string) {
    const t = await this.toast.create({ message: msj, duration: 1800, position: 'bottom' });
    t.present();
  }
shouldShowDayDivider(m: any, i: number): boolean {
  if (!m?.at) return false;
  if (i === 0) return true;
  const prev = this.messages[i - 1];
  if (!prev?.at) return true;

  const d1 = new Date(m.at);
  const d0 = new Date(prev.at);

  return d1.toDateString() !== d0.toDateString();
}
salir() {
  this.nav.back();
}

  private async scrollBottom(delayMs = 60) {
    try {
      await new Promise(r => setTimeout(r, delayMs));
      this.content?.scrollToBottom(250);
    } catch {}
  }
}
