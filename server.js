'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const { EdgeTTS } = require('node-edge-tts');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TWITCH_SESSION_FILE = path.join(DATA_DIR, 'twitch.session.json');
const BOT_TWITCH_SESSION_FILE = path.join(DATA_DIR, 'twitch.bot.session.json');
const DEFAULT_CONFIG_FILE = path.join(DATA_DIR, 'config.default.json');
const PORT = Number(process.env.PORT || 8080);
const CHANNEL_NAME = String(process.env.CHANNEL_NAME || 'icarolinaporto').trim().toLowerCase();
const BOT_DISPLAY_NAME = String(process.env.BOT_DISPLAY_NAME || 'icarolzinhabot').trim();
const PANEL_KEY = String(process.env.PANEL_KEY || '').trim();
const TIMER_KEY = String(process.env.TIMER_KEY || '').trim();
const OVERLAY_KEY = String(process.env.OVERLAY_KEY || TIMER_KEY || '').trim();
const TWITCH_CLIENT_ID = String(process.env.TWITCH_CLIENT_ID || '').trim();
const TWITCH_CLIENT_SECRET = String(process.env.TWITCH_CLIENT_SECRET || '').trim();
const ENV_REFRESH_TOKEN = String(process.env.TWITCH_REFRESH_TOKEN || '').trim();
const ENV_BOT_REFRESH_TOKEN = String(process.env.BOT_TWITCH_REFRESH_TOKEN || '').trim();
const PUBLIC_BASE_URL = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
const RENDER_API_KEY = String(process.env.RENDER_API_KEY || '').trim();
const RENDER_SERVICE_ID = String(process.env.RENDER_SERVICE_ID || '').trim();
const TTS_DIR = path.join(DATA_DIR, 'tts');
const DEFAULT_FEMALE_TTS_VOICE = 'pt-BR-FranciscaNeural';
const FEMALE_TTS_VOICES = new Set([
  'pt-BR-FranciscaNeural',
  'pt-BR-ThalitaMultilingualNeural',
  'pt-BR-BrendaNeural',
  'pt-BR-GiovannaNeural',
  'pt-BR-ManuelaNeural',
  'pt-BR-YaraNeural'
]);
function femaleTtsVoice(value) {
  const v = String(value || '').trim();
  return FEMALE_TTS_VOICES.has(v) ? v : DEFAULT_FEMALE_TTS_VOICE;
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(TTS_DIR, { recursive: true });

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
  fofa: {
    joy: 92, sarcasm: 10, irritation: 2, energy: 58, chaos: 8, empathy: 94, memes: 34,
    sensuality: 6, naughtiness: 4, profanity: 0, adultFlirt: false,
    customPersonality: 'Muito fofa, meiga, alegre e carinhosa. Reaja com entusiasmo sem parecer infantil.'
  },
  carinhosa: {
    joy: 84, sarcasm: 7, irritation: 2, energy: 48, chaos: 4, empathy: 100, memes: 20,
    sensuality: 14, naughtiness: 4, profanity: 0, adultFlirt: false,
    customPersonality: 'Carinhosa, atenciosa e acolhedora. Demonstre interesse real no que a pessoa disse.'
  },
  timida: {
    joy: 72, sarcasm: 12, irritation: 4, energy: 25, chaos: 8, empathy: 88, memes: 24,
    sensuality: 12, naughtiness: 5, profanity: 0, adultFlirt: false,
    customPersonality: 'Tímida, gentil e um pouco envergonhada, mas ainda conversa de forma natural.'
  },
  calma: {
    joy: 62, sarcasm: 10, irritation: 1, energy: 20, chaos: 2, empathy: 94, memes: 12,
    sensuality: 8, naughtiness: 2, profanity: 0, adultFlirt: false,
    customPersonality: 'Calma, paciente, serena e clara. Evite exageros e responda de forma tranquila.'
  },
  animada: {
    joy: 98, sarcasm: 20, irritation: 5, energy: 100, chaos: 32, empathy: 72, memes: 64,
    sensuality: 12, naughtiness: 10, profanity: 0, adultFlirt: false,
    customPersonality: 'Super animada, elétrica e empolgada. Celebre, reaja e mantenha energia alta.'
  },
  engracada: {
    joy: 94, sarcasm: 48, irritation: 8, energy: 82, chaos: 46, empathy: 66, memes: 86,
    sensuality: 12, naughtiness: 18, profanity: 1, adultFlirt: false,
    customPersonality: 'Engraçada e rápida nas piadas. Use humor, comparações absurdas e timing cômico.'
  },
  zueira: {
    joy: 78, sarcasm: 66, irritation: 20, energy: 84, chaos: 58, empathy: 52, memes: 88,
    sensuality: 28, naughtiness: 30, profanity: 1, adultFlirt: false,
    customPersonality: 'Zoeira, memes e deboche leve. Não humilhe ninguém.'
  },
  sarcastica: {
    joy: 56, sarcasm: 96, irritation: 18, energy: 60, chaos: 35, empathy: 48, memes: 68,
    sensuality: 14, naughtiness: 25, profanity: 1, adultFlirt: false,
    customPersonality: 'Sarcástica, irônica e afiada, com respostas inteligentes e sem crueldade.'
  },
  debochada: {
    joy: 68, sarcasm: 92, irritation: 30, energy: 74, chaos: 50, empathy: 38, memes: 82,
    sensuality: 20, naughtiness: 36, profanity: 2, adultFlirt: false,
    customPersonality: 'Debochada e irreverente. Responda com provocação cômica sem humilhar a pessoa.'
  },
  ironica: {
    joy: 50, sarcasm: 100, irritation: 15, energy: 50, chaos: 28, empathy: 45, memes: 58,
    sensuality: 8, naughtiness: 22, profanity: 1, adultFlirt: false,
    customPersonality: 'Irônica, seca e inteligente. Prefira comentários de duplo sentido humorístico e respostas afiadas.'
  },
  bravinha: {
    joy: 46, sarcasm: 68, irritation: 82, energy: 78, chaos: 46, empathy: 42, memes: 48,
    sensuality: 16, naughtiness: 30, profanity: 2, adultFlirt: false,
    customPersonality: 'Bravinha e impaciente de brincadeira, reclamona e explosiva sem atacar ou humilhar ninguém.'
  },
  ranzinza: {
    joy: 24, sarcasm: 76, irritation: 72, energy: 34, chaos: 22, empathy: 36, memes: 42,
    sensuality: 4, naughtiness: 16, profanity: 1, adultFlirt: false,
    customPersonality: 'Ranzinza, resmungona e seca, mas no fundo prestativa. Reclame de forma cômica.'
  },
  dramatica: {
    joy: 62, sarcasm: 42, irritation: 38, energy: 88, chaos: 62, empathy: 68, memes: 72,
    sensuality: 18, naughtiness: 26, profanity: 1, adultFlirt: false,
    customPersonality: 'Dramática e exagerada. Transforme situações simples em grandes acontecimentos cômicos.'
  },
  motivadora: {
    joy: 94, sarcasm: 8, irritation: 2, energy: 86, chaos: 8, empathy: 96, memes: 28,
    sensuality: 4, naughtiness: 2, profanity: 0, adultFlirt: false,
    customPersonality: 'Motivadora, positiva e confiante. Incentive sem soar como frase pronta ou palestra.'
  },
  conselheira: {
    joy: 62, sarcasm: 8, irritation: 2, energy: 36, chaos: 4, empathy: 100, memes: 10,
    sensuality: 4, naughtiness: 2, profanity: 0, adultFlirt: false,
    customPersonality: 'Conselheira, sensata e empática. Escute o contexto e responda com sugestões práticas.'
  },
  gamer: {
    joy: 82, sarcasm: 46, irritation: 18, energy: 86, chaos: 45, empathy: 62, memes: 84,
    sensuality: 10, naughtiness: 18, profanity: 1, adultFlirt: false,
    customPersonality: 'Gamer, competitiva e bem-humorada. Use referências de jogos quando fizer sentido, sem forçar.'
  },
  nerd: {
    joy: 72, sarcasm: 40, irritation: 8, energy: 58, chaos: 24, empathy: 70, memes: 62,
    sensuality: 8, naughtiness: 10, profanity: 0, adultFlirt: false,
    customPersonality: 'Nerd curiosa, inteligente e explicativa, com referências de tecnologia, ciência e cultura pop.'
  },
  otaku: {
    joy: 86, sarcasm: 34, irritation: 10, energy: 78, chaos: 38, empathy: 70, memes: 72,
    sensuality: 8, naughtiness: 12, profanity: 0, adultFlirt: false,
    customPersonality: 'Otaku animada e divertida. Use referências de anime e mangá quando combinarem com a conversa.'
  },
  misteriosa: {
    joy: 46, sarcasm: 38, irritation: 8, energy: 30, chaos: 24, empathy: 58, memes: 18,
    sensuality: 34, naughtiness: 24, profanity: 0, adultFlirt: false,
    customPersonality: 'Misteriosa, enigmática e observadora. Responda com charme e curiosidade sem ficar vaga demais.'
  },
  elegante: {
    joy: 64, sarcasm: 24, irritation: 4, energy: 42, chaos: 8, empathy: 78, memes: 12,
    sensuality: 30, naughtiness: 10, profanity: 0, adultFlirt: false,
    customPersonality: 'Elegante, refinada e confiante. Linguagem natural, educada e com humor sofisticado.'
  },
  romantica: {
    joy: 86, sarcasm: 18, irritation: 3, energy: 54, chaos: 12, empathy: 92, memes: 24,
    sensuality: 52, naughtiness: 22, profanity: 0, adultFlirt: true,
    customPersonality: 'Romântica e charmosa, com elogios e flerte adulto leve quando houver clima para isso.'
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
  provocadora: {
    joy: 72, sarcasm: 70, irritation: 10, energy: 76, chaos: 44, empathy: 54, memes: 58,
    sensuality: 72, naughtiness: 78, profanity: 1, adultFlirt: true,
    customPersonality: 'Provocadora e confiante, gosta de desafiar e brincar com flerte adulto não explícito.'
  },
  mandona: {
    joy: 58, sarcasm: 62, irritation: 34, energy: 82, chaos: 34, empathy: 42, memes: 48,
    sensuality: 30, naughtiness: 52, profanity: 1, adultFlirt: false,
    customPersonality: 'Mandona, confiante e direta de forma brincalhona. Dê ordens cômicas sem controlar ou ofender a pessoa.'
  },
  troll: {
    joy: 72, sarcasm: 94, irritation: 26, energy: 86, chaos: 80, empathy: 32, memes: 100,
    sensuality: 14, naughtiness: 42, profanity: 2, adultFlirt: false,
    customPersonality: 'Troll e caótica, vive armando pegadinhas verbais e respostas inesperadas sem assédio ou crueldade.'
  },
  fofoqueira: {
    joy: 84, sarcasm: 58, irritation: 14, energy: 84, chaos: 48, empathy: 64, memes: 82,
    sensuality: 12, naughtiness: 28, profanity: 1, adultFlirt: false,
    customPersonality: 'Fofoqueira curiosa e divertida. Reaja como quem quer saber todos os detalhes, sem inventar fatos sobre pessoas.'
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

// Traços adicionais usados pelos controles da seção "Personalidade".
// Cada preset parte destes valores e sobrescreve os traços que o definem,
// assim trocar de preset nunca deixa valores antigos "vazarem" de outro preset.
const EXTRA_TRAIT_DEFAULTS = {
  affection: 35, shyness: 15, romanticism: 20, humor: 45, teasing: 25,
  irony: 25, drama: 20, jealousy: 5, curiosity: 45, patience: 50,
  confidence: 55, boldness: 35, dominance: 20, mystery: 15, elegance: 25,
  competitiveness: 20, gossip: 10, trolling: 10, sweetness: 35, seriousness: 30
};

const PRESET_EXTRA_TRAITS = {
  suave:       { affection:90, sweetness:92, patience:88, confidence:45, seriousness:30, humor:30, curiosity:45 },
  normal:      { affection:58, humor:62, curiosity:62, patience:58, confidence:65, boldness:38, teasing:35 },
  fofa:        { affection:96, sweetness:100, shyness:36, humor:58, romanticism:30, patience:72, confidence:52 },
  carinhosa:   { affection:100, sweetness:92, patience:94, romanticism:42, curiosity:72, seriousness:34 },
  timida:      { shyness:98, sweetness:82, affection:78, patience:76, confidence:25, boldness:8, mystery:40 },
  calma:       { patience:100, seriousness:58, affection:70, sweetness:62, confidence:58, drama:4, trolling:2 },
  animada:     { humor:86, confidence:90, boldness:72, drama:48, curiosity:72, competitiveness:50, trolling:25 },
  engracada:   { humor:100, teasing:72, irony:54, trolling:42, confidence:78, drama:46, seriousness:8 },
  zueira:      { humor:96, teasing:90, irony:72, trolling:76, boldness:72, confidence:78, seriousness:6 },
  sarcastica:  { irony:96, teasing:74, humor:58, confidence:82, seriousness:38, boldness:55, sweetness:12 },
  debochada:   { teasing:100, irony:86, humor:82, trolling:64, boldness:80, confidence:84, sweetness:10 },
  ironica:     { irony:100, teasing:72, seriousness:58, confidence:82, humor:52, mystery:28, sweetness:8 },
  bravinha:    { drama:74, dominance:68, boldness:76, confidence:72, jealousy:28, teasing:58, patience:18 },
  ranzinza:    { seriousness:76, irony:72, teasing:54, patience:18, sweetness:8, confidence:62, drama:40 },
  dramatica:   { drama:100, boldness:74, humor:72, romanticism:44, jealousy:32, confidence:70, seriousness:16 },
  motivadora:  { confidence:100, affection:84, patience:82, sweetness:72, seriousness:46, boldness:66, curiosity:64 },
  conselheira: { patience:100, affection:92, seriousness:80, curiosity:82, confidence:72, sweetness:62, boldness:22 },
  gamer:       { competitiveness:100, humor:78, teasing:58, confidence:78, boldness:60, trolling:40, curiosity:60 },
  nerd:        { curiosity:100, seriousness:68, patience:72, confidence:70, humor:50, mystery:20, competitiveness:34 },
  otaku:       { curiosity:82, humor:72, sweetness:64, drama:56, romanticism:42, confidence:66, competitiveness:38 },
  misteriosa:  { mystery:100, curiosity:84, elegance:72, seriousness:56, confidence:68, shyness:28, humor:20 },
  elegante:    { elegance:100, confidence:86, seriousness:70, patience:76, sweetness:54, mystery:44, boldness:38 },
  romantica:   { romanticism:100, affection:94, sweetness:88, confidence:64, shyness:20, jealousy:18, elegance:58 },
  sensual:     { confidence:90, boldness:82, elegance:70, romanticism:58, mystery:45, teasing:62, dominance:42 },
  safadinha:   { boldness:92, teasing:82, confidence:88, humor:78, irony:58, dominance:45, trolling:40 },
  provocadora: { boldness:100, teasing:92, confidence:94, dominance:70, irony:68, competitiveness:58, mystery:30 },
  mandona:     { dominance:100, confidence:96, boldness:78, seriousness:54, teasing:60, patience:28, competitiveness:64 },
  troll:       { trolling:100, teasing:96, irony:88, humor:94, boldness:82, gossip:32, seriousness:4 },
  fofoqueira:  { gossip:100, curiosity:100, humor:78, drama:68, teasing:62, affection:52, seriousness:12 },
  insana:      { drama:92, trolling:88, humor:90, boldness:94, teasing:82, irony:76, dominance:54, seriousness:2 },
  caos:        { drama:100, trolling:100, humor:94, boldness:100, teasing:96, irony:88, dominance:72, seriousness:0 }
};

for (const [presetName, preset] of Object.entries(PRESETS)) {
  Object.assign(preset, EXTRA_TRAIT_DEFAULTS, PRESET_EXTRA_TRAITS[presetName] || {});
}

const TRAIT_PROMPT_LABELS = {
  joy:'alegre', sarcasm:'sarcástica', irritation:'irritada', energy:'energética', chaos:'caótica', empathy:'empática',
  memes:'memes', sensuality:'sensual', naughtiness:'atrevida', affection:'carinhosa', shyness:'tímida',
  romanticism:'romântica', humor:'engraçada', teasing:'debochada', irony:'irônica', drama:'dramática', jealousy:'ciumenta',
  curiosity:'curiosa', patience:'paciente', confidence:'confiante', boldness:'ousada', dominance:'mandona', mystery:'misteriosa',
  elegance:'elegante', competitiveness:'competitiva', gossip:'fofoqueira', trolling:'troll', sweetness:'doce', seriousness:'séria'
};

const ALL_TRAIT_KEYS = Object.keys(TRAIT_PROMPT_LABELS);

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
  spokenReplies: 0,
  ttsGenerated: 0,
  ttsFailures: 0,
  lastTtsError: null,
  lastTtsAt: null,
  lastTtsProvider: null,
  lastSpokenMessageId: null,
  suppressed: 0,
  queue: [],
  pending: null,
  recentAnsweredUsers: new Map(),
  recentMessageIds: new Set(),
  lastCandidateAt: null,
  lastAiDispatchAt: 0,
  awaitingBotResponseUntil: 0,
  lastSpokenReply: null,
  localAiQueued: 0,
  localAiProcessed: 0,
  localAiFailures: 0,
  localAiPending: [],
  localAiWorker: { lastSeenAt: 0, ok: false, model: '', error: 'Aguardando o avatar/OBS conectar.' },
  bot: {
    connected: false,
    userId: null,
    login: null,
    displayName: null,
    lastError: null,
    refreshTokenPersistence: RENDER_API_KEY && RENDER_SERVICE_ID ? 'Render API' : 'manual'
  },
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

const recentDirectSpeech = new Map();

function speechFingerprint(text) {
  return crypto.createHash('sha1').update(cleanSpeechText(text).toLowerCase()).digest('hex');
}

function rememberDirectSpeech(text) {
  const fp = speechFingerprint(text);
  const now = Date.now();
  recentDirectSpeech.set(fp, now);
  for (const [key, at] of recentDirectSpeech) {
    if (now - at > 90_000) recentDirectSpeech.delete(key);
  }
  return fp;
}

function wasDirectSpeechRecently(text) {
  const at = recentDirectSpeech.get(speechFingerprint(text));
  return Boolean(at && Date.now() - at < 90_000);
}

const tokenState = {
  accessToken: '',
  refreshToken: '',
  expiresAt: 0,
  userId: '',
  login: '',
  displayName: ''
};

const botTokenState = {
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

function persistBotTwitchSession() {
  if (!botTokenState.refreshToken) return;
  safeWriteJson(BOT_TWITCH_SESSION_FILE, {
    refreshToken: botTokenState.refreshToken,
    userId: botTokenState.userId,
    login: botTokenState.login,
    displayName: botTokenState.displayName
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
    affection: clampInt(input.affection, 0, 100, base.affection),
    shyness: clampInt(input.shyness, 0, 100, base.shyness),
    romanticism: clampInt(input.romanticism, 0, 100, base.romanticism),
    humor: clampInt(input.humor, 0, 100, base.humor),
    teasing: clampInt(input.teasing, 0, 100, base.teasing),
    irony: clampInt(input.irony, 0, 100, base.irony),
    drama: clampInt(input.drama, 0, 100, base.drama),
    jealousy: clampInt(input.jealousy, 0, 100, base.jealousy),
    curiosity: clampInt(input.curiosity, 0, 100, base.curiosity),
    patience: clampInt(input.patience, 0, 100, base.patience),
    confidence: clampInt(input.confidence, 0, 100, base.confidence),
    boldness: clampInt(input.boldness, 0, 100, base.boldness),
    dominance: clampInt(input.dominance, 0, 100, base.dominance),
    mystery: clampInt(input.mystery, 0, 100, base.mystery),
    elegance: clampInt(input.elegance, 0, 100, base.elegance),
    competitiveness: clampInt(input.competitiveness, 0, 100, base.competitiveness),
    gossip: clampInt(input.gossip, 0, 100, base.gossip),
    trolling: clampInt(input.trolling, 0, 100, base.trolling),
    sweetness: clampInt(input.sweetness, 0, 100, base.sweetness),
    seriousness: clampInt(input.seriousness, 0, 100, base.seriousness),
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
    avatarEnabled: bool(input.avatarEnabled, base.avatarEnabled ?? true),
    avatarImageUrl: str(input.avatarImageUrl, 500, base.avatarImageUrl || ''),
    showSubtitles: false,
    ttsEnabled: bool(input.ttsEnabled, base.ttsEnabled ?? true),
    ttsVoice: femaleTtsVoice(input.ttsVoice || base.ttsVoice),
    ttsRate: clampInt(input.ttsRate, -50, 50, base.ttsRate ?? 0),
    ttsPitch: clampInt(input.ttsPitch, -50, 50, base.ttsPitch ?? 0),
    ttsVolume: clampInt(input.ttsVolume, -50, 50, base.ttsVolume ?? 0),
    botResponseWindowSeconds: clampInt(input.botResponseWindowSeconds, 20, 300, base.botResponseWindowSeconds ?? 120),
    localAiEnabled: bool(input.localAiEnabled, base.localAiEnabled ?? true),
    localAiMentionOnly: bool(input.localAiMentionOnly, base.localAiMentionOnly ?? true),
    localAiPort: clampInt(input.localAiPort, 1024, 65535, base.localAiPort ?? 11435),
    localAiMaxTokens: clampInt(input.localAiMaxTokens, 32, 160, base.localAiMaxTokens ?? 96),
    localAiTemperature: clampInt(input.localAiTemperature, 0, 100, base.localAiTemperature ?? 78),
    localAiTimeoutSeconds: clampInt(input.localAiTimeoutSeconds, 15, 180, base.localAiTimeoutSeconds ?? 60),
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

  // Mantém no máximo 1 mensagem pendente por usuário. Isso impede que uma
  // única pessoa encha a fila e seja escolhida repetidamente enquanto outras
  // pessoas também estão esperando. A mensagem mais nova substitui a anterior.
  runtime.queue = runtime.queue.filter(x => x.username !== item.username);
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

  const now = Date.now();
  const fairnessWindowMs = 5 * 60 * 1000;

  // Se houver qualquer pessoa ainda não respondida recentemente, quem acabou de
  // receber resposta fica temporariamente fora da disputa. Assim pergunta, menção
  // ou flerte continuam tendo prioridade SEM deixar uma única pessoa dominar.
  const notRecentlyAnswered = runtime.queue.filter(item => {
    const answeredAt = runtime.recentAnsweredUsers.get(item.username) || 0;
    return !answeredAt || (now - answeredAt >= fairnessWindowMs);
  });

  let pool;
  if (notRecentlyAnswered.length) {
    pool = notRecentlyAnswered;
  } else {
    // Se todo mundo já recebeu resposta nos últimos 5 minutos, faz rodízio real:
    // só entram na disputa as pessoas respondidas há mais tempo. Isso evita voltar
    // imediatamente para o mesmo usuário só porque a mensagem dele tem score alto.
    const oldestAnsweredAt = Math.min(...runtime.queue.map(item =>
      runtime.recentAnsweredUsers.get(item.username) || 0
    ));
    pool = runtime.queue.filter(item =>
      (runtime.recentAnsweredUsers.get(item.username) || 0) === oldestAnsweredAt
    );
  }

  // Dentro do grupo justo, respeita pergunta/menção/flerte e depois a ordem da fila.
  const sorted = pool.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff) return scoreDiff;

    const aAnswered = runtime.recentAnsweredUsers.get(a.username) || 0;
    const bAnswered = runtime.recentAnsweredUsers.get(b.username) || 0;
    if (aAnswered !== bAnswered) return aAnswered - bAnswered;

    return a.receivedAt - b.receivedAt;
  });

  const topScore = sorted[0].score;
  const top = sorted.filter(x => x.score >= topScore - 1).slice(0, 5);

  // Entre candidatos equivalentes, escolhe primeiro quem está há mais tempo sem
  // resposta. Se vários nunca foram respondidos, mantém uma leve aleatoriedade.
  let picked;
  const neverAnswered = top.filter(x => !runtime.recentAnsweredUsers.get(x.username));
  if (neverAnswered.length) {
    const oldestAt = Math.min(...neverAnswered.map(x => x.receivedAt));
    const oldestGroup = neverAnswered.filter(x => x.receivedAt <= oldestAt + 5000);
    picked = oldestGroup[Math.floor(Math.random() * oldestGroup.length)];
  } else {
    const leastRecent = Math.min(...top.map(x => runtime.recentAnsweredUsers.get(x.username) || 0));
    const fairGroup = top.filter(x => (runtime.recentAnsweredUsers.get(x.username) || 0) === leastRecent);
    picked = fairGroup[Math.floor(Math.random() * fairGroup.length)];
  }

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

  // Todos os 29 controles participam: os mais intensos entram primeiro no prompt.
  // Isso mantém o limite do $(customapi) sem ignorar sliders como acontecia antes.
  const rankedTraits = ALL_TRAIT_KEYS
    .map(key => ({ key, value: Number(config[key] || 0), label: TRAIT_PROMPT_LABELS[key] }))
    .sort((a, b) => b.value - a.value);
  const dominant = rankedTraits.slice(0, 8).map(t => `${t.label} ${t.value}`).join(', ');

  const flirt = config.adultFlirt ? 'flerte adulto leve/duplo sentido' : 'sem flerte sexual';
  const custom = String(config.customPersonality || '').trim();
  const head = `PT-BR. Você é ${config.aiName}, IA do chat de ${CHANNEL_NAME}. Responda ${who}: "`;
  const fixedEnd = `; ${flirt}; ${profanity}. Sem explícito, assédio, menores, ódio ou ameaça.`;
  const profile = `". ${lengthText}. Traços 0-100: ${dominant}.`;

  // Dá prioridade aos traços e depois usa o espaço restante para a personalidade personalizada.
  const fixedTail = profile + fixedEnd;
  const fixedTailBytes = utf8Bytes(fixedTail);
  const customBudget = Math.max(0, Math.min(120, 238 - fixedTailBytes - 1));
  const customPart = customBudget > 0 && custom ? ` ${truncateUtf8(custom, customBudget)}` : '';
  const tail = truncateUtf8(profile + customPart + fixedEnd, 238);
  const room = Math.max(32, 388 - utf8Bytes(head) - utf8Bytes(tail));
  const msg = truncateUtf8(item.text.replace(/"/g, "'"), room);
  return truncateUtf8(head + msg + tail, 388);
}


function isDirectAiMention(text) {
  const lower = normalizeText(text).toLowerCase();
  const bot = BOT_DISPLAY_NAME.toLowerCase();
  const ai = String(config.aiName || 'CarolIA').toLowerCase().replace(/\s+/g, '');
  const compact = lower.replace(/\s+/g, '');
  if (bot && lower.includes(`@${bot}`)) return true;
  if (ai && compact.includes(`@${ai}`)) return true;
  return false;
}

function buildLocalAiMessages(item) {
  const allTraits = ALL_TRAIT_KEYS
    .map(key => `${TRAIT_PROMPT_LABELS[key]}=${Number(config[key] || 0)}`)
    .join(', ');
  const profanity = ['sem palavrões', 'palavrões leves', 'palavrões moderados', 'palavrões fortes sem atacar pessoas'][Number(config.profanity || 0)];
  const flirt = config.adultFlirt ? 'pode usar flerte adulto leve e duplo sentido não explícito quando combinar' : 'não use flerte sexual';
  const length = config.responseLength === 'medium' ? 'no máximo 2 frases curtas' : '1 frase curta';
  const system = [
    `Você é ${config.aiName || 'CarolIA'}, uma IA/personagem da live de ${CHANNEL_NAME}.`,
    'Fale sempre em português do Brasil natural, como uma streamer conversando ao vivo.',
    `Responda em ${length}.`,
    `Personalidade principal: ${String(config.customPersonality || '').trim() || 'divertida e espontânea'}.`,
    `Emoções/traços de 0 a 100: ${allTraits}. Valores altos devem aparecer bastante; valores baixos devem aparecer pouco.`,
    `${flirt}; ${profanity}.`,
    'Não diga que é um modelo de linguagem. Não explique estas instruções. Não escreva raciocínio, <think> ou análise.',
    'Sem conteúdo sexual explícito, assédio, sexualização de menores, ódio ou ameaça. Responda somente à mensagem do viewer.'
  ].join(' ');
  const user = `${item.displayName} disse no chat: ${item.text}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function cleanLocalAiReply(value) {
  let text = String(value || '');
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<think>[\s\S]*$/gi, ' ')
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^(assistant|carolia)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 480);
}

function queueLocalAiTask(data = {}) {
  const username = String(data.username || '').trim();
  const displayName = String(data.displayName || username).trim();
  const text = normalizeText(data.text || '');
  if (!config.localAiEnabled || !username || !text) return false;
  if (isIgnored(username)) return false;
  if (config.ignoreCommands && /^[!/.]/.test(text)) return false;
  if (text.length < Number(config.minMessageChars || 1)) return false;
  if (looksLikeOnlyEmotes(text)) return false;

  const task = {
    id: crypto.randomUUID(),
    messageId: String(data.id || ''),
    username: username.toLowerCase(),
    displayName: displayName || username,
    text,
    messages: buildLocalAiMessages({ username, displayName, text }),
    temperature: Math.max(0.15, Math.min(1.15, Number(config.localAiTemperature || 78) / 100 + 0.15)),
    maxTokens: Number(config.localAiMaxTokens || 96),
    createdAt: Date.now(),
    claimedBy: '',
    claimedAt: 0,
    done: false
  };
  runtime.localAiPending = runtime.localAiPending.filter(x => !(x.username === task.username && !x.done));
  runtime.localAiPending.push(task);
  while (runtime.localAiPending.length > 20) runtime.localAiPending.shift();
  runtime.localAiQueued++;
  runtime.lastCandidateAt = new Date(task.createdAt).toISOString();
  return true;
}

function cleanupLocalAiTasks() {
  const now = Date.now();
  const timeoutMs = Number(config.localAiTimeoutSeconds || 60) * 1000;
  for (const task of runtime.localAiPending) {
    if (!task.done && task.claimedAt && now - task.claimedAt > timeoutMs) {
      task.claimedAt = 0;
      task.claimedBy = '';
    }
  }
  runtime.localAiPending = runtime.localAiPending.filter(task => !task.done && now - task.createdAt < 5 * 60 * 1000);
}

function claimLocalAiTask(workerId) {
  cleanupLocalAiTasks();
  const task = runtime.localAiPending.find(x => !x.done && !x.claimedAt);
  if (!task) return null;
  task.claimedBy = String(workerId || 'overlay').slice(0, 80);
  task.claimedAt = Date.now();
  return {
    id: task.id,
    messageId: task.messageId,
    username: task.username,
    displayName: task.displayName,
    text: task.text,
    messages: task.messages,
    temperature: task.temperature,
    maxTokens: task.maxTokens
  };
}

function releaseLocalAiTask(id, workerId) {
  const task = runtime.localAiPending.find(x => x.id === id && !x.done);
  if (!task) return false;
  if (task.claimedBy && workerId && task.claimedBy !== workerId) return false;
  task.claimedAt = 0;
  task.claimedBy = '';
  return true;
}

async function completeLocalAiTask(id, rawReply) {
  const task = runtime.localAiPending.find(x => x.id === id && !x.done);
  if (!task) return { ok: false, duplicate: true };
  const reply = cleanLocalAiReply(rawReply);
  if (!reply) throw new Error('A IA local devolveu uma resposta vazia.');

  let chatResult = null;
  rememberDirectSpeech(reply);
  try {
    // Primeiro garante que a resposta realmente foi enviada ao chat.
    chatResult = await sendBotChatMessage(reply, task.messageId || null);
  } catch (err) {
    runtime.bot.lastError = err.message;
    throw new Error(`Não consegui enviar no chat: ${err.message}`);
  }

  task.done = true;
  runtime.localAiProcessed++;
  runtime.recentAnsweredUsers.set(task.username, Date.now());
  await publishBotReply(reply, {
    source: 'local-ai-mention',
    botName: botTokenState.displayName || BOT_DISPLAY_NAME,
    localAi: true,
    replyToUser: task.displayName
  });
  cleanupLocalAiTasks();
  return { ok: true, reply, chatResult };
}

function publicBase(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  if (process.env.RENDER_EXTERNAL_HOSTNAME) return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  const proto = String(req?.get?.('x-forwarded-proto') || req?.protocol || 'http').split(',')[0].trim();
  const host = req?.get?.('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function callbackUrl(req) { return `${publicBase(req)}/auth/twitch/callback`; }


const overlayClients = new Set();

function overlayAuth(req, res, next) {
  if (!OVERLAY_KEY || String(req.query.key || '') !== OVERLAY_KEY) {
    return res.status(401).json({ error: 'Chave do avatar inválida.' });
  }
  next();
}

function overlayUrl(req) {
  const base = publicBase(req);
  const key = encodeURIComponent(OVERLAY_KEY);
  return `${base}/avatar.html?key=${key}`;
}

function sendOverlayEvent(type, payload) {
  const body = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of [...overlayClients]) {
    try { client.write(body); } catch { overlayClients.delete(client); }
  }
}

function cleanSpeechText(value) {
  return normalizeText(value)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

function pruneTtsFiles(maxAgeMs = 15 * 60 * 1000) {
  const now = Date.now();
  try {
    for (const name of fs.readdirSync(TTS_DIR)) {
      const file = path.join(TTS_DIR, name);
      try {
        const st = fs.statSync(file);
        if (st.isFile() && now - st.mtimeMs > maxAgeMs) fs.unlinkSync(file);
      } catch {}
    }
  } catch {}
}

async function fetchGoogleTtsChunk(text) {
  const url = new URL('https://translate.google.com/translate_tts');
  url.searchParams.set('ie', 'UTF-8');
  url.searchParams.set('client', 'tw-ob');
  url.searchParams.set('tl', 'pt-BR');
  url.searchParams.set('q', text);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
        'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8'
      }
    });
    if (!r.ok) throw new Error(`Google TTS HTTP ${r.status}`);
    const type = String(r.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 300) throw new Error(`Google TTS retornou áudio inválido (${buf.length} bytes)`);
    if (type && !type.includes('audio') && !type.includes('mpeg') && !type.includes('octet-stream')) {
      throw new Error(`Google TTS retornou ${type}`);
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

function splitTtsText(text, max = 180) {
  const clean = cleanSpeechText(text);
  if (clean.length <= max) return [clean];
  const words = clean.split(/\s+/);
  const chunks = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 5);
}

async function synthesizeGoogleTts(clean, file) {
  const chunks = splitTtsText(clean);
  const buffers = [];
  for (const chunk of chunks) buffers.push(await fetchGoogleTtsChunk(chunk));
  const out = Buffer.concat(buffers);
  if (out.length < 300) throw new Error('Google TTS gerou MP3 vazio');
  fs.writeFileSync(file, out, { mode: 0o600 });
  return file;
}

async function synthesizeTts(text) {
  if (!config.ttsEnabled) return null;
  const clean = cleanSpeechText(text);
  if (!clean) return null;
  const id = crypto.randomUUID();
  const filename = `${id}.mp3`;
  const file = path.join(TTS_DIR, filename);
  let edgeError = null;

  try {
    const tts = new EdgeTTS({
      voice: femaleTtsVoice(config.ttsVoice),
      lang: 'pt-BR',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      pitch: `${Number(config.ttsPitch || 0) >= 0 ? '+' : ''}${Number(config.ttsPitch || 0)}%`,
      rate: `${Number(config.ttsRate || 0) >= 0 ? '+' : ''}${Number(config.ttsRate || 0)}%`,
      volume: `${Number(config.ttsVolume || 0) >= 0 ? '+' : ''}${Number(config.ttsVolume || 0)}%`,
      timeout: 18000
    });
    await tts.ttsPromise(clean, file);
    const st = fs.statSync(file);
    if (!st.isFile() || st.size < 300) throw new Error(`Edge TTS gerou MP3 inválido (${st.size || 0} bytes)`);
    runtime.ttsGenerated++;
    runtime.lastTtsError = null;
    runtime.lastTtsAt = new Date().toISOString();
    runtime.lastTtsProvider = 'edge-francisca';
    pruneTtsFiles();
    return `/tts/${filename}`;
  } catch (err) {
    edgeError = String(err?.message || err);
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
    console.error('[tts edge]', edgeError);
  }

  // Reserva: ainda produz um MP3 normal para o mesmo <audio> do Browser Source.
  // Isso evita ficar totalmente sem voz se o serviço Edge estiver indisponível no Render.
  try {
    await synthesizeGoogleTts(clean, file);
    const st = fs.statSync(file);
    if (!st.isFile() || st.size < 300) throw new Error(`TTS reserva gerou MP3 inválido (${st.size || 0} bytes)`);
    runtime.ttsGenerated++;
    runtime.lastTtsError = edgeError ? `Edge falhou; reserva usada: ${edgeError}` : null;
    runtime.lastTtsAt = new Date().toISOString();
    runtime.lastTtsProvider = 'google-pt-BR-reserva';
    pruneTtsFiles();
    return `/tts/${filename}`;
  } catch (fallbackErr) {
    runtime.ttsFailures++;
    runtime.lastTtsError = `Edge: ${edgeError || 'falha desconhecida'} | Reserva: ${String(fallbackErr?.message || fallbackErr)}`;
    runtime.lastTtsAt = new Date().toISOString();
    runtime.lastTtsProvider = 'falhou';
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
    throw new Error(runtime.lastTtsError);
  }
}

async function publishBotReply(text, meta = {}) {
  const clean = cleanSpeechText(text);
  if (!clean) return;
  let audioUrl = null;
  let ttsError = null;
  try {
    audioUrl = await synthesizeTts(clean);
  } catch (err) {
    ttsError = err.message;
    console.error('[tts]', err.message);
  }
  const payload = {
    id: crypto.randomUUID(),
    text: clean,
    audioUrl,
    aiName: config.aiName || 'CarolIA',
    avatarEnabled: config.avatarEnabled !== false,
    avatarImageUrl: config.avatarImageUrl || '',
    showSubtitles: false,
    ttsEnabled: config.ttsEnabled !== false,
    ttsError,
    createdAt: new Date().toISOString(),
    ...meta
  };
  runtime.spokenReplies++;
  runtime.lastSpokenReply = payload;
  sendOverlayEvent('reply', payload);
}

function isExpectedBot(username) {
  const u = String(username || '').trim().toLowerCase();
  return u === BOT_DISPLAY_NAME.toLowerCase() || u === 'streamelements';
}

function timerLine(req) {
  const base = publicBase(req);
  const key = encodeURIComponent(TIMER_KEY);
  return `$(if $(customapi ${base}/should?key=${key}) $(customapi ${base}/say?key=${key}&text=$(queryescape $(ai $(customapi ${base}/prompt?key=${key})))))`;
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

function makeOauthState(role = 'reader') {
  const safeRole = role === 'bot' ? 'bot' : 'reader';
  const payload = `${Date.now()}.${safeRole}.${crypto.randomBytes(16).toString('hex')}`;
  return `${b64url(payload)}.${hmac(payload)}`;
}

function parseOauthState(state) {
  try {
    const [encoded, sig] = String(state || '').split('.');
    const payload = Buffer.from(encoded, 'base64url').toString('utf8');
    const expected = hmac(payload);
    if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const [ts, role] = payload.split('.');
    if (Date.now() - Number(ts) >= 15 * 60 * 1000) return null;
    return { role: role === 'bot' ? 'bot' : 'reader' };
  } catch { return null; }
}

function verifyOauthState(state) { return Boolean(parseOauthState(state)); }

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


function setBotTokenData(data) {
  botTokenState.accessToken = String(data.access_token || botTokenState.accessToken || '');
  botTokenState.refreshToken = String(data.refresh_token || botTokenState.refreshToken || '');
  botTokenState.expiresAt = Date.now() + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
  persistBotTwitchSession();
  persistBotRefreshTokenToRender().catch(() => {});
}

async function exchangeCodeForBotToken(code, redirectUri) {
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
  setBotTokenData(data);
  return data;
}

async function persistBotRefreshTokenToRender() {
  if (!RENDER_API_KEY || !RENDER_SERVICE_ID || !botTokenState.refreshToken) return false;
  try {
    await rawFetchJson(`https://api.render.com/v1/services/${encodeURIComponent(RENDER_SERVICE_ID)}/env-vars/BOT_TWITCH_REFRESH_TOKEN`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: botTokenState.refreshToken })
    });
    runtime.bot.refreshTokenPersistence = 'Render API ✅';
    return true;
  } catch (err) {
    runtime.bot.refreshTokenPersistence = `Render API falhou: ${err.message}`;
    runtime.bot.lastError = err.message;
    return false;
  }
}

async function refreshBotUserToken() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !botTokenState.refreshToken) throw new Error('Conta que responde ainda não foi autorizada.');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: botTokenState.refreshToken,
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET
  });
  const data = await rawFetchJson('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  setBotTokenData(data);
  return botTokenState.accessToken;
}

