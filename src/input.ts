export type Action = 'left' | 'right' | 'jump' | 'drill' | 'tap' | 'mute';

const SWIPE_PX = 24;

/** タッチ/マウスのスワイプとキーボードをアクションに変換してキューに積む */
export class Input {
  readonly queue: Action[] = [];
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private pointerId: number | null = null;
  private consumed = false;

  constructor(
    canvas: HTMLCanvasElement,
    private toLogical: (clientX: number, clientY: number) => { x: number; y: number },
    /** 画面上のボタンに当たっていればそのアクションを返す */
    private hitButton: (x: number, y: number) => Action | null,
  ) {
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', () => (this.pointerId = null));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    if (this.pointerId !== null) return;
    const p = this.toLogical(e.clientX, e.clientY);
    const button = this.hitButton(p.x, p.y);
    if (button) {
      this.queue.push(button);
      return;
    }
    this.pointerId = e.pointerId;
    this.startX = p.x;
    this.startY = p.y;
    this.startTime = performance.now();
    this.consumed = false;
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId || this.consumed) return;
    const p = this.toLogical(e.clientX, e.clientY);
    const dx = p.x - this.startX;
    const dy = p.y - this.startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) this.queue.push(dx < 0 ? 'left' : 'right');
    else this.queue.push(dy < 0 ? 'jump' : 'drill');
    this.consumed = true;
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (!this.consumed && performance.now() - this.startTime < 350) this.queue.push('tap');
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    const map: Record<string, Action> = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
      ArrowDown: 'drill', KeyS: 'drill', ShiftLeft: 'drill', ShiftRight: 'drill',
      Enter: 'tap',
      KeyM: 'mute',
    };
    const a = map[e.code];
    if (a) {
      e.preventDefault();
      this.queue.push(a);
    }
  }
}
