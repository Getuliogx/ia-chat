'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TWITCH_SESSION_FILE = path.join(DATA_DIR, 'twitch.session.json');
const DEFAULT_CONFIG_FILE = path.join(DATA_DIR, 'config.default.json');
const PORT = Number(process.env.PORT || 8080);
const CHANNEL_NAME = String(process.env.CHANNEL_NAME || 'icarolinaporto').trim().toLowerCase();
const BOT_DISPLAY_NAME = String(process.env.BOT_DISPLAY_NAME || 'icarolzinhabot').trim();
const PANEL_KEY = String(process.env.PANEL_KEY || '').trim();
const TIMER_KEY = String(process.env.TIMER_KEY || '').trim();
const TWITCH_CLIENT_ID = String(process.env.TWITCH_CLIENT_ID || '').trim();
const TWITCH_CLIENT_SECRET = String(process.env.TWITCH_CLIENT_SECRET || '').trim();
const ENV_REFRESH_TOKEN = String(process.env.TWITCH_REFRESH_TOKEN || '').trim();
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
const RENDER_API_KEY = String(process.env.RENDER_API_KEY || '').trim();
const RENDER_SERVICE_ID = String(process.env.RENDER_SERVICE_ID || '').trim();

fs.mkdirSync(DATA_DIR, { recursive: true });