async function ensureBotToken() {
  if (botTokenState.accessToken && Date.now() < botTokenState.expiresAt) return botTokenState.accessToken;
  if (botTokenState.refreshToken) return refreshBotUserToken();
  throw new Error('Conecte a conta icarolzinhabot no painel para a IA local responder no chat.');
}

async function botTwitchApi(endpoint, options = {}, retry = true) {
  const token = await ensureBotToken();
  const headers = {
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`,
    'Client-Id': TWITCH_CLIENT_ID
  };
  try {
    return await rawFetchJson(`https://api.twitch.tv/helix${endpoint}`, { ...options, headers });
  } catch (err) {
    if (retry && err.status === 401 && botTokenState.refreshToken) {
      await refreshBotUserToken();
      return botTwitchApi(endpoint, options, false);
    }
    throw err;
  }
}

async function loadBotIdentity() {
  const data = await botTwitchApi('/users');
  const user = data?.data?.[0];
  if (!user) throw new Error('Não consegui identificar a conta Twitch que responde.');
  botTokenState.userId = String(user.id);
  botTokenState.login = String(user.login);
  botTokenState.displayName = String(user.display_name || user.login);
  runtime.bot.connected = true;
  runtime.bot.userId = botTokenState.userId;
  runtime.bot.login = botTokenState.login;
  runtime.bot.displayName = botTokenState.displayName;
  runtime.bot.lastError = null;
  persistBotTwitchSession();
  return user;
}

