
'use strict';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const key = params.get('key') || '';
const stage = $('stage');
const voice = $('voice');
const queue = [];
let busy = false;
let cfg = { aiName:'CarolIA', avatarEnabled:true, avatarImageUrl:'', ttsEnabled:true };
let motionTimer = 0;
let currentBlobUrl = '';

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

function setTalkLevel(value) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  stage.style.setProperty('--talk', v.toFixed(3));
}

function stopMotion() {
  if (motionTimer) clearInterval(motionTimer);
  motionTimer = 0;
  setTalkLevel(0);
}

function setSpeaking(active) {
  stage.classList.toggle('speaking', active);
  if (!active) stopMotion();
}

// A animação NÃO passa o áudio por WebAudio/AudioContext.
// Isso deixa o <audio> sair nativamente no Browser Source do OBS.
function startSpeakingMotion() {
  stopMotion();
  motionTimer = setInterval(() => {
    if (!busy || voice.paused || voice.ended) {
      setTalkLevel(0.05);
      return;
    }
    const t = Number(voice.currentTime || 0);
    const wave = Math.abs(Math.sin(t * 12.5) * 0.46 + Math.sin(t * 21.7) * 0.24);
    setTalkLevel(Math.max(0.12, Math.min(0.9, 0.18 + wave)));
  }, 55);
}

function waitForText(text) {
  const ms = Math.min(6500, Math.max(1300, String(text || '').length * 42));
  setSpeaking(true);
  const started = Date.now();
  stopMotion();
  motionTimer = setInterval(() => {
    if (Date.now() - started >= ms) return;
    setTalkLevel(0.18 + Math.random() * 0.45);
  }, 80);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function revokeBlob() {
  if (currentBlobUrl) {
    try { URL.revokeObjectURL(currentBlobUrl); } catch {}
    currentBlobUrl = '';
  }
}

async function fetchAudioBlob(url) {
  const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
    cache:'no-store',
    credentials:'same-origin'
  });
  if (!r.ok) throw new Error(`MP3 HTTP ${r.status}`);
  const blob = await r.blob();
  if (!blob.size || blob.size < 300) throw new Error('MP3 vazio/inválido');
  return blob;
}

const femaleVoiceHints = [
  'francisca','maria','thalita','fernanda','leticia','letícia','giovanna','vitoria','vitória','camila','luciana','carolina'
];

function getFemalePtBrVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const pt = voices.filter(v => /^pt(-|_)?br$/i.test(String(v.lang || '').replace('_','-')) || /^pt-BR$/i.test(String(v.lang || '')));
  return pt.find(v => femaleVoiceHints.some(h => String(v.name || '').toLowerCase().includes(h))) || null;
}

function speakFemaleBrowserFallback(text) {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return resolve(false);
    const speak = () => {
      const chosen = getFemalePtBrVoice();
      if (!chosen) return resolve(false); // nunca escolhe uma voz desconhecida/masculina
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text || ''));
        u.voice = chosen;
        u.lang = 'pt-BR';
        u.rate = 1;
        u.pitch = 1;
        u.volume = 1;
        u.onstart = () => { setSpeaking(true); startFallbackSpeechMotion(); };
        u.onend = () => { stopMotion(); resolve(true); };
        u.onerror = () => { stopMotion(); resolve(false); };
        window.speechSynthesis.speak(u);
      } catch { resolve(false); }
    };
    const voices = window.speechSynthesis.getVoices?.() || [];
    if (voices.length) return speak();
    const timer = setTimeout(speak, 500);
    window.speechSynthesis.addEventListener?.('voiceschanged', () => { clearTimeout(timer); speak(); }, {once:true});
  });
}

function startFallbackSpeechMotion() {
  stopMotion();
  motionTimer = setInterval(() => {
    if (!busy) return setTalkLevel(0);
    setTalkLevel(0.2 + Math.random() * 0.52);
  }, 75);
}

async function playServerAudio(item) {
  if (!item.audioUrl || item.ttsEnabled === false) return false;
  try {
    const blob = await fetchAudioBlob(item.audioUrl);
    revokeBlob();
    currentBlobUrl = URL.createObjectURL(blob);

    voice.pause();
    voice.currentTime = 0;
    voice.muted = false;
    voice.defaultMuted = false;
    voice.volume = 1;
    voice.src = currentBlobUrl;
    voice.load();

    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (ok, err) => {
        if (settled) return;
        settled = true;
        cleanup();
        ok ? resolve() : reject(err || new Error('Falha ao tocar MP3'));
      };
      const cleanup = () => {
        voice.removeEventListener('ended', onEnded);
        voice.removeEventListener('error', onError);
        voice.removeEventListener('playing', onPlaying);
        voice.removeEventListener('canplay', onCanPlay);
      };
      const onEnded = () => finish(true);
      const onError = () => finish(false, new Error(`Erro de áudio ${voice.error?.code || ''}`.trim()));
      const onPlaying = () => startSpeakingMotion();
      const onCanPlay = async () => {
        try {
          const promise = voice.play();
          if (promise && typeof promise.then === 'function') await promise;
        } catch (err) {
          finish(false, err);
        }
      };
      voice.addEventListener('ended', onEnded, {once:true});
      voice.addEventListener('error', onError, {once:true});
      voice.addEventListener('playing', onPlaying, {once:true});
      voice.addEventListener('canplay', onCanPlay, {once:true});

      // Alguns CEF/OBS já ficam prontos imediatamente e não disparam canplay de novo.
      if (voice.readyState >= 3) onCanPlay();
      setTimeout(() => {
        if (!settled && voice.paused) onCanPlay();
      }, 350);
    });
    return true;
  } catch (err) {
    console.error('[CarolIA avatar] falha ao tocar TTS:', err?.message || err);
    return false;
  } finally {
    stopMotion();
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
  if (!played) {
    // Última reserva local: somente uma voz PT-BR de nome feminino conhecido.
    // Nunca pega a primeira voz disponível, evitando voltar para voz masculina.
    const browserSpoke = await speakFemaleBrowserFallback(item.text);
    if (!browserSpoke) await waitForText(item.text);
  }

  setSpeaking(false);
  busy = false;
  revokeBlob();
  runQueue();
}