const PRESETS = {
  suave: {
    joy: 82, sarcasm: 8, irritation: 3, energy: 38, chaos: 5, empathy: 92, memes: 20,
    sensuality: 8, naughtiness: 3, profanity: 0, adultFlirt: false,
    customPersonality: 'Doce, simpática e acolhedora. Sem flerte.'
  },
  normal: {
    joy: 68, sarcasm: 32, irritation: 10, energy: 62, chaos: 25, empathy: 70, memes: 50,
    sensuality: 18, naughtiness: 12, profanity: 1, adultFlirt: false,
    customPersonality: 'Natural, divertida e espontânea.'
  },
  zueira: {
    joy: 78, sarcasm: 66, irritation: 20, energy: 84, chaos: 58, empathy: 52, memes: 88,
    sensuality: 28, naughtiness: 30, profanity: 1, adultFlirt: false,
    customPersonality: 'Zoeira, memes e deboche leve. Não humilhe ninguém.'
  },
  sensual: {
    joy: 80, sarcasm: 42, irritation: 8, energy: 72, chaos: 32, empathy: 68, memes: 52,
    sensuality: 82, naughtiness: 48, profanity: 1, adultFlirt: true,
    customPersonality: 'Charmosa e sensual, com flerte adulto leve, elogios e duplo sentido discreto.'
  },
  safadinha: {
    joy: 78, sarcasm: 58, irritation: 12, energy: 78, chaos: 48, empathy: 58, memes: 72,
    sensuality: 76, naughtiness: 72, profanity: 1, adultFlirt: true,
    customPersonality: 'Provocante, atrevida e brincalhona. Use flerte e duplo sentido leve sem ser explícita.'
  },
  insana: {
    joy: 72, sarcasm: 82, irritation: 42, energy: 96, chaos: 82, empathy: 34, memes: 94,
    sensuality: 48, naughtiness: 58, profanity: 2, adultFlirt: true,
    customPersonality: 'Dramática, acelerada, debochada e imprevisível.'
  },
  caos: {
    joy: 68, sarcasm: 92, irritation: 56, energy: 100, chaos: 98, empathy: 24, memes: 100,
    sensuality: 55, naughtiness: 68, profanity: 2, adultFlirt: true,
    customPersonality: 'Caos cômico pesado, respostas absurdas e imprevisíveis, mas sem assédio ou conteúdo sexual explícito.'
  }
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function safeWriteJson(file, value) {
  try {
    fs.writeFileSync(file, JSON.stringify(value, null, 2), { mode: 0o600 });
    return true;
  } catch (err) {
    console.error('[persist]', err.message);
    return false;
  }
}

const defaultConfig = readJson(DEFAULT_CONFIG_FILE, {});
const diskState = readJson(STATE_FILE, null);
let config = { ...defaultConfig, ...(diskState?.config || {}), channelName: CHANNEL_NAME };
let configVersion = Number(diskState?.version || 0);

const runtime = {
  messagesSeen: 0,
  messagesAccepted: 0,
  promptsServed: 0,
  suppressed: 0,
  queue: [],
  pending: null,
  recentAnsweredUsers: new Map(),
  recentMessageIds: new Set(),
  lastCandidateAt: null,
  lastAiDispatchAt: 0,
  twitch: {
    status: 'desconectado',
    lastError: null,
    connectedAt: null,
    lastMessageAt: null,
    sessionId: null,
    broadcasterId: null,
    authorizedUserId: null,
    authorizedLogin: null,
    authorizedDisplayName: null,
    subscriptionId: null,
    reconnects: 0,
    refreshTokenPersistence: RENDER_API_KEY && RENDER_SERVICE_ID ? 'Render API' : 'manual'
  }
};

const tokenState = {
  accessToken: '',
  refreshToken: '',
  expiresAt: 0,
  userId: '',
  login: '',
  displayName: ''
};

let eventSubSocket = null;
let reconnectTimer = null;
let keepaliveTimer = null;
let eventSubStarting = false;

function persistConfig() {
  safeWriteJson(STATE_FILE, { version: configVersion, config });
}

function persistTwitchSession() {
  if (!tokenState.refreshToken) return;
  safeWriteJson(TWITCH_SESSION_FILE, {
    refreshToken: tokenState.refreshToken,
    userId: tokenState.userId,
    login: tokenState.login,
    displayName: tokenState.displayName
  });
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizeConfig(input = {}) {
  const base = { ...defaultConfig, ...config };
  const str = (v, max, fb) => typeof v === 'string' ? v.trim().slice(0, max) : fb;
  const bool = (v, fb) => typeof v === 'boolean' ? v : fb;
  const preset = Object.prototype.hasOwnProperty.call(PRESETS, input.preset) ? input.preset : base.preset;
  const responseLength = ['short', 'medium'].includes(input.responseLength) ? input.responseLength : base.responseLength;
  const ignoreUsers = Array.isArray(input.ignoreUsers)
    ? [...new Set(input.ignoreUsers.map(x => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 100)
    : (base.ignoreUsers || []);

  return {
    ...base,
    enabled: bool(input.enabled, base.enabled),
    aiName: str(input.aiName, 30, base.aiName) || 'CarolIA',
    channelName: CHANNEL_NAME,
    preset,
    joy: clampInt(input.joy, 0, 100, base.joy),
    sarcasm: clampInt(input.sarcasm, 0, 100, base.sarcasm),
    irritation: clampInt(input.irritation, 0, 100, base.irritation),
    energy: clampInt(input.energy, 0, 100, base.energy),
    chaos: clampInt(input.chaos, 0, 100, base.chaos),
    empathy: clampInt(input.empathy, 0, 100, base.empathy),
    memes: clampInt(input.memes, 0, 100, base.memes),
    sensuality: clampInt(input.sensuality, 0, 100, base.sensuality),
    naughtiness: clampInt(input.naughtiness, 0, 100, base.naughtiness),
    profanity: clampInt(input.profanity, 0, 3, base.profanity),
    responseLength,
    mentionUser: bool(input.mentionUser, base.mentionUser),
    answerChance: clampInt(input.answerChance, 0, 100, base.answerChance),
    cooldownSeconds: clampInt(input.cooldownSeconds, 0, 600, base.cooldownSeconds),
    maxQueueAgeSeconds: clampInt(input.maxQueueAgeSeconds, 15, 900, base.maxQueueAgeSeconds),
    queueSize: clampInt(input.queueSize, 5, 200, base.queueSize),
    minMessageChars: clampInt(input.minMessageChars, 1, 80, base.minMessageChars),
    ignoreCommands: bool(input.ignoreCommands, base.ignoreCommands),
    ignoreBroadcaster: bool(input.ignoreBroadcaster, base.ignoreBroadcaster),
    ignoreBots: bool(input.ignoreBots, base.ignoreBots),
    preferQuestions: bool(input.preferQuestions, base.preferQuestions),
    preferMentions: bool(input.preferMentions, base.preferMentions),
    preferFlirtyMessages: bool(input.preferFlirtyMessages, base.preferFlirtyMessages),
    adultFlirt: bool(input.adultFlirt, base.adultFlirt),
    ignoreUsers,
    customPersonality: str(input.customPersonality, 220, base.customPersonality)
  };
}

function setConfig(next) {
  config = sanitizeConfig(next);
  configVersion = Date.now();
  persistConfig();
  return config;
}

function normalizeText(value) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function utf8Bytes(text) { return Buffer.byteLength(String(text || ''), 'utf8'); }

function truncateUtf8(text, maxBytes) {
  let out = normalizeText(text);
  if (utf8Bytes(out) <= maxBytes) return out;
  while (out.length && utf8Bytes(out + '…') > maxBytes) out = out.slice(0, -1);
  return out.trimEnd() + '…';
}

function isIgnored(username) {
  const u = String(username || '').toLowerCase();
  if (!u) return true;
  if ((config.ignoreUsers || []).includes(u)) return true;
  if (config.ignoreBroadcaster && u === CHANNEL_NAME) return true;
  if (config.ignoreBots && (u === BOT_DISPLAY_NAME.toLowerCase() || u === 'streamelements')) return true;
  return false;
}

function looksLikeOnlyEmotes(text) {
  const stripped = normalizeText(text)
    .replace(/[:;=8xX][\-^']?[)(/\\DPpOo3<>]+/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/[A-Z0-9_]{2,30}/g, '')
    .replace(/\s+/g, '');
  return stripped.length === 0;
}

function scoreMessage(username, text, badges = []) {
  let score = 1;
  const lower = text.toLowerCase();
  if (config.preferQuestions && /\?|\b(quem|como|quando|onde|por que|porque|qual|quais|acha|acham|será|sera)\b/i.test(text)) score += 4;
  if (config.preferMentions && (lower.includes('carol') || lower.includes(CHANNEL_NAME) || lower.includes(String(config.aiName || '').toLowerCase()))) score += 4;
  if (config.preferFlirtyMessages && /\b(linda|gata|gatinha|beijo|beijinho|amor|mozão|mozao|crush|solteira|namora|casada|delícia|delicia|bonita)\b/i.test(text)) score += 3;
  if (/\b(kkkk+|rsrs+|haha+|lol|mds|meu deus|socorro)\b/i.test(text)) score += 1;
  if (badges.some(b => ['subscriber', 'vip', 'moderator'].includes(String(b?.set_id || b?.type || '').toLowerCase()))) score += 1;
  const answeredAt = runtime.recentAnsweredUsers.get(String(username).toLowerCase()) || 0;
  if (Date.now() - answeredAt < 5 * 60 * 1000) score -= 2;
  return score;
}

function rememberMessageId(id) {
  if (!id) return false;
  if (runtime.recentMessageIds.has(id)) return true;
  runtime.recentMessageIds.add(id);
  if (runtime.recentMessageIds.size > 500) {
    const first = runtime.recentMessageIds.values().next().value;
    runtime.recentMessageIds.delete(first);
  }
  return false;
}

function acceptChatMessage(data = {}) {
  runtime.messagesSeen++;
  const username = String(data.username || '').trim();
  const displayName = String(data.displayName || username).trim();
  const text = normalizeText(data.text || '');
  const id = String(data.id || '');
  if (rememberMessageId(id)) return false;
  if (!username || !text) return false;
  if (isIgnored(username)) return false;
  if (config.ignoreCommands && /^[!/.]/.test(text)) return false;
  if (text.length < Number(config.minMessageChars || 1)) return false;
  if (looksLikeOnlyEmotes(text)) return false;

  const item = {
    id: id || crypto.randomUUID(),
    username: username.toLowerCase(),
    displayName: displayName || username,
    text,
    badges: Array.isArray(data.badges) ? data.badges : [],
    receivedAt: Date.now(),
    score: scoreMessage(username, text, Array.isArray(data.badges) ? data.badges : [])
  };

  runtime.queue.push(item);
  runtime.messagesAccepted++;
  runtime.lastCandidateAt = new Date(item.receivedAt).toISOString();
  const max = Math.max(5, Number(config.queueSize || 50));
  if (runtime.queue.length > max) runtime.queue.splice(0, runtime.queue.length - max);
  return true;
}

function purgeQueue() {
  const cutoff = Date.now() - Number(config.maxQueueAgeSeconds || 180) * 1000;
  runtime.queue = runtime.queue.filter(m => m.receivedAt >= cutoff);
  if (runtime.pending && runtime.pending.expiresAt < Date.now()) runtime.pending = null;
}

function chooseCandidate() {
  purgeQueue();
  if (!runtime.queue.length) return null;
  const sorted = [...runtime.queue].sort((a, b) => (b.score - a.score) || (b.receivedAt - a.receivedAt));
  const topScore = sorted[0].score;
  const top = sorted.filter(x => x.score >= topScore - 1).slice(0, 5);
  const picked = top[Math.floor(Math.random() * top.length)];
  runtime.queue = runtime.queue.filter(x => x.id !== picked.id);
  return picked;
}

function shouldDispatch() {
  purgeQueue();
  if (!config.enabled) return false;
  if (!runtime.queue.length && !runtime.pending) return false;
  if (Date.now() - runtime.lastAiDispatchAt < Number(config.cooldownSeconds || 0) * 1000) return false;
  if (Math.random() * 100 >= Number(config.answerChance || 0)) return false;
  return true;
}

function lockCandidate() {
  if (runtime.pending && runtime.pending.expiresAt > Date.now()) return runtime.pending.item;
  const item = chooseCandidate();
  if (!item) return null;
  runtime.pending = { item, expiresAt: Date.now() + 30_000 };
  return item;
}

function buildPrompt(item) {
  const who = config.mentionUser ? `@${item.displayName}` : item.displayName;
  const lengthText = config.responseLength === 'medium' ? 'até 2 frases' : '1 frase curta';
  const profanity = ['sem palavrão', 'palavrão leve', 'palavrão moderado', 'palavrão forte sem atacar'][Number(config.profanity || 0)];
  const flirt = config.adultFlirt
    ? `sensual ${config.sensuality}/100, atrevida ${config.naughtiness}/100; flerte adulto e duplo sentido leve quando couber`
    : 'sem flerte sexual';

  const head = `PT-BR. Você é ${config.aiName}, IA do chat de ${CHANNEL_NAME}. Responda ${who}: "`;
  const tailRaw = `". ${lengthText}; alegre ${config.joy}, sarcástica ${config.sarcasm}, energia ${config.energy}, caos ${config.chaos}, memes ${config.memes}; ${flirt}; ${profanity}. ${config.customPersonality} Nunca sexo explícito, assédio, menores, ódio ou ameaça.`;
  const tail = truncateUtf8(tailRaw, 238);
  const room = Math.max(32, 388 - utf8Bytes(head) - utf8Bytes(tail));
  const msg = truncateUtf8(item.text.replace(/"/g, "'"), room);
  return truncateUtf8(head + msg + tail, 388);
}

function publicBase(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  if (process.env.RENDER_EXTERNAL_HOSTNAME) return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  const proto = String(req?.get?.('x-forwarded-proto') || req?.protocol || 'http').split(',')[0].trim();
  const host = req?.get?.('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function callbackUrl(req) { return `${publicBase(req)}/auth/twitch/callback`; }

function timerLine(req) {
  const base = publicBase(req);
  const key = encodeURIComponent(TIMER_KEY);
  return `$(if $(customapi ${base}/should?key=${key}) $(ai $(customapi ${base}/prompt?key=${key})))`;
}

function panelAuth(req, res, next) {
  const key = req.get('X-Panel-Key') || req.query.panelKey || '';
  if (!PANEL_KEY || key !== PANEL_KEY) return res.status(401).json({ error: 'Senha do painel inválida.' });
  next();
}

function timerAuth(req, res, next) {
  if (!TIMER_KEY || String(req.query.key || '') !== TIMER_KEY) return res.status(200).type('text/plain').send('0');
  next();
}

function b64url(input) { return Buffer.from(input).toString('base64url'); }
function hmac(input) { return crypto.createHmac('sha256', PANEL_KEY || 'carolia').update(input).digest('base64url'); }

function makeOauthState() {
  const payload = `${Date.now()}.${crypto.randomBytes(16).toString('hex')}`;
  return `${b64url(payload)}.${hmac(payload)}`;
}

function verifyOauthState(state) {
  try {
    const [encoded, sig] = String(state || '').split('.');
    const payload = Buffer.from(encoded, 'base64url').toString('utf8');
    const expected = hmac(payload);
    if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const [ts] = payload.split('.');
    return Date.now() - Number(ts) < 15 * 60 * 1000;
  } catch { return false; }
}

async function rawFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function exchangeCodeForToken(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  });
  const data = await rawFetchJson('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  setTokenData(data);
  return data;
}

async function persistRefreshTokenToRender() {
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID || !tokenState.refreshToken) return false;
  try {
    await rawFetchJson(`https://api.render.com/v1/services/${encodeURIComponent(RENDER_SERVICE_ID)}/env-vars/TWITCH_REFRESH_TOKEN`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: tokenState.refreshToken })
    });
    runtime.twitch.refreshTokenPersistence = 'Render API ✅';
    return true;
  } catch (err) {
    runtime.twitch.refreshTokenPersistence = `Render API falhou: ${err.message}`;
    console.error('[render token persist]', err.message);
    return false;
  }
}

function setTokenData(data) {
  tokenState.accessToken = String(data.access_token || tokenState.accessToken || '');
  tokenState.refreshToken = String(data.refresh_token || tokenState.refreshToken || '');
  tokenState.expiresAt = Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
  persistTwitchSession();
  persistRefreshTokenToRender().catch(() => {});
}

async function refreshUserToken() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !tokenState.refreshToken) throw new Error('Faltam Client ID, Client Secret ou Refresh Token da Twitch.');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenState.refreshToken,
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET
  });
  const data = await rawFetchJson('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  setTokenData(data);
  return tokenState.accessToken;
}

async function ensureToken() {
  if (tokenState.accessToken && Date.now() < tokenState.expiresAt) return tokenState.accessToken;
  if (tokenState.refreshToken) return refreshUserToken();
  throw new Error('Twitch ainda não autorizada.');
}

async function twitchApi(endpoint, options = {}, retry = true) {
  const token = await ensureToken();
  const headers = {
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`,
    'Client-Id': TWITCH_CLIENT_ID
  };
  try {
    return await rawFetchJson(`https://api.twitch.tv/helix${endpoint}`, { ...options, headers });
  } catch (err) {
    if (retry && err.status === 401 && tokenState.refreshToken) {
      await refreshUserToken();
      return twitchApi(endpoint, options, false);
    }
    throw err;
  }
}

async function loadAuthorizedIdentity() {
  const data = await twitchApi('/users');
  const user = data?.data?.[0];
  if (!user) throw new Error('Não consegui identificar a conta Twitch autorizada.');
  tokenState.userId = String(user.id);
  tokenState.login = String(user.login);
  tokenState.displayName = String(user.display_name || user.login);
  runtime.twitch.authorizedUserId = tokenState.userId;
  runtime.twitch.authorizedLogin = tokenState.login;
  runtime.twitch.authorizedDisplayName = tokenState.displayName;
  persistTwitchSession();
  return user;
}

async function loadBroadcasterId() {
  const data = await twitchApi(`/users?login=${encodeURIComponent(CHANNEL_NAME)}`);
  const user = data?.data?.[0];
  if (!user) throw new Error(`Canal Twitch ${CHANNEL_NAME} não encontrado.`);
  runtime.twitch.broadcasterId = String(user.id);
  return runtime.twitch.broadcasterId;
}

async function createChatSubscription(sessionId) {
  if (!tokenState.userId) await loadAuthorizedIdentity();
  if (!runtime.twitch.broadcasterId) await loadBroadcasterId();
  const body = {
    type: 'channel.chat.message',
    version: '1',
    condition: {
      broadcaster_user_id: runtime.twitch.broadcasterId,
      user_id: tokenState.userId
    },
    transport: {
      method: 'websocket',
      session_id: sessionId
    }
  };
  try {
    const data = await twitchApi('/eventsub/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    runtime.twitch.subscriptionId = data?.data?.[0]?.id || runtime.twitch.subscriptionId;
  } catch (err) {
    if (err.status !== 409) throw err;
    runtime.twitch.subscriptionId = err.data?.data?.[0]?.id || runtime.twitch.subscriptionId || 'existente';
  }
}

function clearKeepalive() {
  if (keepaliveTimer) clearTimeout(keepaliveTimer);
  keepaliveTimer = null;
}

function armKeepalive(seconds = 30) {
  clearKeepalive();
  keepaliveTimer = setTimeout(() => {
    runtime.twitch.lastError = 'EventSub ficou sem keepalive; reconectando.';
    try { eventSubSocket?.terminate(); } catch {}
  }, (Number(seconds) + 12) * 1000);
}

function scheduleReconnect(delay = 5000) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startEventSub().catch(err => {
      runtime.twitch.lastError = err.message;
      scheduleReconnect(10000);
    });
  }, delay);
}

