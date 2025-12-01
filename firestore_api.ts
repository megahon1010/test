// firestore_api.ts - Firestore REST APIとのやり取りを担当

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID"); 
const FIREBASE_API_KEY = Deno.env.get("FIREBASE_API_KEY"); 

// ユーザーデータの型定義
export interface PlayerData {
    gem_balance: number;
    work_count: number;
    last_work_time: number;
    job_index: number;
    discord_username?: string; 
}

/**
 * Firestore REST APIを使用してプレイヤーデータを取得または初期化します。
 */
export async function getPlayerData(userId: string): Promise<PlayerData> {
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

    const firestoreUrl = 
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}?key=${FIREBASE_API_KEY}`;
    
    try {
        const response = await fetch(firestoreUrl);
        if (response.status === 404) {
             // ドキュメントが存在しない
            return defaultData;
        }
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Firestore GET error: ${response.statusText}. Response: ${errorText}`);
            return defaultData;
        }
        
        const doc = await response.json();
        
        const fields = doc.fields;
        if (!fields) return defaultData;
        
        return {
            gem_balance: parseInt(fields.gem_balance?.integerValue || '0'),
            work_count: parseInt(fields.work_count?.integerValue || '0'),
            last_work_time: parseFloat(fields.last_work_time?.doubleValue || '0'),
            job_index: parseInt(fields.job_index?.integerValue || '0'),
            discord_username: fields.discord_username?.stringValue || undefined,
        };

    } catch (e) {
        console.error("Firestore GET Fetch failed:", e);
        return defaultData;
    }
}

/**
 * Firestore REST APIを使用してプレイヤーデータを設定します。
 */
export async function setPlayerData(userId: string, data: PlayerData): Promise<boolean> {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY) {
        console.error("Firestore環境変数が設定されていません。保存をスキップします。");
        return false;
    }
    
    const firestoreUrl = 
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${userId}?key=${FIREBASE_API_KEY}`;

    const body = {
        fields: {
            gem_balance: { integerValue: data.gem_balance.toString() },
            work_count: { integerValue: data.work_count.toString() },
            last_work_time: { doubleValue: data.last_work_time.toString() }, 
            job_index: { integerValue: data.job_index.toString() },
            discord_username: { stringValue: data.discord_username || "Unknown User" },
        }
    };

    try {
        const response = await fetch(firestoreUrl, {
            method: 'PATCH', 
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

/**
 * Firestoreから全ユーザーデータを取得し、ランキング用にパースします。
 */
export async function getAllPlayerData(): Promise<(PlayerData & { userId: string })[]> {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY) {
        console.error("Firestore環境変数が設定されていません。ランキング取得をスキップします。");
        return [];
    }

    const firestoreUrl = 
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users?key=${FIREBASE_API_KEY}`;

    try {
        const response = await fetch(firestoreUrl);
        if (!response.ok) {
            console.error(`Firestore GET All Data error: ${response.statusText}`);
            return [];
        }

        const result = await response.json();
        const documents: any[] = result.documents || [];

        const rankData: (PlayerData & { userId: string })[] = documents.map(doc => {
            const fields = doc.fields;
            if (!fields) return null;
            
            return {
                gem_balance: parseInt(fields.gem_balance?.integerValue || '0'),
                work_count: parseInt(fields.work_count?.integerValue || '0'),
                last_work_time: parseFloat(fields.last_work_time?.doubleValue || '0'),
                job_index: parseInt(fields.job_index?.integerValue || '0'),
                discord_username: fields.discord_username?.stringValue || "Unknown User",
                // Firestoreドキュメント名からユーザーIDを取得
                userId: doc.name.split('/').pop(), 
            } as PlayerData & { userId: string };
        }).filter((d: any) => d !== null) as (PlayerData & { userId: string })[];

        return rankData;
    } catch (e) {
        console.error("Firestore GET All Data Fetch failed:", e);
        return [];
    }
}