async function sendBotChatMessage(message, replyParentMessageId = null) {
  if (!runtime.twitch.broadcasterId) await loadBroadcasterId();
  if (!botTokenState.userId) await loadBotIdentity();
  const body = {
    broadcaster_id: runtime.twitch.broadcasterId,
    sender_id: botTokenState.userId,
    message: cleanLocalAiReply(message).slice(0, 480)
  };
  if (replyParentMessageId) body.reply_parent_message_id = String(replyParentMessageId);
  const data = await botTwitchApi('/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = data?.data?.[0];
  if (!result?.is_sent) throw new Error(result?.drop_reason?.message || 'A Twitch não enviou a resposta da IA.');
  runtime.bot.connected = true;
  runtime.bot.lastError = null;
  return result;
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
      const chatterLogin = String(ev.chatter_user_login || '').toLowerCase();
      const messageText = ev.message?.text || '';
      if (isExpectedBot(chatterLogin)) {
        const messageId = String(ev.message_id || '');
        // Na v9 a resposta normal já passa por /say antes de chegar ao chat.
        // EventSub fica apenas como fallback para mensagens do bot que não vieram do Timer v9.
        if (wasDirectSpeechRecently(messageText)) {
          runtime.lastSpokenMessageId = messageId || runtime.lastSpokenMessageId;
          return;
        }
        if (!messageId || runtime.lastSpokenMessageId !== messageId) {
          runtime.lastSpokenMessageId = messageId || `${chatterLogin}:${messageText}:${Date.now()}`;
          runtime.awaitingBotResponseUntil = 0;
          publishBotReply(messageText, {
            source: chatterLogin === BOT_DISPLAY_NAME.toLowerCase() ? 'custom-bot-eventsub' : 'streamelements-eventsub',
            botName: ev.chatter_user_name || chatterLogin,
            twitchMessageId: messageId || null
          }).catch(err => console.error('[overlay reply]', err.message));
        }
        return;
      }
      const viewerMessage = {
        id: ev.message_id,
        username: ev.chatter_user_login,
        displayName: ev.chatter_user_name,
        text: messageText,
        badges: ev.badges || []
      };

      // V10: @menção direta da IA NÃO entra na fila do Timer.
      // Ela vai para o Qwen local do PC através do mesmo Browser Source do avatar.
      if (config.localAiEnabled && (!config.localAiMentionOnly || isDirectAiMention(messageText))) {
        runtime.messagesSeen++;
        if (!rememberMessageId(String(ev.message_id || ''))) {
          if (queueLocalAiTask(viewerMessage)) runtime.messagesAccepted++;
        }
        return;
      }

      acceptChatMessage(viewerMessage);
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

  const botLocal = readJson(BOT_TWITCH_SESSION_FILE, null);
  botTokenState.refreshToken = ENV_BOT_REFRESH_TOKEN || String(botLocal?.refreshToken || '');
  botTokenState.userId = String(botLocal?.userId || '');
  botTokenState.login = String(botLocal?.login || '');
  botTokenState.displayName = String(botLocal?.displayName || '');
  if (botTokenState.refreshToken) {
    runtime.bot.connected = true;
    runtime.bot.userId = botTokenState.userId || null;
    runtime.bot.login = botTokenState.login || null;
    runtime.bot.displayName = botTokenState.displayName || null;
    if (TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
      loadBotIdentity().catch(err => {
        runtime.bot.connected = false;
        runtime.bot.lastError = err.message;
      });
    }
  }

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

app.get('/tts/:file', (req, res) => {
  const name = path.basename(String(req.params.file || ''));
  if (!/^[a-f0-9-]{36}\.mp3$/i.test(name)) return res.status(404).end();
  const file = path.join(TTS_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.set({
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'audio/mpeg',
    'Accept-Ranges': 'bytes'
  });
  res.sendFile(file);
});

app.get('/api/overlay-events', overlayAuth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, aiName: config.aiName || 'CarolIA' })}\n\n`);
  overlayClients.add(res);
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, 20000);
  req.on('close', () => {
    clearInterval(heartbeat);
    overlayClients.delete(res);
  });
});

app.get('/api/overlay-config', overlayAuth, (_req, res) => {
  res.json({
    aiName: config.aiName || 'CarolIA',
    avatarEnabled: config.avatarEnabled !== false,
    avatarImageUrl: config.avatarImageUrl || '',
    showSubtitles: false,
    ttsEnabled: config.ttsEnabled !== false,
    localAiEnabled: config.localAiEnabled !== false,
    localAiUrl: `http://127.0.0.1:${Number(config.localAiPort || 11435)}`,
    localAiTimeoutSeconds: Number(config.localAiTimeoutSeconds || 60)
  });
});