async function connectEventSub(url = 'wss://eventsub.wss.twitch.tv/ws') {
  const token = await ensureToken();
  if (!token) return;
  if (eventSubSocket) {
    try { eventSubSocket.removeAllListeners(); eventSubSocket.terminate(); } catch {}
  }

  runtime.twitch.status = 'conectando';
  const ws = new WebSocket(url);
  eventSubSocket = ws;

  ws.on('open', () => {
    runtime.twitch.status = 'websocket aberto';
    runtime.twitch.lastError = null;
  });

  ws.on('message', async raw => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    const type = msg?.metadata?.message_type;
    const session = msg?.payload?.session;
    if (session?.keepalive_timeout_seconds) armKeepalive(session.keepalive_timeout_seconds);
    else armKeepalive(30);

    if (type === 'session_welcome') {
      runtime.twitch.sessionId = session?.id || null;
      runtime.twitch.connectedAt = new Date().toISOString();
      runtime.twitch.status = 'conectado';
      try {
        await createChatSubscription(runtime.twitch.sessionId);
      } catch (err) {
        runtime.twitch.status = 'erro';
        runtime.twitch.lastError = err.message;
        console.error('[eventsub subscribe]', err.message, err.data || '');
      }
      return;
    }

    if (type === 'session_reconnect' && session?.reconnect_url) {
      runtime.twitch.reconnects++;
      connectEventSub(session.reconnect_url).catch(err => {
        runtime.twitch.lastError = err.message;
        scheduleReconnect();
      });
      return;
    }

    if (type === 'notification' && msg?.payload?.subscription?.type === 'channel.chat.message') {
      const ev = msg.payload.event || {};
      runtime.twitch.lastMessageAt = new Date().toISOString();
      acceptChatMessage({
        id: ev.message_id,
        username: ev.chatter_user_login,
        displayName: ev.chatter_user_name,
        text: ev.message?.text,
        badges: ev.badges || []
      });
      return;
    }

    if (type === 'revocation') {
      runtime.twitch.status = 'revogado';
      runtime.twitch.lastError = msg?.payload?.subscription?.status || 'Autorização revogada.';
    }
  });

  ws.on('close', () => {
    if (eventSubSocket === ws) eventSubSocket = null;
    clearKeepalive();
    if (runtime.twitch.status !== 'revogado') runtime.twitch.status = 'desconectado';
    scheduleReconnect();
  });

  ws.on('error', err => {
    runtime.twitch.lastError = err.message;
  });
}

