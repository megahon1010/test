# Easy Discord Bot Builderによって作成されました！ 製作：@himais0giiiin
# Created with Easy Discord Bot Builder! created by @himais0giiiin!
# Optimized Version for Koyeb Deployment (Economic Feature Added)

from flask import Flask
from threading import Thread
import discord
from discord import app_commands
from discord.ext import commands
from discord import ui
import random
import asyncio
import datetime
import math
import json
import os
import logging
import time # Time for cooldown

# 🚨 新しい設定ファイルをインポート
from economy_config import JOB_DATA, VARIATION_DATA, CURRENCY_EMOJI, COOLDOWN_SECONDS

# --- 経済機能の定数設定 ---
# プレイヤーデータを保存するJSONファイル
DATA_FILE = 'users.json' 
# --- 経済機能の定数設定 終了 ---


# Flaskアプリの作成 (ヘルスチェック用)
# Koyebからの定期的なアクセスに応答し、ボットの常時稼働を維持します。
app = Flask(__name__)

@app.route('/')
def index():
    # 応答コード200を返し、ボットが正常に稼働していることをKoyebに伝えます。
    return "Discord Bot is running!", 200

# Flaskサーバーを別スレッドで起動する関数
def run_flask():
    # Koyebは外部アクセスに8000番ポートを使用します。
    app.run(host='0.0.0.0', port=8000)

# ロギング設定 (Logging Setup)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# インテンツ設定
intents = discord.Intents.default()
intents.message_content = True 
intents.members = True 
intents.voice_states = True

# Botの作成 (コマンドプレフィックスは '!' )
bot = commands.Bot(command_prefix='!', intents=intents)

# グローバルエラーハンドラー
@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    logging.error(f"Command Error: {error}")

# ---JSON操作---
# 永続的なデータ保存を想定した関数 (JSONファイルを使用)
def _load_json_data(filename):
    if not os.path.exists(filename):
        return {}
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"JSON Load Error: {e}")
        return {}

def _save_json_data(filename, data):
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        logging.error(f"JSON Save Error: {e}")

# --- モーダルクラス (省略) ---
class EasyModal(discord.ui.Modal):
    def __init__(self, title, custom_id, inputs):
        super().__init__(title=title, timeout=None, custom_id=custom_id)
        for item in inputs:
            self.add_item(discord.ui.TextInput(label=item['label'], custom_id=item['id']))

# --- インタラクションハンドラー (省略) ---
@bot.event
async def on_interaction(interaction):
    try:
        if interaction.type == discord.InteractionType.component:
            pass
        elif interaction.type == discord.InteractionType.modal_submit:
            pass
    except Exception as e:
        print(f"Interaction Error: {e}")

# ----------------------------

# --- ユーザー作成部分 ---
@bot.event
async def on_ready():
    print(f'Logged in as {bot.user}')
    try:
        # スラッシュコマンドの同期 (新しい /work と /balance を登録)
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} command(s)")
    except Exception as e:
        print(e)

    # 起動時のメッセージ送信コードはコメントアウトしたままです
    # _ch_id = int('1252397083999076364') if str('1252397083999076364').isdigit() else 0
    # _channel = bot.get_channel(_ch_id)
    # if _channel:
    #     await _channel.send(content='フリーナは神ではない(物理)')


@bot.command(name='ping')
async def ping_cmd(ctx):
    user = ctx.author

    if 'ctx' in locals():
        if isinstance(ctx, discord.Interaction):
            if ctx.response.is_done():
                await ctx.followup.send(content='ｼｬｱｱｱｱｱ', ephemeral=False)
            else:
                await ctx.response.send_message(content='ｼｬｱｱｱｱｱ', ephemeral=False)
        elif isinstance(ctx, commands.Context):
            await ctx.send(content='ｼｬｱｱｱｱｱ')
        elif isinstance(ctx, discord.Message):
            await ctx.reply(content='ｼｬｱｱｱｱｱ')


# --- 経済機能コマンド ---

