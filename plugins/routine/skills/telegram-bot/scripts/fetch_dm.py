#!/usr/bin/env python3
"""Fetch the latest channel post from a Telegram channel via Bot API."""

import json
import os
import re
import sys
import urllib.request

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHANNEL_ID = os.environ.get("TELEGRAM_CHANNEL_ID")

if not BOT_TOKEN:
    print("Error: TELEGRAM_BOT_TOKEN not set", file=sys.stderr)
    sys.exit(1)

if not CHANNEL_ID:
    print("Error: TELEGRAM_CHANNEL_ID not set", file=sys.stderr)
    sys.exit(1)

url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates?timeout=0"
req = urllib.request.Request(url)

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())

if not data.get("ok"):
    print(f"Error: Telegram API returned: {data}", file=sys.stderr)
    sys.exit(1)

# Filter for channel posts from our channel, take the latest one
channel_posts = []
for update in data["result"]:
    msg = update.get("channel_post")
    if msg and str(msg.get("chat", {}).get("id")) == CHANNEL_ID:
        channel_posts.append(msg)

if not channel_posts:
    print("No channel posts found.", file=sys.stderr)
    sys.exit(1)

latest = channel_posts[-1]
text = latest.get("text", "")
# Strip leading @BotName mention
text = re.sub(r"^@\S+\s*", "", text)
print(text)