async function startEventSub() {
  if (eventSubStarting) return;
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    runtime.twitch.status = 'aguardando configuração';
    return;
  }
  if (!tokenState.refreshToken && !tokenState.accessToken) {
    runtime.twitch.status = 'aguardando autorização';
    return;
  }
  eventSubStarting = true;
  try {
    await ensureToken();
    await loadAuthorizedIdentity();
    await loadBroadcasterId();
    await connectEventSub();
  } finally {
    eventSubStarting = false;
  }
}

function bootstrapTwitchSession() {
  const local = readJson(TWITCH_SESSION_FILE, null);
  tokenState.refreshToken = ENV_REFRESH_TOKEN || String(local?.refreshToken || '');
  tokenState.userId = String(local?.userId || '');
  tokenState.login = String(local?.login || '');
  tokenState.displayName = String(local?.displayName || '');
  if (tokenState.refreshToken && TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
    startEventSub().catch(err => {
      runtime.twitch.status = 'erro';
      runtime.twitch.lastError = err.message;
      console.error('[twitch bootstrap]', err.message);
    });
  }
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(ROOT, 'public')));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    channel: CHANNEL_NAME,
    botDisplayName: BOT_DISPLAY_NAME,
    twitchStatus: runtime.twitch.status
  });
});

app.get('/auth/twitch/callback', async (req, res) => {
  try {
    if (!verifyOauthState(req.query.state)) throw new Error('Estado OAuth inválido ou expirado. Volte ao painel e tente novamente.');
    if (req.query.error) throw new Error(`Twitch recusou autorização: ${req.query.error_description || req.query.error}`);
    if (!req.query.code) throw new Error('A Twitch não retornou o código de autorização.');
    await exchangeCodeForToken(String(req.query.code), callbackUrl(req));
    await loadAuthorizedIdentity();
    await startEventSub();
    const autoSaved = await persistRefreshTokenToRender();
    const refresh = tokenState.refreshToken.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const persistHtml = autoSaved
      ? '<p class="ok"><b>Refresh Token salvo automaticamente no Environment do Render ✅</b></p><p>A API do Render atualizou <code>TWITCH_REFRESH_TOKEN</code>. Não é necessário copiar o token manualmente.</p>'
      : '<p>Para a autorização sobreviver a reinícios/redeploys, copie o valor abaixo para <code>TWITCH_REFRESH_TOKEN</code> no Render.</p><textarea rows="5" readonly>' + refresh + '</textarea><p><b>Não publique esse token no GitHub e não envie para outras pessoas.</b></p>';
    res.type('html').send(`<!doctype html><meta charset="utf-8"><title>CarolIA conectada</title><style>body{font-family:system-ui;background:#0d0a12;color:#fff;padding:32px;max-width:850px;margin:auto}code,textarea{background:#191220;color:#f6eaff;border:1px solid #40304f;border-radius:10px;padding:12px;width:100%;box-sizing:border-box}a{color:#c6a1ff}.ok{color:#71eda0}</style><h1 class="ok">Twitch conectada ✅</h1><p>Conta autorizada: <b>${tokenState.displayName}</b>. Ela será usada somente para LER o chat de <b>${CHANNEL_NAME}</b>.</p>${persistHtml}<p><a href="/">Voltar ao painel</a></p>`);
  } catch (err) {
    res.status(400).type('html').send(`<meta charset="utf-8"><body style="font-family:system-ui;background:#120b10;color:white;padding:32px"><h1>Erro ao conectar Twitch</h1><pre>${String(err.message).replace(/</g, '&lt;')}</pre><a style="color:#d6b4ff" href="/">Voltar</a></body>`);
  }
});

