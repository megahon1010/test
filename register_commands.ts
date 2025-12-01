// register_commands.ts - Discordにスラッシュコマンドを登録するためのスクリプト

const token = Deno.env.get("DISCORD_TOKEN");
const applicationId = Deno.env.get("APPLICATION_ID");

if (!token || !applicationId) {
    console.error("環境変数 DISCORD_TOKEN および APPLICATION_ID を設定してください。");
    Deno.exit(1);
}

// 登録したい全てのコマンドの定義
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
                type: 2, // SUB_COMMAND_GROUP
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

const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;

console.log("--- スラッシュコマンド登録開始 ---");

try {
    const response = await fetch(url, {
        method: "PUT", // PUTで登録済みコマンドを全て上書き
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bot ${token}`,
        },
        body: JSON.stringify(commands),
    });

    if (response.ok) {
        console.log("✅ 全てのスラッシュコマンドが正常に登録されました！");
    } else {
        const error = await response.json();
        console.error("❌ コマンド登録に失敗しました:", response.status, error);
    }
} catch (e) {
    console.error("ネットワークエラー:", e);
}

console.log("--- スラッシュコマンド登録完了 ---");
