// commands/ping.ts - /ping コマンドの処理ロジック

/**
 * /ping コマンドの処理
 */
export function handlePing() {
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
