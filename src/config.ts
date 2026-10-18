/** 論理座標の横幅。縦は画面の縦横比に合わせて決まる */
export const W = 360;
export const LANES = 3;

export const laneX = (lane: number): number => W / 2 + (lane - 1) * 96;

/**
 * ゲーム内の座標系（px）。y は進行方向の手前向きが正。
 * 障害物は y = SPAWN_Y に出現して柴 (SHIBA_Y) に向かって流れてくる。
 */
export const SPAWN_Y = -40;
export const SHIBA_Y = 1400;
/** 飼い主は柴の後ろ OWNER_OFFSET 〜 OWNER_OFFSET + OWNER_SPAN の範囲にいる */
export const OWNER_OFFSET = 60;
export const OWNER_SPAN = 150;

export const CFG = {
  pxPerMeter: 20,
  baseSpeed: 260, // 開始時のスクロール速度 (px/s)
  speedRamp: 3.5, // 1秒ごとの加速量
  maxBaseSpeed: 600,

  jumpDuration: 0.6,
  jumpHeight: 56,

  gapMax: 100, // 飼い主との距離ゲージ最大値
  gapStart: 60,
  gapRate: 0.07, // (柴の速度 - 飼い主の速度) をゲージ変化に換算する係数
  ownerSpeedUpMax: 0.06, // 飼い主は時間とともに最大 +6% 速くなる

  drillDuration: 0.55,
  drillCooldown: 4,
  drillRadius: 120,

  boostDuration: 3,
  boostMult: 1.5,

  stumbleDuration: 0.7,
  stumbleMult: 0.35,
  slipDuration: 0.8,
  blindDuration: 1.6,
  wetDuration: 1.0,
  wetMult: 0.7,

  bucketPenalty: 6,
  splashPenalty: 10,
  waveStartTime: 25, // この秒数以降、3レーン全部を覆う「大波」が来る

  splashSpeed: 430,
  sasamiBonus: 50,
} as const;
