# Discord Bot - Firestore永続化版 (データリセット対策 & Koyeb Deep Sleep対策)

from flask import Flask
from threading import Thread
import discord
from discord import app_commands
from discord.ext import commands, tasks
import random
import time
import aiohttp 
import json
import os
import logging
# 🚨 Firebase関連のインポート
import firebase_admin 
from firebase_admin import credentials, firestore

# ロギング設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 🚨 設定ファイルをインポート
try:
    from economy_config import JOB_HIERARCHY, VARIATION_DATA, CURRENCY_EMOJI, COOLDOWN_SECONDS
except ImportError:
    logging.error("Error: economy_config.py not found. Please ensure it is in the same directory.")
    # 本番環境ではexit(1)として強制終了させるべきですが、ここでは続行可能にします
    pass 

# --- Flask Webサーバー設定 (Koyebのヘルスチェック応答用) ---
app = Flask(__name__)

@app.route('/')
def index():
    # Discord Bot is running and pingable!
    return "Discord Bot is running and pingable!", 200

def run_flask():
    # 警告は出ますが、Koyebの動作に必須なのでこのままにします
    app.run(host='0.0.0.0', port=8000, debug=False)

# --- Discord Bot設定 ---
intents = discord.Intents.default()
intents.message_content = True 
intents.members = True 
intents.voice_states = True

bot = commands.Bot(command_prefix='!', intents=intents)

# グローバル変数
http_session = None
db = None # Firestoreクライアント

# --- Firestore初期化 ---
def init_firestore():
    """Firestore接続を初期化し、成功したか(True)失敗したか(False)を返す"""
    global db
    # 🚨 Koyebの環境変数から認証情報を取得
    firebase_json_str = os.environ.get('FIREBASE_CREDENTIALS_JSON')
    if not firebase_json_str:
        logging.error("FIREBASE_CREDENTIALS_JSON 環境変数が設定されていません。データは永続化されません。")
        return False
        
    try:
        # JSON文字列を解析し、認証情報として使用
        cred_json = json.loads(firebase_json_str)
        cred = credentials.Certificate(cred_json)
        
        if not firebase_admin._apps:
             firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        logging.info("Firebase Firestore initialized successfully. Data is now persistent.")
        return True
    except Exception as e:
        logging.error(f"Failed to initialize Firebase: {e}")
        return False

# --- Firestore操作 ---
async def get_player_data(user_id):
    """Firestoreからユーザーデータを取得し、存在しない場合は初期値を返す。"""
    if db is None:
        return None # DB接続失敗
    try:
        # 'users' コレクションのユーザーIDドキュメントを参照
        doc_ref = db.collection('users').document(str(user_id))
        # 同期処理を非同期で実行
        doc = await bot.loop.run_in_executor(None, doc_ref.get) 
        
        if doc.exists:
            return doc.to_dict()
        else:
            # データがない場合は初期値を返す
            return {
                'gem_balance': 0, 
                'work_count': 0, 
                'last_work_time': 0, 
                'job_index': 0 
            }
    except Exception as e:
        logging.error(f"Firestore Get Error for {user_id}: {e}")
        return None

async def set_player_data(user_id, data):
    """ユーザーデータをFirestoreに保存する。"""
    if db is None:
        return False
    try:
        doc_ref = db.collection('users').document(str(user_id))
        # 同期処理を非同期で実行
        await bot.loop.run_in_executor(None, lambda: doc_ref.set(data)) 
        return True
    except Exception as e:
        logging.error(f"Firestore Set Error for {user_id}: {e}")
        return False


# --- スリープ回避のためのタスク ---
@tasks.loop(minutes=10)
async def http_ping():
    global http_session
    # K_SERVICE_URLが設定されていない場合は内部Ping（警告は出ますが、これでOK）
    url = os.environ.get("K_SERVICE_URL", "http://127.0.0.1:8000") 
    
    if "127.0.0.1" in url:
        logging.warning("K_SERVICE_URL環境変数が設定されていません。内部Ping (localhost:8000)を試みます。")
    
    if http_session is None:
        http_session = aiohttp.ClientSession()

    try:
        async with http_session.get(url, timeout=5) as response:
            if response.status == 200:
                logging.info(f"Self-ping successful to {url}. Status: {response.status}")
            else:
                logging.warning(f"Self-ping failed to {url}. Status: {response.status}")
    except Exception as e:
        logging.error(f"Self-ping error to {url}: {e.__class__.__name__}: {e}")