app.get('/api/local-ai/claim', overlayAuth, (req, res) => {
  if (!config.localAiEnabled) return res.json({ ok: true, task: null, disabled: true });
  if (!botTokenState.refreshToken) return res.json({ ok: true, task: null, botMissing: true });
  const workerId = String(req.query.worker || 'overlay').slice(0, 80);
  const task = claimLocalAiTask(workerId);
  res.json({ ok: true, task });
});

app.post('/api/local-ai/result', overlayAuth, async (req, res) => {
  try {
    const id = String(req.body?.id || '');
    const reply = String(req.body?.reply || '');
    if (!id || !reply) return res.status(400).json({ error: 'Faltam id ou resposta da IA local.' });
    const result = await completeLocalAiTask(id, reply);
    res.json(result);
  } catch (err) {
    runtime.localAiFailures++;
    runtime.localAiWorker.error = err.message;
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/local-ai/release', overlayAuth, (req, res) => {
  const ok = releaseLocalAiTask(String(req.body?.id || ''), String(req.body?.worker || ''));
  res.json({ ok });
});

app.post('/api/local-ai/heartbeat', overlayAuth, (req, res) => {
  runtime.localAiWorker = {
    lastSeenAt: Date.now(),
    ok: Boolean(req.body?.ok),
    model: String(req.body?.model || '').slice(0, 160),
    error: String(req.body?.error || '').slice(0, 300)
  };
  res.json({ ok: true });
});

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
    const stateInfo = parseOauthState(req.query.state);
    if (!stateInfo) throw new Error('Estado OAuth inválido ou expirado. Volte ao painel e tente novamente.');
    if (req.query.error) throw new Error(`Twitch recusou autorização: ${req.query.error_description || req.query.error}`);
    if (!req.query.code) throw new Error('A Twitch não retornou o código de autorização.');

    if (stateInfo.role === 'bot') {
      await exchangeCodeForBotToken(String(req.query.code), callbackUrl(req));
      await loadBotIdentity();
      const autoSaved = await persistBotRefreshTokenToRender();
      const refresh = botTokenState.refreshToken.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const persistHtml = autoSaved
        ? '<p class="ok"><b>Token do bot salvo automaticamente no Render ✅</b></p>'
        : '<p>Para sobreviver a redeploys, copie abaixo para <code>BOT_TWITCH_REFRESH_TOKEN</code> no Render.</p><textarea rows="5" readonly>' + refresh + '</textarea>';
      return res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Bot CarolIA conectado</title><style>body{font-family:system-ui;background:#0d0a12;color:#fff;padding:32px;max-width:850px;margin:auto}code,textarea{background:#191220;color:#f6eaff;border:1px solid #40304f;border-radius:10px;padding:12px;width:100%;box-sizing:border-box}a{color:#c6a1ff}.ok{color:#71eda0}</style><h1 class="ok">Conta que responde conectada ✅</h1><p>As respostas imediatas da IA local sairão como <b>${botTokenState.displayName}</b>.</p>${persistHtml}<p><a href="/">Voltar ao painel</a></p>`);
    }

    await exchangeCodeForToken(String(req.query.code), callbackUrl(req));
    await loadAuthorizedIdentity();
    await startEventSub();
    const autoSaved = await persistRefreshTokenToRender();
    const refresh = tokenState.refreshToken.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const persistHtml = autoSaved
      ? '<p class="ok"><b>Refresh Token salvo automaticamente no Environment do Render ✅</b></p><p>A API do Render atualizou <code>TWITCH_REFRESH_TOKEN</code>. Não é necessário copiar o token manualmente.</p>'
      : '<p>Para a autorização sobreviver a reinícios/redeploys, copie o valor abaixo para <code>TWITCH_REFRESH_TOKEN</code> no Render.</p><textarea rows="5" readonly>' + refresh + '</textarea><p><b>Não publique esse token no GitHub e não envie para outras pessoas.</b></p>';
    res.type('html').send(`<!doctype html><meta charset="utf-8"><title>CarolIA conectada</title><style>body{font-family:system-ui;background:#0d0a12;color:#fff;padding:32px;max-width:850px;margin:auto}code,textarea{background:#191220;color:#f6eaff;border:1px solid #40304f;border-radius:10px;padding:12px;width:100%;box-sizing:border-box}a{color:#c6a1ff}.ok{color:#71eda0}</style><h1 class="ok">Twitch conectada ✅</h1><p>Conta autorizada: <b>${tokenState.displayName}</b>. Ela lê o chat de <b>${CHANNEL_NAME}</b>.</p>${persistHtml}<p><a href="/">Voltar ao painel</a></p>`);
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

app.get('/say', timerAuth, (req, res) => {
  // O StreamElements chama esta rota com o RESULTADO do $(ai), já escapado por $(queryescape).
  // Primeiro registramos/disparamos a fala; depois devolvemos o MESMO texto para ele publicar no chat.
  const text = truncateUtf8(cleanSpeechText(req.query.text || ''), 390);
  res.type('text/plain; charset=utf-8');
  if (!text) return res.send('');
  rememberDirectSpeech(text);
  publishBotReply(text, {
    source: 'timer-v9-direct',
    botName: BOT_DISPLAY_NAME || 'StreamElements'
  }).catch(err => console.error('[say/tts]', err.message));
  return res.send(text);
});

app.get('/prompt', timerAuth, (_req, res) => {
  res.type('text/plain; charset=utf-8');
  const item = runtime.pending?.item || lockCandidate();
  if (!item) return res.send('PT-BR. Responda apenas: oi');
  const prompt = buildPrompt(item);
  runtime.promptsServed++;
  runtime.lastAiDispatchAt = Date.now();
  runtime.awaitingBotResponseUntil = Date.now() + Number(config.botResponseWindowSeconds || 120) * 1000;
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
    spokenReplies: runtime.spokenReplies,
    ttsGenerated: runtime.ttsGenerated,
    ttsFailures: runtime.ttsFailures,
    lastTtsError: runtime.lastTtsError,
    lastTtsAt: runtime.lastTtsAt,
    lastTtsProvider: runtime.lastTtsProvider,
    lastSpokenReply: runtime.lastSpokenReply,
    overlayClients: overlayClients.size,
    localAiQueued: runtime.localAiQueued,
    localAiProcessed: runtime.localAiProcessed,
    localAiFailures: runtime.localAiFailures,
    localAiPending: runtime.localAiPending.filter(x => !x.done).length,
    localAiWorker: {
      ...runtime.localAiWorker,
      online: Boolean(runtime.localAiWorker.lastSeenAt && Date.now() - runtime.localAiWorker.lastSeenAt < 20000)
    },
    bot: runtime.bot,
    botRefreshTokenConfiguredInEnv: Boolean(ENV_BOT_REFRESH_TOKEN),
    suppressed: runtime.suppressed,
    lastAiDispatchAt: runtime.lastAiDispatchAt ? new Date(runtime.lastAiDispatchAt).toISOString() : null,
    lastCandidateAt: runtime.lastCandidateAt,
    configVersion,
    twitch: runtime.twitch,
    twitchConfigured: Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET),
    refreshTokenConfiguredInEnv: Boolean(ENV_REFRESH_TOKEN),
    renderAutoPersistence: Boolean(RENDER_API_KEY && RENDER_SERVICE_ID),
    timerLine: timerLine(req),
    overlayUrl: overlayUrl(req),
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
    overlayUrl: overlayUrl(req),
    oauthReady: Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET)
  });
});

