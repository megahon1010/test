# Easy Discord Bot Builderによって作成されました！ 製作：@himais0giiiin
# Created with Easy Discord Bot Builder! created by @himais0giiiin!
# Optimized Version for Koyeb Deployment

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

# --- モーダルクラス ---
class EasyModal(discord.ui.Modal):
    def __init__(self, title, custom_id, inputs):
        super().__init__(title=title, timeout=None, custom_id=custom_id)
        for item in inputs:
            self.add_item(discord.ui.TextInput(label=item['label'], custom_id=item['id']))

# --- インタラクションハンドラー ---
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
        # スラッシュコマンドの同期
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} command(s)")
    except Exception as e:
        print(e)

    # 🚨 注意: 起動時のメッセージ送信コードは、クラッシュを防ぐためにコメントアウトしたままです。
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