app.get('/should', timerAuth, (_req, res) => {
  res.type('text/plain');
  if (!shouldDispatch()) {
    runtime.suppressed++;
    return res.send('0');
  }
  const item = lockCandidate();
  if (!item) {
    runtime.suppressed++;
    return res.send('0');
  }
  return res.send('1');
});

app.get('/prompt', timerAuth, (_req, res) => {
  res.type('text/plain; charset=utf-8');
  const item = runtime.pending?.item || lockCandidate();
  if (!item) return res.send('PT-BR. Responda apenas: oi');
  const prompt = buildPrompt(item);
  runtime.promptsServed++;
  runtime.lastAiDispatchAt = Date.now();
  runtime.recentAnsweredUsers.set(item.username, Date.now());
  runtime.pending = null;
  return res.send(prompt);
});

app.get('/api/config', panelAuth, (req, res) => {
  res.json({ config, presets: PRESETS, timerLine: timerLine(req), configVersion });
});

app.put('/api/config', panelAuth, (req, res) => {
  const saved = setConfig(req.body || {});
  res.json({ ok: true, config: saved, timerLine: timerLine(req), configVersion });
});

app.post('/api/apply-preset/:name', panelAuth, (req, res) => {
  const name = req.params.name;
  if (!PRESETS[name]) return res.status(404).json({ error: 'Preset inválido.' });
  const saved = setConfig({ ...config, ...PRESETS[name], preset: name });
  res.json({ ok: true, config: saved, configVersion });
});