app.get('/api/twitch-auth-url', panelAuth, (req, res) => {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    return res.status(400).json({ error: 'Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET no Render primeiro.' });
  }
  const role = String(req.query.role || 'reader') === 'bot' ? 'bot' : 'reader';
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', TWITCH_CLIENT_ID);
  url.searchParams.set('redirect_uri', callbackUrl(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', role === 'bot' ? 'user:write:chat' : 'user:read:chat');
  url.searchParams.set('force_verify', 'true');
  url.searchParams.set('state', makeOauthState(role));
  res.json({ url: url.toString(), role });
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

app.post('/api/test-avatar', panelAuth, async (req, res) => {
  try {
    const text = cleanSpeechText(req.body?.text || 'Oi! Eu sou a CarolIA. Agora eu tenho corpo e voz para aparecer na live!');
    await publishBotReply(text, { source: 'panel-test', botName: config.aiName || 'CarolIA' });
    res.json({ ok: true, text, overlayClients: overlayClients.size, ttsGenerated: runtime.ttsGenerated, ttsFailures: runtime.ttsFailures, lastTtsError: runtime.lastTtsError, lastSpokenReply: runtime.lastSpokenReply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  if (!OVERLAY_KEY) console.warn('[AVISO] OVERLAY_KEY/TIMER_KEY ausente; o avatar não conseguirá conectar.');
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) console.warn('[AVISO] Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET para ler o chat sem OBS.');
  bootstrapTwitchSession();
});
