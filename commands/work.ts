// commands/work.ts - /work コマンドの処理ロジック

import { getPlayerData, setPlayerData } from '../firestore_api.ts';
import { CURRENCY_EMOJI, COOLDOWN_SECONDS, JOB_HIERARCHY, VARIATION_DATA } from '../economy_config.ts';

/**
 * /work コマンドの処理
 */
export async function handleWork(interaction: any, userId: string) {
    // ユーザー名の取得 (Discordのニックネーム、ユーザー名、グローバル名の順に優先)
    const userDisplayName = interaction.member?.nick || interaction.user?.username || interaction.user?.global_name || 'ユーザー';
    
    // プレイヤーデータを取得
    const player = await getPlayerData(userId);
    const currentTime = Date.now() / 1000; // 秒単位に変換
    const remainingTime = player.last_work_time + COOLDOWN_SECONDS - currentTime;

    // クールダウンチェック
    if (remainingTime > 0) {
        const minutes = Math.floor(remainingTime / 60);
        const seconds = Math.floor(remainingTime % 60);
        const cooldownMessage = minutes > 0 
            ? `まだ休憩時間です。次の仕事まであと **${minutes}分 ${seconds}秒** 待ってください。`
            : `まだ休憩時間です。次の仕事まであと **${seconds}秒** 待ってください。`;
            
        return {
            type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
            data: {
                content: cooldownMessage,
                flags: 64, // EPHEMERAL (自分にだけ見える)
            }
        };
    }

    const currentJob = JOB_HIERARCHY[player.job_index];
    const [lowPay, highPay] = currentJob.pay;
    
    // 収益の計算と変動メッセージ
    const variationKeys = Object.keys(VARIATION_DATA);
    // variationKeysからランダムにキーを選択
    const variationKey = variationKeys[Math.floor(Math.random() * variationKeys.length)];
    const variation = (VARIATION_DATA as any)[variationKey];
    
    const baseEarnings = Math.floor(Math.random() * (highPay - lowPay + 1)) + lowPay;
    
    // multiplierを適用した基本報酬
    let totalEarnings = Math.floor(baseEarnings * (variation.multiplier || 1.0));
    let responseMessage = variation.message;
    let promotionMessage = "";

    // ボーナス処理
    if (variation.bonus_multiplier) {
        const bonusAmount = Math.floor(baseEarnings * variation.bonus_multiplier); 
        totalEarnings += bonusAmount;
        
        responseMessage = responseMessage
            .replace('{bonus_amount}', bonusAmount.toLocaleString())
            .replace('{total_earnings}', totalEarnings.toLocaleString());
    }
    
    // メッセージ内のプレースホルダーを置換
    responseMessage = responseMessage
        .replace('{job_name}', currentJob.name)
        .replace('{earnings}', totalEarnings.toLocaleString()) // lateの場合はmultiplierが適用された値
        .replace('{emoji}', CURRENCY_EMOJI);
    
    // データの更新
    player.gem_balance += totalEarnings;
    player.last_work_time = currentTime;
    player.work_count += 1;
    player.discord_username = userDisplayName; // ユーザー名を更新/保存

    // 昇進判定
    const nextJobIndex = player.job_index + 1;
    if (nextJobIndex < JOB_HIERARCHY.length) {
        const nextJob = JOB_HIERARCHY[nextJobIndex];
        // 昇進に必要な回数に達しているかチェック
        if (player.work_count >= nextJob.required_works) {
            player.job_index = nextJobIndex;
            promotionMessage = `\n\n**🎉 昇進おめでとう！**\nあなたは **${nextJob.name} ${nextJob.emoji}** に昇進しました！`;
        }
    }
    
    // データベースに保存
    await setPlayerData(userId, player);

    // Embedの作成
    const embed = {
        title: `${currentJob.name} ${currentJob.emoji} として働きました！`,
        description: responseMessage + promotionMessage,
        color: 3447003, // Blue
        fields: [
            {
                name: "現在の所持金",
                value: `${CURRENCY_EMOJI} ${player.gem_balance.toLocaleString()} Gem`,
                inline: false,
            }
        ]
    };

    return {
        type: 4, 
        data: { embeds: [embed] }
    };
}
