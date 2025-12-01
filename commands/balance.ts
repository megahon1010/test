// commands/balance.ts - /balance コマンドの処理ロジック

import { getPlayerData } from '../firestore_api.ts';
import { CURRENCY_EMOJI, JOB_HIERARCHY } from '../economy_config.ts';

/**
 * /balance コマンドの処理
 */
export async function handleBalance(interaction: any, userId: string) {
    const player = await getPlayerData(userId);
    const userDisplayName = interaction.member?.nick || interaction.user?.username || interaction.user?.global_name || 'ユーザー';

    const balance = player.gem_balance;
    const workCount = player.work_count;
    const currentJob = JOB_HIERARCHY[player.job_index];
    
    let nextJobInfo: string;
    const nextJobIndex = player.job_index + 1;
    
    if (nextJobIndex < JOB_HIERARCHY.length) {
        const nextJob = JOB_HIERARCHY[nextJobIndex];
        const requiredWorks = nextJob.required_works;
        const remaining = Math.max(0, requiredWorks - workCount);
        nextJobInfo = (
            `次の昇進 (${nextJob.name} ${nextJob.emoji}) まで: ` +
            `あと **${remaining}回** の仕事が必要です！`
        );
    } else {
        nextJobInfo = "あなたは最高の職業に就いています！";
    }
    
    const embed = {
        title: `${CURRENCY_EMOJI} ${userDisplayName}さんの経済ステータス`,
        color: 16768768, // Gold
        fields: [
            { name: "Gem残高", value: `**${CURRENCY_EMOJI} ${balance.toLocaleString()}** Gem`, inline: false },
            { name: "現在の職業", value: `**${currentJob.name} ${currentJob.emoji}**`, inline: true },
            { name: "総仕事回数", value: `**${workCount}回**`, inline: true },
            { name: "昇進状況", value: nextJobInfo, inline: false },
        ]
    };
    
    return {
        type: 4,
        data: { embeds: [embed] }
    };
}
