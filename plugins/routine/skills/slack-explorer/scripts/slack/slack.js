#!/usr/bin/env node
/**
 * Slack CLI - Direct API access to Slack.
 *
 * Usage:
 *   node slack.js search <query> [options]
 *   node slack.js history --channel <id> [options]
 *   node slack.js replies --channel <id> --thread <ts> [options]
 *   node slack.js channels [options]
 *   node slack.js recent [options]
 *
 * Environment Variables:
 *   SLACK_XOXC_TOKEN - Slack xoxc token (required)
 *   SLACK_XOXD_TOKEN - Slack xoxd token (required)
 *
 * Examples:
 *   node slack.js search "quarterly report" --channel "#general" --days 7
 *   node slack.js history --channel C1234567890 --limit 50
 *   node slack.js replies --channel C1234567890 --thread 1234567890.123456
 *   node slack.js channels --types public_channel --limit 100
 *   node slack.js recent --hours 24
 */

import { SlackClient } from './slack-client.js';
import { extractTokens } from './extract-tokens.js';

// Parse command line arguments
function parseArgs(args) {
  const result = {
    command: null,
    query: null,
    options: {},
    flags: {
      json: false,
      debug: false,
      help: false,
    },
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--json') {
      result.flags.json = true;
    } else if (arg === '--debug') {
      result.flags.debug = true;
    } else if (arg === '--help' || arg === '-h') {
      result.flags.help = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[++i];
      // Try to parse as number or boolean
      if (value === 'true') result.options[key] = true;
      else if (value === 'false') result.options[key] = false;
      else if (/^\d+$/.test(value)) result.options[key] = parseInt(value, 10);
      else result.options[key] = value;
    } else if (!result.command) {
      result.command = arg;
    } else if (!result.query) {
      result.query = arg;
    }
    i++;
  }

  return result;
}

// Extract all <@UXXXXX> user IDs mentioned in message texts
function extractMentionedUserIds(messages) {
  const ids = new Set();
  for (const msg of messages) {
    const matches = (msg.text || '').matchAll(/<@(U[A-Z0-9]+)>/g);
    for (const m of matches) ids.add(m[1]);
  }
  return [...ids];
}

// Replace <@UXXXXX> mentions with @displayName using a resolved user map
function resolveUserMentions(text, userMap) {
  return text.replace(/<@(U[A-Z0-9]+)>/g, (_, id) => {
    const u = userMap[id];
    if (!u || u.error) return `<@${id}>`;
    return `@${u.displayName || u.name || id}`;
  });
}

