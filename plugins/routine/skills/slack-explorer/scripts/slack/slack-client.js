/**
 * Slack API Client - Direct HTTP calls to Slack API.
 *
 * Uses browser tokens (xoxc/xoxd) for authentication.
 * Based on the approach used by slack-mcp-server and slack-monitor.
 *
 * Environment Variables:
 *   SLACK_XOXC_TOKEN - Slack xoxc token (required)
 *   SLACK_XOXD_TOKEN - Slack xoxd token (required)
 *   SLACK_USER_AGENT - Browser user agent string (optional)
 */

export class SlackClient {
  constructor(options = {}) {
    this.xoxcToken = options.xoxcToken || process.env.SLACK_XOXC_TOKEN;
    this.xoxdToken = options.xoxdToken || process.env.SLACK_XOXD_TOKEN;
    this.userAgent = options.userAgent || process.env.SLACK_USER_AGENT ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.debug = options.debug || false;

    // Validate tokens
    if (!this.xoxcToken || !this.xoxdToken) {
      throw new Error('Both SLACK_XOXC_TOKEN and SLACK_XOXD_TOKEN must be set');
    }
  }

  /**
   * Make a GET request to standard Slack API.
   */
  async _getRequest(endpoint, params = null) {
    const url = new URL(`https://slack.com/api/${endpoint}`);

    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          url.searchParams.append(key, params[key]);
        }
      });
    }

    const headers = {
      'User-Agent': this.userAgent,
      'Cookie': `d=${this.xoxdToken}`,
      'Authorization': `Bearer ${this.xoxcToken}`,
    };

    if (this.debug) {
      console.error(`[Slack] GET ${url.toString()}`);
    }

    const response = await fetch(url.toString(), { method: 'GET', headers });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      const error = data.error || 'Unknown error';
      if (this.debug) {
        console.error('[Slack] API response:', JSON.stringify(data, null, 2));
      }
      throw new Error(`Slack API error: ${error}`);
    }

    return data;
  }

  /**
   * Extract plain text from Slack message blocks.
   */
  _extractTextFromBlocks(blocks) {
    if (!blocks || !Array.isArray(blocks)) return '';

    const extractText = (element) => {
      if (typeof element === 'string') return element;
      if (element.text) return typeof element.text === 'string' ? element.text : extractText(element.text);
      if (element.elements && Array.isArray(element.elements)) {
        return element.elements.map(extractText).join('');
      }
      return '';
    };

    return blocks.map(block => {
      if (block.text) return extractText(block.text);
      if (block.elements && Array.isArray(block.elements)) {
        return block.elements.map(extractText).join('');
      }
      return '';
    }).join('\n').trim();
  }

  /**
   * Build a permalink for a message.
   */
  _buildPermalink(channelId, messageTs) {
    const tsForUrl = messageTs.replace('.', '');
    return `https://slack.com/archives/${channelId}/p${tsForUrl}`;
  }

  /**
   * Format a message for output.
   */
  _formatMessage(msg, channelId = null) {
    let text = msg.text || '';
    if (!text && msg.blocks) {
      text = this._extractTextFromBlocks(msg.blocks);
    }

    // Get channel info
    const channel = msg.channel || {};
    const channelName = channel.name || channelId || '';
    const isPrivate = channel.is_private || false;
    const effectiveChannelId = channel.id || channelId;

    // Format timestamp
    const msgTimestamp = parseFloat(msg.ts || 0);
    const readableTime = new Date(msgTimestamp * 1000).toISOString();

    // Extract thread_ts
    let threadTs = null;
    if (msg.thread_ts && msg.thread_ts !== msg.ts) {
      threadTs = msg.thread_ts;
    } else if (msg.permalink) {
      try {
        const url = new URL(msg.permalink);
        const threadParam = url.searchParams.get('thread_ts');
        if (threadParam) threadTs = threadParam;
      } catch { /* ignore */ }
    }

    // Build permalink if not present
    const permalink = msg.permalink || (effectiveChannelId ? this._buildPermalink(effectiveChannelId, msg.ts) : '');

    return {
      channel: isPrivate ? `🔒${channelName}` : channelName,
      channelId: effectiveChannelId,
      user: msg.user || msg.username || '',
      username: msg.username || '',
      ts: readableTime,
      messageTs: msg.ts,
      threadTs,
      text,
      permalink,
      reactions: msg.reactions || [],
      replyCount: msg.reply_count || 0,
      replyUsers: msg.reply_users || [],
    };
  }

  // ============================================================
  // Public API Methods
  // ============================================================

  /**
   * Search messages.
   *
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} options.channel - Filter by channel (name or ID)
   * @param {string} options.user - Filter by user
   * @param {number} options.days - Messages from last N days
   * @param {string} options.after - Messages after date (YYYY-MM-DD)
   * @param {string} options.before - Messages before date (YYYY-MM-DD)
   * @param {number} options.limit - Max results (default: 50)
   * @param {boolean} options.threadsOnly - Only return thread messages
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    const { channel, user, days, after, before, limit = 50, threadsOnly = false } = options;

    // Build search query
    let searchQuery = query || '*';

    if (channel) {
      // Handle both #channel-name and channel ID formats
      const channelFilter = channel.startsWith('#') ? channel : `<#${channel}>`;
      searchQuery += ` in:${channel.startsWith('#') ? channel.slice(1) : channel}`;
    }

    if (user) {
      const userFilter = user.startsWith('@') ? user.slice(1) : user;
      searchQuery += ` from:${userFilter}`;
    }

    if (days) {
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - days);
      searchQuery += ` after:${afterDate.toISOString().split('T')[0]}`;
    } else {
      if (after) searchQuery += ` after:${after}`;
      if (before) searchQuery += ` before:${before}`;
    }

    const messages = [];
    let page = 1;
    let totalPages = 1;
    let totalCount = 0;
    const perPage = Math.min(limit, 100);

    while (page <= totalPages && messages.length < limit) {
      const params = {
        query: searchQuery,
        count: perPage,
        sort: 'timestamp',
        sort_dir: 'desc',
        page: page.toString(),
      };

      const data = await this._getRequest('search.messages', params);
      const matches = data.messages?.matches || [];

      for (const msg of matches) {
        if (messages.length >= limit) break;

        // Filter threads if requested
        if (threadsOnly && !msg.thread_ts) continue;

        const formatted = this._formatMessage(msg);
        if (formatted.text || !query) { // Include empty text only if query is wildcard
          messages.push(formatted);
        }
      }

      totalPages = data.messages?.pagination?.page_count || 1;
      totalCount = data.messages?.pagination?.total_count || 0;
      if (matches.length === 0) break;
      page++;
    }

    return {
      ok: true,
      query: searchQuery,
      messages,
      total: totalCount || messages.length,
    };
  }

  /**
   * Get channel message history.
   *
   * @param {string} channelId - Channel ID
   * @param {Object} options - History options
   * @param {number} options.limit - Max messages (default: 50, or "7d" for days)
   * @param {string} options.oldest - Only messages after this timestamp
   * @param {string} options.latest - Only messages before this timestamp
   * @param {string|string[]} options.users - Filter by user ID(s)
   * @returns {Promise<Object>} Channel messages
   */
  async history(channelId, options = {}) {
    let { limit = 50, oldest, latest, users } = options;

    // Handle "Nd" format for days
    if (typeof limit === 'string' && limit.endsWith('d')) {
      const days = parseInt(limit.slice(0, -1), 10);
      oldest = (Date.now() / 1000 - days * 24 * 60 * 60).toString();
      limit = 1000; // High limit when filtering by days
    }

    // Normalize users to a Set for fast lookup
    let userFilter = null;
    if (users) {
      const userList = Array.isArray(users) ? users : users.split(',');
      userFilter = new Set(userList.map(u => u.trim()));
    }

    const params = {
      channel: channelId,
      limit: Math.min(limit, 200),
    };

    if (oldest) params.oldest = oldest;
    if (latest) params.latest = latest;

    const messages = [];
    let cursor = null;

    do {
      if (cursor) params.cursor = cursor;

      const data = await this._getRequest('conversations.history', params);

      for (const msg of data.messages || []) {
        if (messages.length >= limit) break;

        // Filter by users if specified
        if (userFilter && !userFilter.has(msg.user)) {
          continue;
        }

        messages.push(this._formatMessage(msg, channelId));
      }

      cursor = data.response_metadata?.next_cursor;
    } while (cursor && messages.length < limit);

    // Sort oldest first
    messages.sort((a, b) => parseFloat(a.messageTs) - parseFloat(b.messageTs));

    return {
      ok: true,
      channelId,
      messages,
    };
  }

  /**
   * Get thread replies.
   *
   * @param {string} channelId - Channel ID
   * @param {string} threadTs - Thread timestamp
   * @param {Object} options - Options
   * @param {number} options.limit - Max replies (default: 100)
   * @returns {Promise<Object>} Thread replies
   */
  async replies(channelId, threadTs, options = {}) {
    const { limit = 100 } = options;

    const params = {
      channel: channelId,
      ts: threadTs,
      limit: Math.min(limit, 200),
    };

    const messages = [];
    let cursor = null;

    do {
      if (cursor) params.cursor = cursor;

      const data = await this._getRequest('conversations.replies', params);

      for (const msg of data.messages || []) {
        if (messages.length >= limit) break;
        messages.push(this._formatMessage(msg, channelId));
      }

      cursor = data.response_metadata?.next_cursor;
    } while (cursor && messages.length < limit);

    return {
      ok: true,
      channelId,
      threadTs,
      messages,
    };
  }

  /**
   * List channels.
   *
   * @param {Object} options - Options
   * @param {string} options.types - Channel types (default: public_channel only)
   * @param {number} options.limit - Max channels (default: 100)
   * @returns {Promise<Object>} Channels list
   */
  async channels(options = {}) {
    const { types = 'public_channel', limit = 100 } = options;

    const params = {
      types,
      limit: Math.min(limit, 200),
      exclude_archived: true,
    };

    const channels = [];
    let cursor = null;

    do {
      if (cursor) params.cursor = cursor;

      const data = await this._getRequest('conversations.list', params);

      for (const ch of data.channels || []) {
        if (channels.length >= limit) break;
        channels.push({
          id: ch.id,
          name: ch.name || ch.user || ch.id,
          isPrivate: ch.is_private || false,
          isIm: ch.is_im || false,
          isMpim: ch.is_mpim || false,
          memberCount: ch.num_members || 0,
          topic: ch.topic?.value || '',
          purpose: ch.purpose?.value || '',
        });
      }

      cursor = data.response_metadata?.next_cursor;
    } while (cursor && channels.length < limit);

    return {
      ok: true,
      channels,
    };
  }

  /**
   * Get recent messages from all channels (via search).
   * Useful for getting an overview of recent activity.
   *
   * @param {Object} options - Options
   * @param {number} options.hours - Messages from last N hours (default: 1)
   * @param {number} options.limit - Max messages (default: 100)
   * @returns {Promise<Object>} Recent messages
   */
  async recent(options = {}) {
    const { hours = 1, limit = 100 } = options;

    const afterDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const afterStr = afterDate.toISOString().split('T')[0];

    return this.search('*', {
      after: afterStr,
      limit,
    });
  }

  /**
   * Get user information by user ID.
   *
   * @param {string} userId - Slack user ID (e.g., U012AB3CD45)
   * @returns {Promise<Object>} User info including id, name, real_name, display_name, email
   */
  async getUserInfo(userId) {
    const data = await this._getRequest('users.info', { user: userId });

    const user = data.user;
    return {
      ok: true,
      user: {
        id: user.id,
        name: user.name, // This is the username used in search (e.g., "jane.smith")
        realName: user.real_name || user.profile?.real_name || '',
        displayName: user.profile?.display_name || '',
        email: user.profile?.email || '',
        title: user.profile?.title || '',
        isBot: user.is_bot || false,
        deleted: user.deleted || false,
        timezone: user.tz || '',
      },
    };
  }

  /**
   * Get user information for multiple user IDs.
   *
   * @param {string[]} userIds - Array of Slack user IDs
   * @returns {Promise<Object>} Map of user ID to user info
   */
  async getUsersInfo(userIds) {
    const users = {};
    for (const userId of userIds) {
      try {
        const result = await this.getUserInfo(userId);
        users[userId] = result.user;
      } catch (error) {
        users[userId] = { id: userId, error: error.message };
      }
    }
    return { ok: true, users };
  }
}

export default SlackClient;
