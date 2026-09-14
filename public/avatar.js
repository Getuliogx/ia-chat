'use strict';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const key = params.get('key') || '';
const stage = $('stage');
const voice = $('voice');
const queue = [];
let busy = false;
let cfg = { aiName:'CarolIA', avatarEnabled:true, avatarImageUrl:'', ttsEnabled:true };

function applyAvatar() {
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

function waitForText(text) {
  return new Promise(resolve => setTimeout(resolve, Math.min(6500, Math.max(1300, String(text || '').length * 42))));
}

async function playServerAudio(item) {
  if (!item.audioUrl || item.ttsEnabled === false) return false;
  try {
    await new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('Falha ao reproduzir o TTS feminino')); };
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
    return true;
  } catch (err) {
    console.error('[CarolIA avatar] áudio feminino não reproduzido:', err.message);
    return false;
  }
}

async function playItem(item) {
  busy = true;
  cfg = {...cfg,
    aiName:item.aiName ?? cfg.aiName,
    avatarEnabled:item.avatarEnabled ?? cfg.avatarEnabled,
    avatarImageUrl:item.avatarImageUrl ?? cfg.avatarImageUrl,
    ttsEnabled:item.ttsEnabled ?? cfg.ttsEnabled
  };
  applyAvatar();
  setSpeaking(true);

  const played = await playServerAudio(item);
  if (!played) await waitForText(item.text);

  setSpeaking(false);
  busy = false;
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
    const es = new EventSource(`/api/overlay-events?key=${encodeURIComponent(key)}`);
    es.addEventListener('reply', ev => {
      try { enqueue(JSON.parse(ev.data)); } catch {}
    });
    es.onerror = () => console.warn('[CarolIA avatar] reconectando ao servidor...');
  } catch (err) {
    console.error('[CarolIA avatar]', err.message || err);
  }
}

window.addEventListener('beforeunload', () => {
  try { voice.pause(); } catch {}
});

start();
