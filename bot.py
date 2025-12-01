# Easy Discord Bot Builderによって作成されました！ 製作：@himais0giiiin
# Created with Easy Discord Bot Builder! created by @himais0giiiin!
# Optimized Version
# (既存のコードの上部/import群の下に追記)
from flask import Flask
from threading import Thread

# Flaskアプリの作成 (ヘルスチェック用)
app = Flask(__name__)

@app.route('/')
def index():
    # Koyebがボットの稼働を確認するための応答
    return "Discord Bot is running!", 200

# Flaskサーバーを別スレッドで起動する関数
def run_flask():
    app.run(host='0.0.0.0', port=8000)

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

# ロギング設定 (Logging Setup)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

intents = discord.Intents.default()
intents.message_content = True 
intents.members = True 
intents.voice_states = True

# Botの作成
bot = commands.Bot(command_prefix='!', intents=intents)

# グローバルエラーハンドラー
@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    logging.error(f"Command Error: {error}")

# ---JSON操作---
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
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} command(s)")
    except Exception as e:
        print(e)

    # 🚨 起動時のメッセージ送信を一時的にコメントアウト (原因切り分けのため)
    # _ch_id = int('1252397083999076364') if str('1252397083999076364').isdigit() else 0
    # _channel = bot.get_channel(_ch_id)
    # if _channel:
    #     await _channel.send(content='フリーナは神ではない(物理)')


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
    # 🚨 サーバーとボットを同時に起動する
    # サーバーを別スレッドで起動
    t = Thread(target=run_flask)
    t.start()
    
    # トークンを設定してボットを起動
    # 修正済み: os.environ.get() を使って環境変数から値を取得
    TOKEN = os.environ.get('DISCORD_TOKEN')
    
    if TOKEN:
        bot.run(TOKEN)
    else:
        # トークンが取得できない場合はログに出力
        print("Error: DISCORD_TOKEN 環境変数が取得できませんでした。Koyebの設定を確認してください。")
    
    pass