app.get('/api/status', panelAuth, (req, res) => {
  purgeQueue();
  res.json({
    channel: CHANNEL_NAME,
    expectedBotName: BOT_DISPLAY_NAME,
    messagesSeen: runtime.messagesSeen,
    messagesAccepted: runtime.messagesAccepted,
    queueLength: runtime.queue.length,
    pendingUser: runtime.pending?.item?.displayName || null,
    promptsServed: runtime.promptsServed,
    suppressed: runtime.suppressed,
    lastAiDispatchAt: runtime.lastAiDispatchAt ? new Date(runtime.lastAiDispatchAt).toISOString() : null,
    lastCandidateAt: runtime.lastCandidateAt,
    configVersion,
    twitch: runtime.twitch,
    twitchConfigured: Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET),
    refreshTokenConfiguredInEnv: Boolean(ENV_REFRESH_TOKEN),
    renderAutoPersistence: Boolean(RENDER_API_KEY && RENDER_SERVICE_ID),
    timerLine: timerLine(req),
    callbackUrl: callbackUrl(req)
  });
});

app.get('/api/setup', panelAuth, (req, res) => {
  res.json({
    channel: CHANNEL_NAME,
    expectedBotName: BOT_DISPLAY_NAME,
    baseUrl: publicBase(req),
    callbackUrl: callbackUrl(req),
    timerLine: timerLine(req),
    oauthReady: Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET)
  });
});

