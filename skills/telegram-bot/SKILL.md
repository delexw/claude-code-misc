---
name: telegram-bot
description: >
  Interact with Telegram — read messages from your channel and send messages back.
  Use this skill whenever the user mentions Telegram, wants to check messages, send to
  a channel, reply via Telegram, or any Telegram bot interaction — even if they just
  say "check Telegram", "send to channel", or "message Telegram".
---

# Telegram Bot

Two scripts for Telegram bot interaction:

## 1. Fetch latest channel message

Reads the most recent post from your Telegram channel.

```bash
python3 <skill-dir>/scripts/fetch_dm.py
```

Requires: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`

## 2. Send message to channel

Posts a message to your Telegram channel.

```bash
python3 <skill-dir>/scripts/send_channel.py "Your message here"
```

Supports HTML formatting (`<b>`, `<i>`, `<code>`, `<a href="...">`).

Requires: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`