// Format messages as readable text
function formatMessagesAsText(messages, userMap = {}) {
  if (!messages || messages.length === 0) {
    return 'No messages found.';
  }

  const lines = [];
  for (const msg of messages) {
    const header = `[${msg.ts}] ${msg.channel ? `#${msg.channel}` : ''} ${msg.user || msg.username}:`;
    lines.push(header);
    lines.push(resolveUserMentions(msg.text || '(no text)', userMap));
    if (msg.permalink) lines.push(`  → ${msg.permalink}`);
    if (msg.replyCount > 0) lines.push(`  💬 ${msg.replyCount} replies`);
    if (msg.reactions?.length > 0) {
      const reactionStr = msg.reactions.map(r => `${r.name}(${r.count})`).join(' ');
      lines.push(`  ${reactionStr}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Resolve all user mentions in a message list, returns a userMap
async function resolveMessageMentions(client, messages) {
  const ids = extractMentionedUserIds(messages);
  if (ids.length === 0) return {};
  const result = await client.getUsersInfo(ids);
  return result.users || {};
}

// Format channels as readable text
function formatChannelsAsText(channels) {
  if (!channels || channels.length === 0) {
    return 'No channels found.';
  }

  const lines = [];
  for (const ch of channels) {
    const prefix = ch.isPrivate ? '🔒' : '#';
    const members = ch.memberCount ? ` (${ch.memberCount} members)` : '';
    lines.push(`${prefix}${ch.name} [${ch.id}]${members}`);
    if (ch.purpose) lines.push(`  ${ch.purpose}`);
  }

  return lines.join('\n');
}

// Print help
function printHelp() {
  console.log(`
Slack CLI - Direct API access to Slack

USAGE:
  node slack.js <command> [arguments] [options]

COMMANDS:
  search <query>    Search messages
  history           Get channel message history
  replies           Get thread replies
  channels          List channels
  recent            Get recent messages from all channels
  user <id(s)>      Get user info by ID (single or comma-separated)

SEARCH OPTIONS:
  --channel <name>  Filter by channel (#name or ID)
  --user <username> Filter by Slack username (e.g., @jane.smith, NOT user ID)
  --days <n>        Messages from last N days
  --after <date>    Messages after date (YYYY-MM-DD)
  --before <date>   Messages before date (YYYY-MM-DD)
  --limit <n>       Max results (default: 50)
  --threads-only    Only return thread messages

HISTORY OPTIONS:
  --channel <id>    Channel name (#name) or ID — names are resolved automatically
  --channels <ids>  Multiple channel names/IDs, comma-separated
  --limit <n>       Max messages (default: 50, or "7d" for days)
  --oldest <ts>     Only messages after this timestamp
  --latest <ts>     Only messages before this timestamp
  --users <ids>     Filter by user ID(s), comma-separated

REPLIES OPTIONS:
  --channel <id>    Channel ID (required)
  --thread <ts>     Thread timestamp (required)
  --limit <n>       Max replies (default: 100)

CHANNELS OPTIONS:
  --types <types>   Channel types: public_channel,private_channel,mpim,im
  --limit <n>       Max channels (default: 100)

RECENT OPTIONS:
  --hours <n>       Messages from last N hours (default: 1)
  --limit <n>       Max messages (default: 100)

GLOBAL OPTIONS:
  --json            Output as JSON
  --debug           Enable debug output
  --help, -h        Show this help

EXAMPLES:
  # Search for messages
  node slack.js search "quarterly report"
  node slack.js search "deploy" --channel "#engineering" --days 7
  node slack.js search --user "@jane.smith" --days 7  # Use Slack username, not ID

  # Get channel history
  node slack.js history --channel C1234567890 --limit 50
  node slack.js history --channel D1234567890 --limit 20
  node slack.js history --channel C1234567890 --limit 7d --users U123,U456
  node slack.js history --channels C123,C456,C789 --limit 7d --users U123,U456

  # Get thread replies
  node slack.js replies --channel C1234567890 --thread 1234567890.123456

  # List channels
  node slack.js channels --types public_channel --limit 50

  # Get recent messages
  node slack.js recent --hours 24 --limit 100

  # Get user info
  node slack.js user U012AB3CD45
  node slack.js user U012AB3CD45,U012EF6GH78,U012IJ9KL01 --json

ENVIRONMENT:
  Tokens are extracted automatically from the macOS Keychain (Slack Safe Storage).
  Slack must be installed and signed in.
`);
}

// Main
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags.help || !args.command) {
    printHelp();
    process.exit(args.flags.help ? 0 : 1);
  }

  let client;
  try {
    const workspace = args.options.workspace || process.env.SLACK_WORKSPACE || process.env.ENVATO_SLACK_WORKSPACE;
    const { xoxc, xoxd } = await extractTokens(workspace);
    client = new SlackClient({ xoxcToken: xoxc, xoxdToken: xoxd, debug: args.flags.debug });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  try {
    let result;

    switch (args.command) {
      case 'search': {
        const { channel, user, days, after, before, limit, threadsOnly } = args.options;
        result = await client.search(args.query || '*', {
          channel,
          user,
          days,
          after,
          before,
          limit,
          threadsOnly,
        });

        if (args.flags.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          const userMap = await resolveMessageMentions(client, result.messages);
          console.log(`Search: "${result.query}" (${result.messages.length} results)\n`);
          console.log(formatMessagesAsText(result.messages, userMap));
        }
        break;
      }

      case 'history': {
        const { channel, channels, limit, oldest, latest, users } = args.options;

        // Support both --channel (single) and --channels (multiple, comma-separated)
        let channelList = [];
        if (channels) {
          channelList = channels.split(',').map(c => c.trim());
        } else if (channel) {
          channelList = [channel];
        }

        if (channelList.length === 0) {
          console.error('Error: --channel or --channels is required for history command');
          process.exit(1);
        }

        // Fetch from all channels
        const allMessages = [];
        const channelResults = [];

        for (const ch of channelList) {
          const channelResult = await client.history(ch, { limit, oldest, latest, users });
          channelResults.push({ channelId: ch, count: channelResult.messages.length });
          allMessages.push(...channelResult.messages);
        }

        // Sort all messages by timestamp (oldest first)
        allMessages.sort((a, b) => parseFloat(a.messageTs) - parseFloat(b.messageTs));

        result = {
          ok: true,
          channels: channelResults,
          messages: allMessages,
        };

        if (args.flags.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          const userMap = await resolveMessageMentions(client, allMessages);
          if (channelList.length === 1) {
            console.log(`Channel: ${channelList[0]} (${allMessages.length} messages)\n`);
          } else {
            console.log(`Channels: ${channelList.length} (${allMessages.length} messages total)\n`);
            for (const cr of channelResults) {
              console.log(`  ${cr.channelId}: ${cr.count} messages`);
            }
            console.log('');
          }
          console.log(formatMessagesAsText(allMessages, userMap));
        }
        break;
      }

      case 'replies': {
        const { channel, thread, limit } = args.options;
        if (!channel || !thread) {
          console.error('Error: --channel and --thread are required for replies command');
          process.exit(1);
        }

        result = await client.replies(channel, thread, { limit });

        if (args.flags.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          const userMap = await resolveMessageMentions(client, result.messages);
          console.log(`Thread: ${channel} @ ${thread} (${result.messages.length} messages)\n`);
          console.log(formatMessagesAsText(result.messages, userMap));
        }
        break;
      }

      case 'channels': {
        const { types, limit } = args.options;
        result = await client.channels({ types, limit });

        if (args.flags.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Channels (${result.channels.length}):\n`);
          console.log(formatChannelsAsText(result.channels));
        }
        break;
      }

      case 'recent': {
        const { hours, limit } = args.options;
        result = await client.recent({ hours, limit });

        if (args.flags.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          const userMap = await resolveMessageMentions(client, result.messages);
          console.log(`Recent messages (last ${hours || 1} hours, ${result.messages.length} results)\n`);
          console.log(formatMessagesAsText(result.messages, userMap));
        }
        break;
      }

      case 'user': {
        // Get user info - query can be a single user ID or comma-separated list
        const userIds = args.query ? args.query.split(',').map(id => id.trim()) : [];
        if (userIds.length === 0) {
          console.error('Error: user ID(s) required. Usage: node slack.js user U12345 or node slack.js user U123,U456,U789');
          process.exit(1);
        }

        if (userIds.length === 1) {
          result = await client.getUserInfo(userIds[0]);
          if (args.flags.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            const u = result.user;
            console.log(`User: ${u.id}`);
            console.log(`  Username:     ${u.name}`);
            console.log(`  Real Name:    ${u.realName}`);
            console.log(`  Display Name: ${u.displayName}`);
            console.log(`  Email:        ${u.email}`);
            if (u.title) console.log(`  Title:        ${u.title}`);
          }
        } else {
          result = await client.getUsersInfo(userIds);
          if (args.flags.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(`Users (${Object.keys(result.users).length}):\n`);
            for (const [id, u] of Object.entries(result.users)) {
              if (u.error) {
                console.log(`${id}: ERROR - ${u.error}`);
              } else {
                console.log(`${id}: ${u.name} (${u.realName})`);
              }
            }
          }
        }
        break;
      }

      default:
        console.error(`Unknown command: ${args.command}`);
        console.error('Run with --help to see available commands');
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    if (args.flags.json) {
      console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

main();
