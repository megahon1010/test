// economy_config.ts - 経済システムに関する定数

// 通貨の絵文字
export const CURRENCY_EMOJI = "💎";

// 仕事のクールダウン時間 (秒)
export const COOLDOWN_SECONDS = 10; // ユーザー設定に合わせて10秒に修正

// 職業の階層と報酬設定
export const JOB_HIERARCHY = [
    { name: "不登校", emoji: "🏫", pay: [10, 30], required_works: 0, hourly_pay: "10-30" },
    { name: "鉱夫", emoji: "⛏️", pay: [30, 50], required_works: 25, hourly_pay: "30-70" },
    { name: "和菓子屋", emoji: "🍡", pay: [80, 100], required_works: 50, hourly_pay: "60-90" },
    { name: "IT企業社長", emoji: "💻", pay: [220, 300], required_works: 75, hourly_pay: "180-250" },
];

// 仕事の変動データ
export const VARIATION_DATA = {
    // 1. 通常
    "normal": {
        "multiplier": 1.0,
        "message": "{job_name}として働き、{earnings}{emoji}Gemを稼ぎました！"
    },
    // 2. 遅刻 (稼ぎが少ない)
    "late": {
        "multiplier": 0.5, // 稼ぎが半分になる
        "message": "{job_name}として働きましたが遅刻してしまったので、{earnings}{emoji}Gemを稼ぎました..."
    },
    // 3. ボーナス (稼ぎが多い)
    "bonus": {
        "multiplier": 1.0,
        "bonus_multiplier": 0.5, // 基本給の50%をボーナスとして加算
        "message": "{job_name}として働き、{earnings}{emoji}Gemを稼ぎました！さらにボーナスとして{bonus_amount}{emoji}をもらいました！\n合計: **{total_earnings}{emoji}Gem**"
    }
    // 以前あった 'jackpot' は削除されました
};

/**
 * --- 宝くじ設定 (Lottery Configuration) ---
 */
export const LOTTERY_TICKET_PRICE = 100; // 宝くじ1枚あたりの購入価格

/**
 * 宝くじの等級と当選確率、倍率の定義。
 * probabilityの合計は必ず 100.0 になるように設定してください。
 */
export const LOTTERY_PRIZES = [
    // 1等 (確率: 0.5%、倍率: 1000倍)
    { name: "1等", emoji: "🎉", multiplier: 1000, probability: 0.5 },
    // 2等 (確率: 1.5%、倍率: 50倍)
    { name: "2等", emoji: "💰", multiplier: 50, probability: 1.5 },
    // 3等 (確率: 5.0%、倍率: 10倍)
    { name: "3等", emoji: "🎁", multiplier: 10, probability: 5.0 },
    // 4等 (確率: 10.0%、倍率: 2倍)
    { name: "3等", emoji: "🛍", multiplier: 2, probability: 10.0 },
    // はずれ (確率: 88.0%、倍率: 0倍)
    { name: "はずれ", emoji: "😂", multiplier: 0, probability: 83.0 }
];