app.get('/api/twitch-auth-url', panelAuth, (req, res) => {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    return res.status(400).json({ error: 'Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET no Render primeiro.' });
  }
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', TWITCH_CLIENT_ID);
  url.searchParams.set('redirect_uri', callbackUrl(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'user:read:chat');
  url.searchParams.set('force_verify', 'true');
  url.searchParams.set('state', makeOauthState());
  res.json({ url: url.toString() });
});

app.post('/api/reconnect-twitch', panelAuth, async (_req, res) => {
  try {
    if (eventSubSocket) { try { eventSubSocket.terminate(); } catch {} eventSubSocket = null; }
    await startEventSub();
    res.json({ ok: true, twitch: runtime.twitch });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/simulate', panelAuth, (req, res) => {
  const username = normalizeText(req.body?.username || 'ViewerTeste').slice(0, 25);
  const text = normalizeText(req.body?.text || 'Carol, você tá muito linda hoje').slice(0, 400);
  const item = { id: crypto.randomUUID(), username: username.toLowerCase(), displayName: username, text, badges: [], receivedAt: Date.now(), score: 1 };
  const prompt = buildPrompt(item);
  res.json({ ok: true, selected: item, prompt, promptBytes: utf8Bytes(prompt) });
});

app.post('/api/inject-test-message', panelAuth, (req, res) => {
  const username = normalizeText(req.body?.username || 'ViewerTeste').slice(0, 25);
  const text = normalizeText(req.body?.text || 'Carol, responde aí').slice(0, 400);
  const accepted = acceptChatMessage({ id: crypto.randomUUID(), username, displayName: username, text, badges: [] });
  res.json({ ok: true, accepted, queueLength: runtime.queue.length });
});

app.post('/api/clear-queue', panelAuth, (_req, res) => {
  runtime.queue = [];
  runtime.pending = null;
  res.json({ ok: true });
});

app.get('/api/export-config', panelAuth, (_req, res) => {
  res.set('Content-Disposition', 'attachment; filename="carolia-config.json"');
  res.json(config);
});

app.use((err, _req, res, _next) => {
  console.error('[http]', err);
  res.status(500).json({ error: 'Erro interno.' });
});

app.listen(PORT, () => {
  console.log(`CarolIA rodando na porta ${PORT}`);
  console.log(`Canal: ${CHANNEL_NAME}`);
  console.log(`Saída esperada do StreamElements: ${BOT_DISPLAY_NAME}`);
  if (!PANEL_KEY || !TIMER_KEY) console.warn('[AVISO] PANEL_KEY e TIMER_KEY precisam estar configuradas.');
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) console.warn('[AVISO] Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET para ler o chat sem OBS.');
  bootstrapTwitchSession();
});