@bot.tree.command(name='work', description='仕事をしてGemを稼ぎます (1時間に1回)')
async def work_command(interaction: discord.Interaction):
    user_id = str(interaction.user.id)
    data = _load_json_data(DATA_FILE)
    player = data.setdefault(user_id, {'gem_balance': 0, 'last_work_time': 0, 'job': None})

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

    # 稼ぐ仕事の決定 (全職業からランダム)
    job_key = random.choice(list(JOB_DATA.keys()))
    low_pay, high_pay = JOB_DATA[job_key]

    # 収益の変動をランダムで決定 (3種類)
    variation_key = random.choice(list(VARIATION_DATA.keys()))
    variation = VARIATION_DATA[variation_key]

    # 1. 基本となる稼ぎをランダムに決定
    base_earnings = random.randint(low_pay, high_pay)
    
    # 2. 変動倍率を適用して総稼ぎを計算
    total_earnings = int(base_earnings * variation["multiplier"])
    
    # 3. ボーナス時の処理
    if variation_key == 'bonus':
        # ボーナス分の計算 (基本給に0.5倍)
        bonus_amount = int(base_earnings * variation["bonus_multiplier"])
        total_earnings += bonus_amount
        
        # メッセージの整形 (ボーナス時のみボーナス量を渡す)
        response_message = variation["message"].format(
            job_name=job_key,
            earnings=base_earnings,
            bonus_amount=bonus_amount,
            total_earnings=total_earnings,
            emoji=CURRENCY_EMOJI
        )
    else:
        # ボーナス以外のメッセージの整形 (基本給をそのまま使う)
        response_message = variation["message"].format(
            job_name=job_key,
            earnings=total_earnings,
            emoji=CURRENCY_EMOJI
        )
        
    # Gemの残高を更新
    player['gem_balance'] += total_earnings
    player['last_work_time'] = current_time
    player['job'] = job_key # 最後に就いた仕事として記録

    _save_json_data(DATA_FILE, data)

    # 応答メッセージ
    embed = discord.Embed(
        title=f"{job_key} として働きました！",
        description=response_message,
        color=discord.Color.blue()
    )
    embed.add_field(name="現在の所持金", value=f"{CURRENCY_EMOJI} {player['gem_balance']}", inline=False)

    await interaction.response.send_message(embed=embed)


@bot.tree.command(name='balance', description='現在の所持金 (Gem) を確認します')
async def balance_command(interaction: discord.Interaction):
    user_id = str(interaction.user.id)
    data = _load_json_data(DATA_FILE)
    
    # データがない場合は初期値を設定
    player = data.setdefault(user_id, {'gem_balance': 0, 'last_work_time': 0, 'job': None})
    _save_json_data(DATA_FILE, data)

    balance = player['gem_balance']
    
    embed = discord.Embed(
        title=f"{CURRENCY_EMOJI} 所持金確認",
        description=f"{interaction.user.display_name}さんの現在の所持金です。",
        color=discord.Color.gold()
    )
    embed.add_field(name="Gem残高", value=f"**{CURRENCY_EMOJI} {balance}**", inline=False)
    
    # 最後に就いた仕事があれば表示
    last_job = player.get('job', 'なし')
    if last_job:
        embed.set_footer(text=f"最後に就いた仕事: {last_job}")

    await interaction.response.send_message(embed=embed)


# --------------------------

if __name__ == "__main__":
    
    # サーバーを別スレッドで起動
    t = Thread(target=run_flask)
    t.start()
    
    # 🚨 トークンを環境変数 'DISCORD_TOKEN' から安全に取得
    TOKEN = os.environ.get('DISCORD_TOKEN')
    
    if TOKEN:
        # トークンが取得できたら、それを使ってボットを起動
        bot.run(TOKEN)
    else:
        # トークンが設定されていない場合はエラーメッセージを出力
        print("Error: DISCORD_TOKEN 環境変数が設定されていません。Koyebの設定を確認してください。")
    
    pass