function runQueue() {
  if (busy || !queue.length) return;
  const next = queue.shift();
  playItem(next).catch(err => {
    console.error('[CarolIA avatar] fila:', err?.message || err);
    busy = false;
    setSpeaking(false);
    revokeBlob();
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
    startLocalAiWorker();
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
  if (localAiLoopTimer) clearInterval(localAiLoopTimer);
  stopMotion();
  try { voice.pause(); } catch {}
  revokeBlob();
});

start();

// ---------------- V10: IA local leve (Qwen 0.6B) ----------------
const localWorkerId = (globalThis.crypto?.randomUUID?.() || `worker-${Date.now()}-${Math.random()}`).slice(0, 80);
let localAiLoopTimer = 0;
let localAiRunning = false;
let localModelId = '';
let lastLocalHeartbeat = 0;

function localFetch(url, options = {}) {
  // targetAddressSpace é entendido por Chromium recente e ignorado por CEF antigo.
  return fetch(url, { ...options, targetAddressSpace: 'loopback' });
}

async function discoverLocalModel() {
  const base = String(cfg.localAiUrl || 'http://127.0.0.1:11435').replace(/\/$/, '');
  const r = await localFetch(`${base}/v1/models`, { cache:'no-store' });
  if (!r.ok) throw new Error(`llama.cpp HTTP ${r.status}`);
  const data = await r.json();
  localModelId = String(data?.data?.[0]?.id || data?.models?.[0]?.id || 'local');
  return localModelId;
}

async function reportLocalAi(ok, error = '') {
  const now = Date.now();
  if (now - lastLocalHeartbeat < 5000 && ok) return;
  lastLocalHeartbeat = now;
  try {
    await fetch(`/api/local-ai/heartbeat?key=${encodeURIComponent(key)}`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ workerId:localWorkerId, ok, model:localModelId, error:String(error || '') })
    });
  } catch {}
}

async function callLocalAi(task) {
  const base = String(cfg.localAiUrl || 'http://127.0.0.1:11435').replace(/\/$/, '');
  if (!localModelId) await discoverLocalModel();
  const controller = new AbortController();
  const timeoutMs = Math.max(15000, Number(cfg.localAiTimeoutSeconds || 60) * 1000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await localFetch(`${base}/v1/chat/completions`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      signal:controller.signal,
      body:JSON.stringify({
        model:localModelId || 'local',
        messages:Array.isArray(task.messages) ? task.messages : [],
        temperature:Number(task.temperature || 0.8),
        top_p:0.9,
        top_k:30,
        max_tokens:Number(task.maxTokens || 96),
        stream:false,
        cache_prompt:true,
        reasoning_effort:'none',
        chat_template_kwargs:{ enable_thinking:false }
      })
    });
    if (!r.ok) throw new Error(`llama.cpp respondeu HTTP ${r.status}: ${(await r.text()).slice(0,180)}`);
    const data = await r.json();
    let reply = String(data?.choices?.[0]?.message?.content || data?.content || '').trim();
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi,' ').replace(/<think>[\s\S]*$/gi,' ').replace(/\s+/g,' ').trim();
    if (!reply) throw new Error('Qwen local devolveu resposta vazia.');
    return reply;
  } finally {
    clearTimeout(timer);
  }
}

async function claimLocalTask() {
  const r = await fetch(`/api/local-ai/claim?key=${encodeURIComponent(key)}&worker=${encodeURIComponent(localWorkerId)}`, {cache:'no-store'});
  if (!r.ok) throw new Error(`Render claim HTTP ${r.status}`);
  const data = await r.json();
  return data?.task || null;
}

async function releaseLocalTask(id) {
  try {
    await fetch(`/api/local-ai/release?key=${encodeURIComponent(key)}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id, worker:localWorkerId})
    });
  } catch {}
}

async function submitLocalResult(id, reply) {
  const r = await fetch(`/api/local-ai/result?key=${encodeURIComponent(key)}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id, reply})
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Render result HTTP ${r.status}`);
  return data;
}

async function localAiTick() {
  if (localAiRunning || cfg.localAiEnabled === false || !key) return;
  localAiRunning = true;
  let task = null;
  try {
    if (!localModelId) await discoverLocalModel();
    await reportLocalAi(true, '');
    task = await claimLocalTask();
    if (!task) return;
    const reply = await callLocalAi(task);
    await submitLocalResult(task.id, reply);
    await reportLocalAi(true, '');
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'IA local demorou demais e foi interrompida.' : String(err?.message || err);
    console.error('[CarolIA IA local]', message);
    if (task?.id) await releaseLocalTask(task.id);
    localModelId = '';
    await reportLocalAi(false, message);
  } finally {
    localAiRunning = false;
  }
}

function startLocalAiWorker() {
  if (localAiLoopTimer) clearInterval(localAiLoopTimer);
  if (cfg.localAiEnabled === false) return;
  localAiTick();
  localAiLoopTimer = setInterval(localAiTick, 1400);
}
