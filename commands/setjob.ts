// commands/setjob.ts - /setjob コマンドの処理ロジック

import { getPlayerData, setPlayerData } from '../firestore_api.ts';
import { JOB_HIERARCHY } from '../economy_config.ts';

/**
 * /setjob コマンドの処理 (管理者コマンド)
 */
export async function handleSetJob(interaction: any) {
    // 権限チェックは省略。管理者権限が必要な場合はDiscordの設定で実施してください。
    
    const options = interaction.data.options;
    const targetUserOption = options.find((opt: any) => opt.name === 'target_user');
    const jobIndexOption = options.find((opt: any) => opt.name === 'job_index');

    if (!targetUserOption || !jobIndexOption) {
        return { type: 4, data: { content: "コマンドの引数が不足しています。", flags: 64 } };
    }

    const targetUserId = targetUserOption.value;
    const jobIndex = jobIndexOption.value;
    
    if (jobIndex < 0 || jobIndex >= JOB_HIERARCHY.length) {
        return { 
            type: 4, 
            data: { 
                content: `無効な職業インデックスです。0から${JOB_HIERARCHY.length - 1}の範囲で指定してください。`,
                flags: 64 
            } 
        };
    }

    const player = await getPlayerData(targetUserId);
    const oldJob = JOB_HIERARCHY[player.job_index].name;
    const newJob = JOB_HIERARCHY[jobIndex];
    
    // データの更新
    player.job_index = jobIndex;
    
    await setPlayerData(targetUserId, player);

    return {
        type: 4,
        data: { 
            content: `✅ <@${targetUserId}> さんの職業を **${oldJob}** から **${newJob.name} ${newJob.emoji}** に変更しました。`,
        }
    };
}
