// main.ts - Botのメインエントリポイント、ルーティング、およびコマンド登録

import { handlePing } from './commands/ping.ts';
import { handleWork } from './commands/work.ts';
import { handleBalance } from './commands/balance.ts';
import { handleRank } from './commands/rank.ts';
import { handleSetJob } from './commands/setjob.ts';
import { handleLottery } from './commands/lottery.ts'; 

// Discord APIとの通信に必要な環境変数
const PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY");
const TOKEN = Deno.env.get("DISCORD_TOKEN"); // コマンド登録に必要
const APPLICATION_ID = Deno.env.get("APPLICATION_ID"); // コマンド登録に必要

/**
 * Discord APIにスラッシュコマンドを登録する関数
 * Botが起動した際、一度だけ実行されます。
 */
async function registerCommands() {
    if (!TOKEN || !APPLICATION_ID) {
        console.warn("DISCORD_TOKEN または APPLICATION_ID が設定されていません。コマンド登録をスキップします。");
        return;
    }

    const commands = [
        {
            name: "ping",
            description: "Botの応答速度を確認します",
        },
        {
            name: "work",
            description: "仕事をしてGemを稼ぎます",
        },
        {
            name: "balance",
            description: "現在の所持金、職業、昇進状況を確認します",
        },
        {
            name: "rank",
            description: "Gemの所持数ランキングを表示します",
        },
        {
            name: "lottery",
            description: "宝くじを購入して一攫千金を狙います",
            options: [
                {
                    name: "buy",
                    description: "宝くじを購入します",
                    type: 1, // SUB_COMMAND (SUB_COMMAND_GROUPから変更)
                    options: [
                        {
                            name: "amount",
                            description: "購入する枚数 (1枚100Gem, 最大1000枚)",
                            type: 4, // INTEGERタイプ
                            required: true,
                        }
                    ]
                }
            ]
        },
        {
            name: "setjob",
            description: "(管理者用) ユーザーの職業を強制的に設定します。",
            options: [
                {
                    name: "target_user",
                    description: "職業を変更する対象のユーザー",
                    type: 6, // USERタイプ
                    required: true,
                },
                {
                    name: "job_index",
                    description: "設定する職業のインデックス (0=不登校, 1=鉱夫, ...)",
                    type: 4, // INTEGERタイプ
                    required: true,
                }
            ]
        }
    ];

    const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

    try {
        const response = await fetch(url, {
            method: "PUT", // 登録済みコマンドを全て上書き
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bot ${TOKEN}`,
            },
            body: JSON.stringify(commands),
        });

        if (response.ok) {
            console.log("✅ スラッシュコマンドの登録が完了しました。");
        } else {
            const error = await response.json();
            console.error("❌ コマンド登録に失敗しました:", response.status, error);
        }
    } catch (e) {
        console.error("ネットワークエラーによりコマンド登録に失敗しました:", e);
    }
}

/**
 * Discordからのすべてのリクエストを処理するメインハンドラ関数
 * @param request incoming Request object
 * @returns Response object
 */
async function handleDiscordRequest(request: Request): Promise<Response> {
    // 1. ヘルスチェック（Deno DeployがBotのステータスを確認するために使用）
    if (request.url.includes("/health")) {
        return new Response("OK", { status: 200 });
    }

    // 2. 署名検証 (Security)
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const body = await request.text();

    if (!PUBLIC_KEY || !signature || !timestamp) {
        console.error("セキュリティヘッダーまたはPublic Keyが設定されていません。");
        return new Response("Unauthorized", { status: 401 });
    }

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

    // 3. Interactionの型を解析
    const interaction = JSON.parse(body);

    switch (interaction.type) {
        case 1: // PING
            return new Response(JSON.stringify({ type: 1 }), {
                headers: { "Content-Type": "application/json" },
            });
            
        case 2: // APPLICATION_COMMAND
            const commandName = interaction.data.name;
            const userId = interaction.member?.user?.id || interaction.user?.id; 
            
            console.log(`Command received: /${commandName} from ${userId}`);

            let responseData;
            
            // コマンド名に基づき、適切なハンドラ関数を呼び出す
            switch (commandName) {
                case 'work':
                    responseData = await handleWork(interaction, userId);
                    break;
                case 'balance':
                    responseData = await handleBalance(interaction, userId);
                    break;
                case 'rank':
                    responseData = await handleRank(); 
                    break;
                case 'ping':
                    responseData = handlePing();
                    break;
                case 'setjob':
                    responseData = await handleSetJob(interaction);
                    break;
                case 'lottery': 
                    responseData = await handleLottery(interaction, userId);
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
    // TypeScriptでエラーが出ないようにバリデーションを追加
    if (!hex) return new Uint8Array();
    const matches = hex.match(/.{1,2}/g);
    if (!matches) return new Uint8Array();
    return new Uint8Array(matches.map(val => parseInt(val, 16)));
}

// --- Deno Deploy サーバー起動 ---

console.log("Deno Deploy Discord Bot Worker Starting...");

// サーバー起動前にコマンド登録を試みる
await registerCommands(); 

Deno.serve(handleDiscordRequest);
