// commands/rank.ts - /rank コマンドの処理ロジック

import { getAllPlayerData, PlayerData } from '../firestore_api.ts';
import { CURRENCY_EMOJI, JOB_HIERARCHY } from '../economy_config.ts';

/**
 * /rank コマンドの処理。Gem残高に基づいてランキングを表示します。
 */
export async function handleRank() {
    // 1. 全プレイヤーデータを取得
    const rankData = await getAllPlayerData();

    if (rankData.length === 0) {
        return {
            type: 4,
            data: { 
                content: "ランキングデータが見つかりませんでした。誰か `/work` してください！", 
                flags: 64 
            }
        };
    }

    // 2. Gem残高で降順ソートし、上位10名に限定
    const sortedData = rankData
        .sort((a, b) => b.gem_balance - a.gem_balance)
        .slice(0, 10); 

    let rankString = "";
    sortedData.forEach((player, index) => {
        const rank = index + 1;
        const job = JOB_HIERARCHY[player.job_index]?.emoji || '❓';
        const name = player.discord_username || `Unknown User (${player.userId.substring(0, 4)}...)`;
        
        // 順位に応じた絵文字
        let rankEmoji = '👑';
        if (rank === 2) rankEmoji = '🥈';
        else if (rank === 3) rankEmoji = '🥉';
        else if (rank <= 10) rankEmoji = '🏅';


        rankString += `${rankEmoji} **#${rank}** ${job} **${name}** : ${CURRENCY_EMOJI} ${player.gem_balance.toLocaleString()}\n`;
    });

    const embed = {
        title: `🏆 Gem 所持数 ランキング TOP 10`,
        description: rankString,
        color: 15844367, // Yellow/Gold
        timestamp: new Date().toISOString(),
        footer: { text: "残高に基づき自動更新" }
    };

    return {
        type: 4, 
        data: { embeds: [embed] }
    };
}
