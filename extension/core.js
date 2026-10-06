/* Pure helpers. No network, account, or chat-message access. */
(() => {
  'use strict';
  const HEADER_HEIGHT = 36;
  const DEFAULTS = Object.freeze({mode: 'auto', width: 960, height: 620});
  const MODES = Object.freeze(['auto', 'side', 'bottom', 'hide']);
  const RESERVED = new Set(['directory','downloads','jobs','p','search','settings','subscriptions','turbo','wallet','videos','clips','inventory','drops','friends','messages','moderator','dashboard','login','logout','signup','activate','embed','popout','products','store','prime','collections','following','browse','teams']);
  function channelName(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9_]{1,25}$/.test(value) ? value.toLowerCase() : null;
  }
  function parseLocation(value) {
    let url;
    try { url = new URL(value); } catch { return null; }
    if (url.protocol !== 'https:') return null;
    if (url.hostname === 'player.twitch.tv') {
      const channel = channelName(url.searchParams.get('channel'));
      return channel ? {channel, popout: true, hostname: url.hostname} : null;
    }
    if (url.hostname !== 'www.twitch.tv') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    // /popout/<channel>/chat is chat-only, never a player.
    const channel = channelName(parts[0]);
    if (!channel || RESERVED.has(channel)) return null;
    if (parts.length === 1) return {channel, popout: false, hostname: url.hostname};
    if (parts.length === 2 && parts[1] === 'popout') return {channel, popout: true, hostname: url.hostname};
    return null;
  }
  function clamp(value, min, max, fallback) {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  }
  function settings(value) {
    const v = value && typeof value === 'object' ? value : {};
    return {mode: MODES.includes(v.mode) ? v.mode : DEFAULTS.mode,
      width: clamp(v.width, 420, 1920, DEFAULTS.width), height: clamp(v.height, 360, 1200, DEFAULTS.height)};
  }
  function layout(mode, width, height) {
    const selected = MODES.includes(mode) ? mode : 'auto';
    // Keep official chat wide enough; do not switch modes from live content size.
    if (selected === 'hide') return {mode: 'hide', chat: 0};
    const actual = selected === 'auto' ? (width >= 780 && width / height >= 1.25 ? 'side' : 'bottom') : selected;
    const chat = actual === 'side' ? clamp(width * 0.33, 260, 360, 300) : clamp(height * 0.43, 180, 380, 260);
    return {mode: actual, chat};
  }
  function chatURL(channel, hostname) {
    if (!channelName(channel) || !['www.twitch.tv','player.twitch.tv'].includes(hostname)) throw new TypeError('Invalid Twitch embed target');
    const url = new URL(`https://www.twitch.tv/embed/${channelName(channel)}/chat`);
    url.searchParams.set('parent', hostname);
    url.searchParams.set('darkpopout', '');
    return url.href;
  }
  function chatPopoutURL(channel) {
    if (!channelName(channel)) throw new TypeError('Invalid Twitch channel');
    return `https://www.twitch.tv/popout/${channelName(channel)}/chat?popout=`;
  }
  const core = {HEADER_HEIGHT, DEFAULTS, MODES, channelName, parseLocation, settings, layout, chatURL, chatPopoutURL};
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else globalThis.TCCCore = Object.freeze(core);
})();
