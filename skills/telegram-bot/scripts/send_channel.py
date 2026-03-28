#!/usr/bin/env python3
"""Send a message to a Telegram channel via Bot API."""

import json
import os
import sys
import urllib.request

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHANNEL_ID")

if not BOT_TOKEN:
    print("Error: TELEGRAM_BOT_TOKEN not set", file=sys.stderr)
    sys.exit(1)

if not CHAT_ID:
    print("Error: TELEGRAM_CHANNEL_ID not set", file=sys.stderr)
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: send_channel.py <message>", file=sys.stderr)
    sys.exit(1)

text = " ".join(sys.argv[1:])

payload = json.dumps({
    "chat_id": CHAT_ID,
    "text": text,
    "parse_mode": "HTML",
}).encode()

req = urllib.request.Request(
    f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
    data=payload,
    headers={"Content-Type": "application/json"},
)

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read())

if not data.get("ok"):
    print(f"Error: Telegram API returned: {data}", file=sys.stderr)
    sys.exit(1)

print(f"Message sent (id: {data['result']['message_id']})")
