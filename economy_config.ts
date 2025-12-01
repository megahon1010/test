// economy_config.ts - 経済システムに関する定数

// 通貨の絵文字
export const CURRENCY_EMOJI = "💎";

// 仕事のクールダウン時間 (秒)
export const COOLDOWN_SECONDS = 10; // ユーザー設定に合わせて10秒に修正

// 職業の階層と報酬設定
export const JOB_HIERARCHY = [
    { name: "不登校", emoji: "🏫", pay: [10, 30], required_works: 0, hourly_pay: "10-30" },
    { name: "鉱夫", emoji: "⛏️", pay: [30, 70], required_works: 10, hourly_pay: "30-70" },
    { name: "和菓子屋", emoji: "🍡", pay: [60, 90], required_works: 30, hourly_pay: "60-90" },
    { name: "IT企業社長", emoji: "💻", pay: [180, 250], required_works: 50, hourly_pay: "180-250" },
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
