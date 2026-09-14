
'use strict';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const key = params.get('key') || '';
const stage = $('stage');
const voice = $('voice');
const queue = [];
let busy = false;
let cfg = { aiName:'CarolIA', avatarEnabled:true, avatarImageUrl:'', ttsEnabled:true };
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let rafId = 0;
let fallbackTimer = 0;

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
  if (!active) setTalkLevel(0);
}

function setTalkLevel(value) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  stage.style.setProperty('--talk', v.toFixed(3));
}

function stopVisualizers() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (fallbackTimer) clearInterval(fallbackTimer);
  fallbackTimer = 0;
  setTalkLevel(0);
}

function ensureAnalyser() {
  if (analyser) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    audioCtx = new AC();
    sourceNode = audioCtx.createMediaElementSource(voice);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    return true;
  } catch (err) {
    console.warn('[CarolIA avatar] analisador não disponível:', err.message);
    analyser = null;
    return false;
  }
}

function startAudioReactiveMotion() {
  stopVisualizers();
  if (!ensureAnalyser()) return;
  const bins = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    if (!busy) {
      setTalkLevel(0);
      return;
    }
    try {
      analyser.getByteFrequencyData(bins);
      let sum = 0;
      for (let i = 0; i < bins.length; i += 1) sum += bins[i];
      const avg = sum / (bins.length || 1);
      const talk = Math.max(0.04, Math.min(1, avg / 72));
      setTalkLevel(talk);
    } catch {
      setTalkLevel(0.2);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function startFallbackMotion(durationMs) {
  stopVisualizers();
  const stopAt = Date.now() + Math.max(900, durationMs || 2000);
  fallbackTimer = setInterval(() => {
    if (!busy || Date.now() >= stopAt) {
      clearInterval(fallbackTimer);
      fallbackTimer = 0;
      setTalkLevel(0);
      return;
    }
    setTalkLevel(0.18 + Math.random() * 0.48);
  }, 85);
}

function waitForText(text) {
  const ms = Math.min(6500, Math.max(1300, String(text || '').length * 42));
  startFallbackMotion(ms);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function playServerAudio(item) {
  if (!item.audioUrl || item.ttsEnabled === false) return false;
  try {
    ensureAnalyser();
    if (audioCtx?.state === 'suspended') {
      try { await audioCtx.resume(); } catch {}
    }
    await new Promise((resolve, reject) => {
      const done = () => { cleanup(); stopVisualizers(); resolve(); };
      const fail = () => { cleanup(); stopVisualizers(); reject(new Error('Falha ao reproduzir o TTS feminino')); };
      const cleanup = () => {
        voice.removeEventListener('ended', done);
        voice.removeEventListener('error', fail);
        voice.removeEventListener('playing', onPlaying);
      };
      const onPlaying = () => startAudioReactiveMotion();
      voice.addEventListener('ended', done, {once:true});
      voice.addEventListener('error', fail, {once:true});
      voice.addEventListener('playing', onPlaying, {once:true});
      voice.src = `${item.audioUrl}${item.audioUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      voice.volume = 1;
      const result = voice.play();
      if (result && typeof result.catch === 'function') result.catch(fail);
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

  stopVisualizers();
  setSpeaking(false);
  busy = false;
  runQueue();
}

function runQueue() {
  if (busy || !queue.length) return;
  const next = queue.shift();
  playItem(next).catch(() => {
    stopVisualizers();
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
  stopVisualizers();
  try { voice.pause(); } catch {}
});

start();
