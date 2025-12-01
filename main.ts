// main.ts - Deno Deploy/TypeScript版 Bot

import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { 
    CURRENCY_EMOJI, 
    COOLDOWN_SECONDS, 
    JOB_HIERARCHY, 
    VARIATION_DATA 
} from "./economy_config.ts";

// Discord APIとの通信に必要な環境変数
const BOT_TOKEN = Deno.env.get("DISCORD_TOKEN"); // Deno.env.get is fine to use in Deno Deploy
const PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY");
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID"); 
const FIREBASE_API_KEY = Deno.env.get("FIREBASE_API_KEY");       

// --- ユーティリティ関数 ---

// ユーザーデータの型定義
interface PlayerData {
    gem_balance: number;
    work_count: number;
    last_work_time: number;
    job_index: number;
}

/**
 * Firestore REST APIを使用してプレイヤーデータを取得または初期化します。
 * @param userId DiscordユーザーID
 * @returns プレイヤーデータ、または初期データ
 */
async function getPlayerData(userId: string): Promise<PlayerData> {
    const defaultData: PlayerData = {
        gem_balance: 0, 
        work_count: 0, 
        last_work_time: 0, 
        job_index: 0 
    };

    if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY) {
        console.error("Firestore環境変数が設定されていません。デフォルトデータを使用します。");
        return defaultData;
    }

    // ドキュメントパスの構築 (例: projects/{projectId}/databases/(default)/documents/users/{userId})
    const firestoreUrl = 
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}?key=${FIREBASE_API_KEY}`;
    
    try {
        const response = await fetch(firestoreUrl);
        if (response.status === 404) {
             // ドキュメントが存在しない場合はデフォルトデータを返します
            return defaultData;
        }
        if (!response.ok) {
            console.error(`Firestore GET error: ${response.statusText}`);
            return defaultData;
        }
        
        const doc = await response.json();
        
        // Firestoreの構造をPlayerDataに変換 (integerValueとdoubleValueをパース)
        // 厳密なチェックのため、全ての値が存在するか確認
        const fields = doc.fields;
        if (!fields) return defaultData;
        
        return {
            gem_balance: parseInt(fields.gem_balance?.integerValue || '0'),
            work_count: parseInt(fields.work_count?.integerValue || '0'),
            last_work_time: parseFloat(fields.last_work_time?.doubleValue || '0'),
            job_index: parseInt(fields.job_index?.integerValue || '0'),
        };

    } catch (e) {
        console.error("Firestore GET Fetch failed:", e);
        return defaultData;
    }
}

/**
 * Firestore REST APIを使用してプレイヤーデータを設定します。
 */
async function setPlayerData(userId: string, data: PlayerData): Promise<boolean> {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY) {
        console.error("Firestore環境変数が設定されていません。保存をスキップします。");
        return false;
    }
    
    const firestoreUrl = 
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}?key=${FIREBASE_API_KEY}`;

    // Firestore REST APIのフィールド形式に変換
    const body = {
        fields: {
            gem_balance: { integerValue: data.gem_balance.toString() },
            work_count: { integerValue: data.work_count.toString() },
            last_work_time: { doubleValue: data.last_work_time.toString() }, // doubleValueで保存
            job_index: { integerValue: data.job_index.toString() },
        }
    };

    try {
        const response = await fetch(firestoreUrl, {
            method: 'PATCH', // PATCHでドキュメントを更新または作成
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Firestore SET error: ${response.statusText} - ${errorText}`);
            return false;
        }
        return true;

    } catch (e) {
        console.error("Firestore SET Fetch failed:", e);
        return false;
    }
}


// --- Discord Interaction の処理関数 ---

/**
 * /work コマンドの処理
 */
async function handleWork(interaction: any, userId: string) {
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
    const variationKey = variationKeys[Math.floor(Math.random() * variationKeys.length)];
    const variation = (VARIATION_DATA as any)[variationKey];
    
    const baseEarnings = Math.floor(Math.random() * (highPay - lowPay + 1)) + lowPay;
    let totalEarnings = Math.floor(baseEarnings * variation.multiplier);
    let responseMessage = "";
    let promotionMessage = "";

    if (variationKey === 'bonus') {
        const bonusAmount = Math.floor(baseEarnings * (variation.bonus_multiplier || 0)); // bonus_multiplierがない場合は0
        totalEarnings += bonusAmount;
        responseMessage = variation.message
            .replace('{job_name}', currentJob.name)
            .replace('{earnings}', baseEarnings.toLocaleString())
            .replace('{bonus_amount}', bonusAmount.toLocaleString())
            .replace('{total_earnings}', totalEarnings.toLocaleString())
            .replace('{emoji}', CURRENCY_EMOJI);
    } else if (variationKey === 'late') {
         // lateの場合、totalEarningsはmultiplierが適用された後の値
         responseMessage = variation.message
            .replace('{job_name}', currentJob.name)
            .replace('{earnings}', totalEarnings.toLocaleString()) // multiplier適用後の値
            .replace('{emoji}', CURRENCY_EMOJI);
    } else {
        // normalの場合
        responseMessage = variation.message
            .replace('{job_name}', currentJob.name)
            .replace('{earnings}', totalEarnings.toLocaleString())
            .replace('{emoji}', CURRENCY_EMOJI);
    }
    
    // データの更新
    player.gem_balance += totalEarnings;
    player.last_work_time = currentTime;
    player.work_count += 1;

    // 昇進判定
    const nextJobIndex = player.job_index + 1;
    if (nextJobIndex < JOB_HIERARCHY.length) {
        const nextJob = JOB_HIERARCHY[nextJobIndex];
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

/**
 * /balance コマンドの処理
 */
async function handleBalance(interaction: any, userId: string) {
    const player = await getPlayerData(userId);
    const userDisplayName = interaction.member?.nick || interaction.user?.username || 'ユーザー';

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

/**
 * /ping コマンドの処理
 */
function handlePing() {
    // Deno Deploy環境ではBotの正確なレイテンシを取得できないため、簡単な応答を返します
    const embed = {
        title: "🏓 Pong!",
        description: "Deno Deployからの応答は高速です。",
        color: 5763719, // Green
    };

    return {
        type: 4, 
        data: { embeds: [embed], flags: 64 } // EPHEMERAL
    };
}

/**
 * /setjob コマンドの処理
 */
async function handleSetJob(interaction: any) {
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


/**
 * Discordからのすべてのリクエストを処理するメインハンドラ関数
 */
async function handleDiscordRequest(request: Request): Promise<Response> {
    // 1. 署名検証 (Security)
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const body = await request.text();

    if (!PUBLIC_KEY || !signature || !timestamp) {
        console.error("Missing Security Headers or Public Key");
        return new Response("Bad Request", { status: 400 });
    }

    // 署名検証 (Deno標準のWeb Crypto APIを使用)
    try {
        const isValid = await crypto.subtle.verify(
            { name: "Ed25519" },
            await crypto.subtle.importKey(
                "raw",
                hexToUint8(PUBLIC_KEY),
                { name: "Ed25519", namedCurve: "Ed25519" },
                false,
                ["verify"]
            ),
            hexToUint8(signature),
            new TextEncoder().encode(timestamp + body)
        );

        if (!isValid) {
            console.warn("Invalid Signature");
            return new Response("Invalid Signature", { status: 401 });
        }
    } catch (e) {
        console.error("Signature Verification Error:", e);
        return new Response("Internal Server Error", { status: 500 });
    }

    // 2. Interactionの型を解析
    const interaction = JSON.parse(body);

    switch (interaction.type) {
        case 1: // PING
            // PING応答はBotが生きているか確認するために送られます
            return new Response(JSON.stringify({ type: 1 }), {
                headers: { "Content-Type": "application/json" },
            });
            
        case 2: // APPLICATION_COMMAND
            const commandName = interaction.data.name;
            // メンバー情報からIDを取得 (サーバーコマンドの場合 member.user.id、DMの場合 user.id)
            const userId = interaction.member?.user?.id || interaction.user?.id; 
            
            console.log(`Command received: /${commandName} from ${userId}`);

            let responseData;
            
            switch (commandName) {
                case 'work':
                    responseData = await handleWork(interaction, userId);
                    break;
                case 'balance':
                    responseData = await handleBalance(interaction, userId);
                    break;
                case 'ping':
                    responseData = handlePing();
                    break;
                case 'setjob':
                    responseData = await handleSetJob(interaction);
                    break;
                default:
                    responseData = { type: 4, data: { content: "不明なコマンドです。", flags: 64 } };
            }
            
            return new Response(JSON.stringify(responseData), {
                headers: { "Content-Type": "application/json" },
            });
            
        default:
            console.log(`Unhandled interaction type: ${interaction.type}`);
            return new Response("Not Handled", { status: 400 });
    }
}

// ヘルパー: 16進数文字列をUint8Arrayに変換
function hexToUint8(hex: string): Uint8Array {
    // 16進数文字列を2文字ずつに分割し、数値に変換してUint8Arrayを作成
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(val => parseInt(val, 16)));
}

// --- Deno Deploy サーバー起動 ---
console.log("Deno Deploy Discord Bot Worker Starting...");

// Deno Deployは `serve` 関数にリクエストハンドラを渡すことで動作します
serve(handleDiscordRequest);
