# Easy Discord Bot Builderによって作成されました！ 製作：@himais0giiiin
# Created with Easy Discord Bot Builder! created by @himais0giiiin!
# Optimized Version for Koyeb Deployment (Advanced Economic System)

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
import time

# 🚨 新しい設定ファイルをインポート
# このファイルには、職業階層、報酬、メッセージテンプレートが定義されています。
try:
    from economy_config import JOB_HIERARCHY, VARIATION_DATA, CURRENCY_EMOJI, COOLDOWN_SECONDS, DATA_FILE
except ImportError:
    # economy_config.pyが見つからない場合のフォールバック（デプロイ成功のため、設定は別ファイルに！）
    print("Error: economy_config.py not found. Please ensure it is in the same directory.")
    exit(1)


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
    # debug=Falseは本番環境のベストプラクティス
    app.run(host='0.0.0.0', port=8000, debug=False)

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

# --- モーダルクラス (今回は未使用) ---
class EasyModal(discord.ui.Modal):
    def __init__(self, title, custom_id, inputs):
        super().__init__(title=title, timeout=None, custom_id=custom_id)
        for item in inputs:
            self.add_item(discord.ui.TextInput(label=item['label'], custom_id=item['id']))

# --- インタラクションハンドラー (今回は未使用) ---
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

    # 以前のエラー回避のため、起動時メッセージ送信コードはコメントアウトのまま
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
    
    # プレイヤーデータの初期化 (gem_balance, work_count, last_work_time, job_index)
    player = data.setdefault(user_id, {
        'gem_balance': 0, 
        'work_count': 0, 
        'last_work_time': 0, 
        'job_index': 0 # 初期職業は JOB_HIERARCHY[0]
    })

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

    # 収益の変動をランダムで決定 (3種類)
    variation_key = random.choice(list(VARIATION_DATA.keys()))
    variation = VARIATION_DATA[variation_key]

    # 1. 基本となる稼ぎをランダムに決定
    base_earnings = random.randint(low_pay, high_pay)
    
    # 2. 変動倍率を適用して総稼ぎを計算
    total_earnings = int(base_earnings * variation["multiplier"])
    
    # 3. ボーナス時の処理
    if variation_key == 'bonus':
        bonus_amount = int(base_earnings * variation["bonus_multiplier"])
        total_earnings += bonus_amount
        
        response_message = variation["message"].format(
            job_name=current_job['name'],
            earnings=base_earnings,
            bonus_amount=bonus_amount,
            total_earnings=total_earnings,
            emoji=CURRENCY_EMOJI
        )
    else:
        # ボーナス以外のメッセージの整形
        response_message = variation["message"].format(
            job_name=current_job['name'],
            earnings=total_earnings,
            emoji=CURRENCY_EMOJI
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
        
        # 昇進条件達成チェック
        if player['work_count'] >= next_job['required_works']:
            player['job_index'] = next_job_index # 職業インデックスを更新
            
            # 昇進メッセージを生成
            promotion_message = f"\n\n**🎉 昇進おめでとう！**\nあなたは **{next_job['name']} {next_job['emoji']}** に昇進しました！"
    
    _save_json_data(DATA_FILE, data)

    # 応答メッセージ
    embed = discord.Embed(
        title=f"{job_key} として働きました！",
        description=response_message + promotion_message,
        color=discord.Color.blue()
    )
    embed.add_field(name="現在の所持金", value=f"{CURRENCY_EMOJI} {player['gem_balance']}", inline=False)
    
    await interaction.response.send_message(embed=embed)


@bot.tree.command(name='balance', description='現在の所持金、職業、昇進状況を確認します')
async def balance_command(interaction: discord.Interaction):
    user_id = str(interaction.user.id)
    data = _load_json_data(DATA_FILE)
    
    # データがない場合は初期値を設定
    player = data.setdefault(user_id, {
        'gem_balance': 0, 
        'work_count': 0, 
        'last_work_time': 0, 
        'job_index': 0
    })
    _save_json_data(DATA_FILE, data)

    balance = player['gem_balance']
    work_count = player['work_count']
    job_index = player['job_index']
    
    current_job = JOB_HIERARCHY[job_index]
    
    # 次の職業情報を取得
    next_job_index = job_index + 1
    if next_job_index < len(JOB_HIERARCHY):
        next_job = JOB_HIERARCHY[next_job_index]
        required_works = next_job['required_works']
        remaining = required_works - work_count
        
        next_job_info = (f"次の昇進 ({next_job['name']} {next_job['emoji']}) まで: "
                         f"あと **{remaining}回** の仕事が必要です！")
    else:
        next_job_info = "あなたは最高の職業に就いています！"


    embed = discord.Embed(
        title=f"{CURRENCY_EMOJI} {interaction.user.display_name}さんの経済ステータス",
        color=discord.Color.gold()
    )
    embed.add_field(name="Gem残高", value=f"**{CURRENCY_EMOJI} {balance}**", inline=False)
    embed.add_field(name="現在の職業", value=f"**{current_job['name']} {current_job['emoji']}**", inline=True)
    embed.add_field(name="総仕事回数", value=f"**{work_count}回**", inline=True)
    embed.add_field(name="昇進状況", value=next_job_info, inline=False)
    
    await interaction.response.send_message(embed=embed)


@bot.tree.command(name='leaderboard', description='Gem所持金のランキングTOP10を表示します')
async def leaderboard_command(interaction: discord.Interaction):
    data = _load_json_data(DATA_FILE)
    
    # Gem残高に基づいてユーザーデータをソート
    leaderboard = []
    for user_id, user_data in data.items():
        try:
            user = bot.get_user(int(user_id))
            if user:
                leaderboard.append({
                    'name': user.display_name,
                    'balance': user_data.get('gem_balance', 0),
                    'job_index': user_data.get('job_index', 0)
                })
        except ValueError:
            continue # 無効なユーザーIDはスキップ
            
    # Gem残高で降順ソート
    leaderboard.sort(key=lambda x: x['balance'], reverse=True)

    embed = discord.Embed(
        title=f"👑 Gem所持金ランキング TOP {min(10, len(leaderboard))}",
        color=discord.Color.red()
    )
    
    if not leaderboard:
        embed.description = "まだ誰も働いていません！ /work コマンドを使って稼ぎましょう！"
    else:
        rank_text = []
        for i, entry in enumerate(leaderboard[:10]):
            job_name = JOB_HIERARCHY[entry['job_index']]['name']
            rank_text.append(
                f"**#{i+1}** {entry['name']} ({job_name})\n"
                f"└─ {CURRENCY_EMOJI} **{entry['balance']:,}**"
            )
        embed.description = "\n".join(rank_text)

    await interaction.response.send_message(embed=embed)


@bot.tree.command(name='setjob', description='[管理者専用] ユーザーの職業を手動で設定します')
@app_commands.describe(member="職業を設定するユーザー", job_rank="設定したい職業のランク (0, 1, 2, ...)")
@commands.has_permissions(administrator=True) # 管理者権限を持つユーザーのみ実行可能
async def setjob_command(interaction: discord.Interaction, member: discord.Member, job_rank: int):
    # 権限チェック
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("このコマンドを実行するには管理者権限が必要です。", ephemeral=True)
        return

    if not 0 <= job_rank < len(JOB_HIERARCHY):
        await interaction.response.send_message(
            f"指定された職業ランクは無効です。有効なランクは 0 から {len(JOB_HIERARCHY) - 1} です。", 
            ephemeral=True
        )
        return

    user_id = str(member.id)
    data = _load_json_data(DATA_FILE)
    
    player = data.setdefault(user_id, {
        'gem_balance': 0, 
        'work_count': 0, 
        'last_work_time': 0, 
        'job_index': 0
    })
    
    old_job = JOB_HIERARCHY[player['job_index']]
    new_job = JOB_HIERARCHY[job_rank]
    
    # 職業インデックスを更新
    player['job_index'] = job_rank
    
    _save_json_data(DATA_FILE, data)
    
    await interaction.response.send_message(
        f"✅ {member.display_name}さんの職業を**{old_job['name']}**から**{new_job['name']} {new_job['emoji']}**に変更しました。", 
        ephemeral=False
    )

# /setjobが管理者権限を持っていない場合に表示するエラーメッセージ
@setjob_command.error
async def setjob_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.MissingPermissions):
        await interaction.response.send_message("エラー: あなたにはこのコマンドを実行するための管理者権限がありません。", ephemeral=True)


# --------------------------

if __name__ == "__main__":
    from threading import Thread # スレッドをインポート (念のため)
    
    # サーバーを別スレッドで起動 (24時間稼働の維持)
    t = Thread(target=run_flask)
    t.start()
    
    # トークンを環境変数 'DISCORD_TOKEN' から安全に取得
    TOKEN = os.environ.get('DISCORD_TOKEN')
    
    if TOKEN:
        # トークンが取得できたら、それを使ってボットを起動
        bot.run(TOKEN)
    else:
        # トークンが設定されていない場合はエラーメッセージを出力
        print("Error: DISCORD_TOKEN 環境変数が設定されていません。Koyebの設定を確認してください。")
    
    pass
