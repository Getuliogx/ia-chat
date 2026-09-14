'use strict';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const key = params.get('key') || '';
const stage = $('stage');
const voice = $('voice');
const queue = [];
let busy = false;
let cfg = { aiName:'CarolIA', avatarEnabled:true, avatarImageUrl:'', showSubtitles:true, ttsEnabled:true };

function setConnection(text, state='') {
  const el = $('connection');
  el.textContent = text;
  el.className = `connection ${state}`.trim();
}

function applyAvatar() {
  $('name').textContent = cfg.aiName || 'CarolIA';
  const custom = $('customAvatar');
  const fallback = $('defaultAvatar');
  if (cfg.avatarEnabled === false) {
    custom.classList.add('hidden');
    fallback.classList.add('hidden');
    return;
  }
  if (cfg.avatarImageUrl) {
    custom.src = cfg.avatarImageUrl;
    custom.classList.remove('hidden');
    fallback.classList.add('hidden');
  } else {
    custom.classList.add('hidden');
    fallback.classList.remove('hidden');
  }
}

async function loadConfig() {
  if (!key) throw new Error('URL sem chave do avatar.');
  const r = await fetch(`/api/overlay-config?key=${encodeURIComponent(key)}`, {cache:'no-store'});
  if (!r.ok) throw new Error('Chave do avatar inválida.');
  cfg = {...cfg, ...(await r.json())};
  applyAvatar();
}

function setSpeaking(active) {
  stage.classList.toggle('speaking', active);
}

function showText(item) {
  $('name').textContent = item.aiName || cfg.aiName || 'CarolIA';
  $('subtitle').textContent = item.text || '';
  const show = item.showSubtitles !== false && Boolean(item.text);
  $('bubble').classList.toggle('hidden', !show);
}

function hideTextSoon(ms=1600) {
  setTimeout(() => {
    if (!busy) $('bubble').classList.add('hidden');
  }, ms);
}

function browserSpeechFallback(text) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window) || !text) return resolve();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    const voices = speechSynthesis.getVoices();
    const br = voices.find(v => /^pt-BR$/i.test(v.lang)) || voices.find(v => /^pt/i.test(v.lang));
    if (br) utter.voice = br;
    utter.onend = resolve;
    utter.onerror = resolve;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  });
}

async function playItem(item) {
  busy = true;
  cfg = {...cfg,
    aiName:item.aiName ?? cfg.aiName,
    avatarEnabled:item.avatarEnabled ?? cfg.avatarEnabled,
    avatarImageUrl:item.avatarImageUrl ?? cfg.avatarImageUrl,
    showSubtitles:item.showSubtitles ?? cfg.showSubtitles,
    ttsEnabled:item.ttsEnabled ?? cfg.ttsEnabled
  };
  applyAvatar();
  showText(item);
  setSpeaking(true);

  if (item.audioUrl && item.ttsEnabled !== false) {
    try {
      await new Promise((resolve, reject) => {
        const done = () => { cleanup(); resolve(); };
        const fail = () => { cleanup(); reject(new Error('Falha ao reproduzir TTS')); };
        const cleanup = () => {
          voice.removeEventListener('ended', done);
          voice.removeEventListener('error', fail);
        };
        voice.addEventListener('ended', done, {once:true});
        voice.addEventListener('error', fail, {once:true});
        voice.src = item.audioUrl;
        voice.volume = 1;
        voice.play().catch(fail);
      });
    } catch {
      await browserSpeechFallback(item.text);
    }
  } else if (item.ttsEnabled !== false) {
    await browserSpeechFallback(item.text);
  } else {
    await new Promise(r => setTimeout(r, Math.min(6500, Math.max(1800, (item.text || '').length * 45))));
  }

  setSpeaking(false);
  busy = false;
  hideTextSoon();
  runQueue();
}

function runQueue() {
  if (busy || !queue.length) return;
  const next = queue.shift();
  playItem(next).catch(() => {
    busy = false;
    setSpeaking(false);
    runQueue();
  });
}

function enqueue(item) {
  queue.push(item);
  while (queue.length > 8) queue.shift();
  runQueue();
}

async function start() {
  try {
    await loadConfig();
    setConnection('CONECTADO', 'ok');
    const es = new EventSource(`/api/overlay-events?key=${encodeURIComponent(key)}`);
    es.addEventListener('ready', () => setConnection('CONECTADO', 'ok'));
    es.addEventListener('reply', ev => {
      try { enqueue(JSON.parse(ev.data)); } catch {}
    });
    es.onerror = () => setConnection('RECONECTANDO', 'err');
    es.onopen = () => setConnection('CONECTADO', 'ok');
  } catch (err) {
    setConnection(err.message || 'ERRO', 'err');
  }
}

window.addEventListener('beforeunload', () => {
  try { voice.pause(); } catch {}
  try { speechSynthesis.cancel(); } catch {}
});

start();
