// commands/lottery.ts - /lottery コマンドの処理ロジック

import { getPlayerData, setPlayerData } from '../firestore_api.ts';
import { CURRENCY_EMOJI, LOTTERY_TICKET_PRICE, LOTTERY_PRIZES } from '../economy_config.ts';

/**
 * /lottery コマンドの処理
 */
export async function handleLottery(interaction: any, userId: string) {
    const options = interaction.data.options || [];
    const subCommandGroup = options[0]?.name; // 'buy'
    const subCommandOptions = options[0]?.options || [];

    if (subCommandGroup !== 'buy') {
        // 現在は 'buy' サブコマンドのみをサポート
        return {
            type: 4, 
            data: { content: "このコマンドは `/lottery buy <枚数>` の形式でのみ実行できます。", flags: 64 } 
        };
    }
    
    // 購入枚数を取得
    const amountOption = subCommandOptions.find((opt: any) => opt.name === 'amount');
    const ticketAmount = amountOption ? amountOption.value : 1;
    
    // 入力値のバリデーション
    if (ticketAmount <= 0 || ticketAmount > 1000 || !Number.isInteger(ticketAmount)) {
        return {
            type: 4, 
            data: { content: "購入枚数は1〜1000枚の範囲で、整数を指定してください。", flags: 64 } 
        };
    }

    const player = await getPlayerData(userId);
    const cost = ticketAmount * LOTTERY_TICKET_PRICE;
    
    // 所持金チェック
    if (player.gem_balance < cost) {
        return {
            type: 4, 
            data: { 
                content: `所持金が足りません！宝くじ${ticketAmount}枚の購入には ${cost.toLocaleString()}${CURRENCY_EMOJI} Gemが必要です。あなたの残高は ${player.gem_balance.toLocaleString()}${CURRENCY_EMOJI} Gemです。`, 
                flags: 64 
            }
        };
    }
    
    // 1. コストを差し引く
    player.gem_balance -= cost;
    let totalWinnings = 0;
    let results: { name: string, emoji: string, count: number }[] = [];
    
    // 2. 抽選ロジック
    for (let i = 0; i < ticketAmount; i++) {
        const prize = drawPrize();
        const prizeIndex = results.findIndex(r => r.name === prize.name);
        
        // 報酬を計算
        const winAmount = LOTTERY_TICKET_PRICE * prize.multiplier;
        totalWinnings += winAmount;
        
        // 結果を集計
        if (prizeIndex !== -1) {
            results[prizeIndex].count++;
        } else {
            results.push({ name: prize.name, emoji: prize.emoji, count: 1 });
        }
    }

    // 3. 報酬を合算
    player.gem_balance += totalWinnings;

    // 4. データベースに保存
    await setPlayerData(userId, player);
    
    // 5. 結果メッセージの作成
    let resultMessage = results
        .sort((a, b) => b.count - a.count) // 多い順にソート
        .map(r => `・${r.emoji} **${r.name}**: ${r.count}枚`)
        .join('\n');
    
    const netChange = totalWinnings - cost;

    const embed = {
        title: `🎫 宝くじ抽選結果 - ${ticketAmount}枚`,
        color: netChange >= 0 ? 3447003 : 16711680, // 利益があれば青、損失があれば赤
        description: 
            `**購入費用**: ${cost.toLocaleString()}${CURRENCY_EMOJI}\n` +
            `**当選総額**: ${totalWinnings.toLocaleString()}${CURRENCY_EMOJI}\n\n` +
            `**損益**: **${netChange >= 0 ? '+' : ''}${netChange.toLocaleString()}${CURRENCY_EMOJI}**\n\n` +
            `--- 個別結果 ---\n${resultMessage}`,
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

/**
 * 確率に基づいて当選等級を決定するヘルパー関数
 */
function drawPrize() {
    const rand = Math.random() * 100; // 0から100までの乱数
    let cumulativeProbability = 0;

    for (const prize of LOTTERY_PRIZES) {
        cumulativeProbability += prize.probability;
        if (rand < cumulativeProbability) {
            return prize;
        }
    }
    // 安全のため、最後に設定された賞（通常は「はずれ」）を返す
    return LOTTERY_PRIZES[LOTTERY_PRIZES.length - 1];
}