# --- 起動処理とコマンド ---
@bot.event
async def on_ready():
    # Firestoreの初期化を試行
    if not init_firestore():
        print("WARNING: Firestoreの初期化に失敗しました。データはリセットされます。")
        
    print(f'Logged in as {bot.user}')
    try:
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} command(s)")
    except Exception as e:
        print(e)
        
    if not http_ping.is_running():
        http_ping.start()
        print("Anti-sleep HTTP ping task started.")
        
# --- コマンド定義 ---

@bot.tree.command(name='work', description='仕事をしてGemを稼ぎます (1時間に1回)')
async def work_command(interaction: discord.Interaction):
    user_id = str(interaction.user.id)
    
    # データをFirestoreから取得
    player = await get_player_data(user_id)
    if player is None:
        await interaction.response.send_message("エラー: データベースに接続できませんでした。FIREBASE_CREDENTIALS_JSONを確認してください。", ephemeral=True)
        return

    # クールダウンチェック
    last_time = player.get('last_work_time', 0)
    current_time = time.time()
    remaining_time = last_time + COOLDOWN_SECONDS - current_time

    if remaining_time > 0:
        minutes = int(remaining_time // 60)
        seconds = int(remaining_time % 60)
        await interaction.response.send_message(
            f"まだ休憩時間です。次の仕事まであと **{minutes}分 {seconds}秒** 待ってください。", 
            ephemeral=True
        )
        return

    # 現在の職業データを取得
    job_index = player['job_index']
    current_job = JOB_HIERARCHY[job_index]
    low_pay, high_pay = current_job['pay']
    job_key = f"{current_job['name']} {current_job['emoji']}"

    # 収益の計算
    variation_key = random.choice(list(VARIATION_DATA.keys()))
    variation = VARIATION_DATA[variation_key]
    base_earnings = random.randint(low_pay, high_pay)
    total_earnings = int(base_earnings * variation["multiplier"])
    
    if variation_key == 'bonus':
        bonus_amount = int(base_earnings * variation["bonus_multiplier"])
        total_earnings += bonus_amount
        response_message = variation["message"].format(
            job_name=current_job['name'], earnings=base_earnings, bonus_amount=bonus_amount,
            total_earnings=total_earnings, emoji=CURRENCY_EMOJI
        )
    else:
        response_message = variation["message"].format(
            job_name=current_job['name'], earnings=total_earnings, emoji=CURRENCY_EMOJI
        )
        
    # データの更新
    player['gem_balance'] += total_earnings
    player['last_work_time'] = current_time
    player['work_count'] += 1

    # --- 昇進判定 ---
    promotion_message = ""
    next_job_index = job_index + 1
    
    if next_job_index < len(JOB_HIERARCHY):
        next_job = JOB_HIERARCHY[next_job_index]
        if player['work_count'] >= next_job['required_works']:
            player['job_index'] = next_job_index
            promotion_message = f"\n\n**🎉 昇進おめでとう！**\nあなたは **{next_job['name']} {next_job['emoji']}** に昇進しました！"
    
    # データをFirestoreに保存
    await set_player_data(user_id, player)

    # 応答メッセージ
    embed = discord.Embed(
        title=f"{job_key} として働きました！",
        description=response_message + promotion_message,
        color=discord.Color.blue()
    )
    embed.add_field(name="現在の所持金", value=f"{CURRENCY_EMOJI} {player['gem_balance']:,}", inline=False)
    
    await interaction.response.send_message(embed=embed)


@bot.tree.command(name='balance', description='現在の所持金、職業、昇進状況を確認します')
async def balance_command(interaction: discord.Interaction):
    user_id = str(interaction.user.id)
    
    player = await get_player_data(user_id)
    if player is None:
        await interaction.response.send_message("エラー: データベースに接続できませんでした。FIREBASE_CREDENTIALS_JSONを確認してください。", ephemeral=True)
        return
    
    balance = player['gem_balance']
    work_count = player['work_count']
    job_index = player['job_index']
    current_job = JOB_HIERARCHY[job_index]
    
    # 次の職業情報を取得
    next_job_index = job_index + 1
    if next_job_index < len(JOB_HIERARCHY):
        next_job = JOB_HIERARCHY[next_job_index]
        required_works = next_job['required_works']
        remaining = max(0, required_works - work_count)
        next_job_info = (f"次の昇進 ({next_job['name']} {next_job['emoji']}) まで: "
                         f"あと **{remaining}回** の仕事が必要です！")
    else:
        next_job_info = "あなたは最高の職業に就いています！"

    embed = discord.Embed(
        title=f"{CURRENCY_EMOJI} {interaction.user.display_name}さんの経済ステータス",
        color=discord.Color.gold()
    )
    embed.add_field(name="Gem残高", value=f"**{CURRENCY_EMOJI} {balance:,}**", inline=False)
    embed.add_field(name="現在の職業", value=f"**{current_job['name']} {current_job['emoji']}**", inline=True)
    embed.add_field(name="総仕事回数", value=f"**{work_count}回**", inline=True)
    embed.add_field(name="昇進状況", value=next_job_info, inline=False)
    
    await interaction.response.send_message(embed=embed)


@bot.tree.command(name='ping', description='Botの応答速度を確認します')
async def ping_command(interaction: discord.Interaction):
    # 応答速度を計算 (latencyはミリ秒単位)
    latency_ms = bot.latency * 1000
    
    # 応答メッセージ
    embed = discord.Embed(
        title="🏓 Pong!",
        description=f"現在の応答速度: **{latency_ms:.2f}ms**",
        color=discord.Color.green()
    )
    # ephemeral=Trueで、コマンドを使ったユーザーのみに表示
    await interaction.response.send_message(embed=embed, ephemeral=True)


@bot.tree.command(name='setjob', description='(管理者用) ユーザーの職業を強制的に設定します。')
@app_commands.describe(
    target_user='職業を変更したいユーザーを選択してください',
    job_index='設定したい職業のインデックス (0から開始, 0: 見習い, 4: 部長など)'
)
async def setjob_command(interaction: discord.Interaction, target_user: discord.Member, job_index: int):
    # 職業インデックスのバリデーション
    if not (0 <= job_index < len(JOB_HIERARCHY)):
        await interaction.response.send_message(
            f"無効な職業インデックスです。0から{len(JOB_HIERARCHY) - 1}の範囲で指定してください。",
            ephemeral=True
        )
        return

    user_id = str(target_user.id)
    
    # データをFirestoreから取得
    player = await get_player_data(user_id)
    if player is None:
        await interaction.response.send_message("エラー: データベースに接続できませんでした。", ephemeral=True)
        return
        
    old_job = JOB_HIERARCHY[player['job_index']]['name']
    new_job = JOB_HIERARCHY[job_index]['name']

    # データの更新
    player['job_index'] = job_index
    
    # データをFirestoreに保存
    await set_player_data(user_id, player)

    # 応答メッセージ
    await interaction.response.send_message(
        f"✅ {target_user.display_name} さんの職業を **{old_job}** から **{new_job} {JOB_HIERARCHY[job_index]['emoji']}** に変更しました。",
        ephemeral=False
    )


if __name__ == "__main__":
    
    # サーバーを別スレッドで起動 (24時間稼働の維持)
    t = Thread(target=run_flask)
    t.start()
    
    # トークンを環境変数 'DISCORD_TOKEN' から安全に取得
    TOKEN = os.environ.get('DISCORD_TOKEN')
    
    if TOKEN:
        bot.run(TOKEN)
    else:
        logging.error("Error: DISCORD_TOKEN 環境変数が設定されていません。")
