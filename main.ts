// main.ts - Botのメインエントリポイントとルーティング

import { handlePing } from './commands/ping.ts';
import { handleWork } from './commands/work.ts';
import { handleBalance } from './commands/balance.ts';
import { handleRank } from './commands/rank.ts';
import { handleSetJob } from './commands/setjob.ts';

// Discord APIとの通信に必要な環境変数
const PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY");

/**
 * Discordからのすべてのリクエストを処理するメインハンドラ関数
 * @param request incoming Request object
 * @returns Response object
 */
async function handleDiscordRequest(request: Request): Promise<Response> {
    // ヘルスチェックやその他のリクエストへの応答
    if (request.url.includes("/health")) {
        return new Response("OK", { status: 200 });
    }

    // 1. 署名検証 (Security)
    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const body = await request.text();

    if (!PUBLIC_KEY || !signature || !timestamp) {
        console.error("Missing Security Headers or Public Key");
        return new Response("Bad Request", { status: 400 });
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

    // 2. Interactionの型を解析
    const interaction = JSON.parse(body);

    switch (interaction.type) {
        case 1: // PING
            // PING応答はタイプ1を返す
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
                    responseData = await handleRank(); // ユーザーIDは不要（内部で全データ取得）
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
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(val => parseInt(val, 16)));
}

// --- Deno Deploy サーバー起動 ---

console.log("Deno Deploy Discord Bot Worker Starting...");

Deno.serve(handleDiscordRequest);
