/** 着せかえ用の柴の毛色。ささみを集めて解放する */
export interface Skin {
  id: string;
  name: string;
  /** 解放に必要なささみの数（0 は最初から使える） */
  cost: number;
  fur: number;
  furDark: number;
  cream: number;
}

export const SKINS: Skin[] = [
  { id: 'red', name: '赤柴', cost: 0, fur: 0xdc8433, furDark: 0xc06d25, cream: 0xfff4e2 },
  { id: 'black', name: '黒柴', cost: 20, fur: 0x2e2724, furDark: 0x1f1a17, cream: 0xf5e7cf },
  { id: 'white', name: '白柴', cost: 50, fur: 0xf2e8d6, furDark: 0xdccdb4, cream: 0xffffff },
  { id: 'sesame', name: '胡麻柴', cost: 100, fur: 0xa8784b, furDark: 0x5e4330, cream: 0xfff1dc },
];

/** 端末に保存する進行状況（ささみの所持数・解放済みの柴・選んでいる柴） */
export interface SaveData {
  sasami: number;
  unlocked: string[];
  skin: string;
  /** 説明ラベルを出し終えたもの（初めて出てきたときだけ説明する） */
  seen: string[];
}

const KEY = 'shiba-run-save';

export function loadSave(): SaveData {
  const fallback: SaveData = { sasami: 0, unlocked: ['red'], skin: 'red', seen: [] };
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SaveData> | null;
    if (!d) return fallback;
    const unlocked = Array.isArray(d.unlocked) ? d.unlocked.filter((id) => SKINS.some((s) => s.id === id)) : [];
    if (!unlocked.includes('red')) unlocked.unshift('red');
    const skin = typeof d.skin === 'string' && unlocked.includes(d.skin) ? d.skin : 'red';
    const seen = Array.isArray(d.seen) ? d.seen.filter((k) => typeof k === 'string') : [];
    return { sasami: Math.max(0, Math.floor(Number(d.sasami) || 0)), unlocked, skin, seen };
  } catch {
    return fallback;
  }
}

export function writeSave(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // 保存できない環境（プライベートモードなど）でも遊べるようにする
  }
}
