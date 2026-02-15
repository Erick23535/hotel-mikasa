import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { firstValueFrom } from 'rxjs';

type FaqItem = { q: string; a: string; tags?: string[] };

@Injectable({ providedIn: 'root' })
export class HotelFaqService {
  private readonly CUSTOM_KEY = 'mikasa_faq_custom_v1';
  private base: FaqItem[] = [];
  private custom: FaqItem[] = [];
  private loaded = false;

  private STOP = new Set(['de','la','el','los','las','un','una','para','por','hola','buenas','buenos','gracias','porfa','ok','que','como','cual','cuanto']);

  constructor(private http: HttpClient) {}

  // --------- Load ----------
  async ensureLoaded() {
    if (this.loaded) return;

    try {
      this.base = await firstValueFrom(this.http.get<FaqItem[]>('assets/faq.json'));
      if (!Array.isArray(this.base)) this.base = [];
    } catch {
      this.base = [];
    }

    try {
      const r = await Preferences.get({ key: this.CUSTOM_KEY });
      this.custom = r?.value ? JSON.parse(r.value) : [];
      if (!Array.isArray(this.custom)) this.custom = [];
    } catch {
      this.custom = [];
    }

    this.loaded = true;
  }

  private async saveCustom() {
    try {
      const list = (this.custom || []).slice(-300);
      await Preferences.set({ key: this.CUSTOM_KEY, value: JSON.stringify(list) });
    } catch {}
  }

  // --------- Public API ----------
  async tryAnswer(userText: string): Promise<{ ok: boolean; answer?: string; score?: number; matched?: string }> {
    await this.ensureLoaded();

    const text = this.norm(userText);
    if (!text) return { ok: false };

    const all = [...this.custom, ...this.base]; // custom primero (entrenado manda)
    let best: { item: FaqItem; score: number } | null = null;

    for (const it of all) {
      const s = this.score(it.q, userText, it.tags);
      if (!best || s > best.score) best = { item: it, score: s };
    }

    // umbral recomendado (ajustable)
    if (best && best.score >= 0.72) {
      return { ok: true, answer: best.item.a, score: best.score, matched: best.item.q };
    }

    return { ok: false };
  }

  async addCustomQA(q: string, a: string, tags?: string[]) {
    await this.ensureLoaded();
    const nq = (q || '').trim();
    const na = (a || '').trim();
    if (!nq || !na) return;

    this.custom.unshift({ q: nq, a: na, tags: Array.isArray(tags) ? tags : undefined });
    if (this.custom.length > 300) this.custom = this.custom.slice(0, 300);
    await this.saveCustom();
  }

  async removeCustomByIndex(i: number) {
    await this.ensureLoaded();
    if (i < 0 || i >= this.custom.length) return;
    this.custom.splice(i, 1);
    await this.saveCustom();
  }

  async listCustom(): Promise<FaqItem[]> {
    await this.ensureLoaded();
    return JSON.parse(JSON.stringify(this.custom || []));
  }

  async resetCustom() {
    await this.ensureLoaded();
    this.custom = [];
    await Preferences.remove({ key: this.CUSTOM_KEY });
  }

  // --------- Matching ----------
  private norm(s: string) {
    return (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/[^\w\s\-]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  private tokenize(s: string) {
    return this.norm(s)
      .split(' ')
      .map(t => t.trim())
      .filter(t => t.length > 1 && !this.STOP.has(t));
  }

  private levenshteinSimilarity(a: string, b: string): number {
    const s1 = this.norm(a), s2 = this.norm(b);
    if (!s1 && !s2) return 1;
    if (!s1 || !s2) return 0;

    const len1 = s1.length, len2 = s2.length;
    const dp: number[][] = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost);
      }
    }

    const dist = dp[len1][len2];
    const maxLen = Math.max(len1, len2);
    return Math.max(0, Math.min(1, 1 - (dist / maxLen)));
  }

  private jaccard(tokensA: string[], tokensB: string[]): number {
    const A = new Set(tokensA);
    const B = new Set(tokensB);
    const inter = [...A].filter(x => B.has(x)).length;
    const uni = new Set([...A, ...B]).size;
    return uni === 0 ? 0 : inter / uni;
  }

  // score híbrido: token match + levenshtein + boost por tags
  private score(dbQ: string, userQ: string, tags?: string[]): number {
    const tA = this.tokenize(dbQ);
    const tB = this.tokenize(userQ);

    // token-level: mejor match por token usando levenshtein
    let tokenScores: number[] = [];
    for (const a of tA) {
      let best = 0;
      for (const b of tB) {
        best = Math.max(best, this.levenshteinSimilarity(a, b));
      }
      tokenScores.push(best);
    }
    const avgToken = tokenScores.length ? tokenScores.reduce((x,y)=>x+y,0)/tokenScores.length : 0;
    const jac = this.jaccard(tA, tB);
    const lev = this.levenshteinSimilarity(dbQ, userQ);

    let s = (avgToken * 0.50) + (jac * 0.30) + (lev * 0.20);

    // boost por tags si aparecen en la pregunta
    if (Array.isArray(tags) && tags.length) {
      const u = this.norm(userQ);
      let hit = 0;
      for (const tg of tags) {
        if (tg && u.includes(this.norm(tg))) hit++;
      }
      if (hit > 0) s += Math.min(0.08, hit * 0.03);
    }

    return Math.max(0, Math.min(1, s));
  }
}
