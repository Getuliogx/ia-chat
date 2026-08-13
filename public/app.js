'use strict';

const $ = id => document.getElementById(id);
let key = localStorage.getItem('carolia.panelKey') || '';
let cfg = null;

const sliderDefs = [
  ['joy','😄 Felicidade'],
  ['sarcasm','😈 Sarcasmo'],
  ['irritation','😡 Irritação'],
  ['energy','⚡ Energia'],
  ['chaos','💥 Caos'],
  ['empathy','❤️ Empatia'],
  ['memes','😂 Memes'],
  ['sensuality','💋 Sensualidade'],
  ['naughtiness','😏 Atrevimento']
];

function authHeaders(extra={}) { return { 'X-Panel-Key': key, ...extra }; }
async function api(url, options={}) {
  options.headers = authHeaders(options.headers || {});
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

function makeSliders() {
  $('sliders').innerHTML = '';
  for (const [id,label] of sliderDefs) {
    const div = document.createElement('div');
    div.className = 'slider-item';
    div.innerHTML = `<div class="slider-title"><span>${label}</span><b id="${id}Out">0</b></div><input id="${id}" type="range" min="0" max="100">`;
    $('sliders').appendChild(div);
    div.querySelector('input').addEventListener('input', e => $(id+'Out').textContent = e.target.value);
  }
}

function fill(c) {
  cfg = c;
  const ids = [
    'enabled','aiName','responseLength','profanity','adultFlirt','mentionUser','answerChance',
    'cooldownSeconds','maxQueueAgeSeconds','queueSize','minMessageChars','ignoreCommands',
    'ignoreBroadcaster','ignoreBots','preferQuestions','preferMentions','preferFlirtyMessages','customPersonality'
  ];
  for (const id of ids) {
    const el = $(id); if (!el) continue;
    if (el.type === 'checkbox') el.checked = Boolean(c[id]); else el.value = c[id];
  }
  for (const [id] of sliderDefs) {
    $(id).value = c[id];
    $(id+'Out').textContent = c[id];
  }
  $('answerChanceOut').textContent = `${c.answerChance}%`;
  $('ignoreUsers').value = (c.ignoreUsers || []).join('\n');
}

function collect() {
  const out = { ...cfg };
  ['enabled','adultFlirt','mentionUser','ignoreCommands','ignoreBroadcaster','ignoreBots','preferQuestions','preferMentions','preferFlirtyMessages']
    .forEach(id => out[id] = $(id).checked);
  ['aiName','responseLength','customPersonality'].forEach(id => out[id] = $(id).value);
  ['profanity','answerChance','cooldownSeconds','maxQueueAgeSeconds','queueSize','minMessageChars']
    .forEach(id => out[id] = Number($(id).value));
  sliderDefs.forEach(([id]) => out[id] = Number($(id).value));
  out.ignoreUsers = $('ignoreUsers').value.split(/\n|,/).map(s => s.trim()).filter(Boolean);
  return out;
}

async function loadSetup() {
  const s = await api('/api/setup');
  $('timerLine').value = s.timerLine || '';
  $('callbackUrl').value = s.callbackUrl || '';
  $('expectedBot').textContent = s.expectedBotName || 'icarolzinhabot';
}

async function login() {
  key = $('panelKey').value.trim();
  try {
    const data = await api('/api/config');
    localStorage.setItem('carolia.panelKey', key);
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    fill(data.config);
    await loadSetup();
    $('loginMsg').textContent = '';
    $('exportConfig').href = `/api/export-config?panelKey=${encodeURIComponent(key)}`;
    refreshStatus();
  } catch (e) {
    $('loginMsg').textContent = e.message;
    $('loginMsg').className = 'msg err';
  }
}

async function save() {
  try {
    const data = await api('/api/config', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(collect()) });
    fill(data.config);
    await loadSetup();
    $('saveMsg').textContent = 'Configuração salva.';
    $('saveMsg').className = 'msg ok';
  } catch (e) {
    $('saveMsg').textContent = e.message;
    $('saveMsg').className = 'msg err';
  }
}

async function applyPreset(name) {
  try {
    const data = await api('/api/apply-preset/'+encodeURIComponent(name), {method:'POST'});
    fill(data.config);
    $('saveMsg').textContent = `Preset ${name} aplicado e salvo.`;
    $('saveMsg').className = 'msg ok';
  } catch (e) { alert(e.message); }
}

async function refreshStatus() {
  if ($('app').classList.contains('hidden')) return;
  try {
    const s = await api('/api/status');
    const connected = s.twitch?.status === 'conectado';
    $('dot').classList.toggle('on', connected);
    $('twitchMiniDot').classList.toggle('on', connected);
    $('twitchStatus').textContent = connected ? 'Twitch conectada' : `Twitch: ${s.twitch?.status || 'desconectado'}`;
    $('queueStatus').textContent = `Fila ${s.queueLength} • ${s.messagesAccepted} válidas • ${s.promptsServed} prompts`;
    $('twitchIdentity').textContent = s.twitch?.authorizedDisplayName
      ? `${s.twitch.authorizedDisplayName} → #${s.channel}`
      : 'Nenhuma conta Twitch autorizada';
    const envNote = s.renderAutoPersistence ? 'Persistência automática via Render API ✅' : (s.refreshTokenConfiguredInEnv ? 'Refresh Token salvo no Render ✅' : 'Refresh Token precisa ser salvo no Render');
    $('twitchDetail').textContent = `${s.twitch?.status || 'desconectado'} • ${envNote}`;
    $('messagesSeen').textContent = s.messagesSeen;
    $('messagesAccepted').textContent = s.messagesAccepted;
    $('queueLength').textContent = s.queueLength;
    $('promptsServed').textContent = s.promptsServed;
    $('lastError').textContent = s.twitch?.lastError || 'Nenhum.';
    $('callbackUrl').value = s.callbackUrl || $('callbackUrl').value;
    $('timerLine').value = s.timerLine || $('timerLine').value;
  } catch {}
}

async function simulate() {
  try {
    const data = await api('/api/simulate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:$('testUser').value,text:$('testText').value})
    });
    $('promptPreview').textContent = `${data.prompt}\n\n[${data.promptBytes} bytes]`;
  } catch(e) { $('promptPreview').textContent = 'Erro: '+e.message; }
}

async function injectTest() {
  try {
    const data = await api('/api/inject-test-message', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:$('testUser').value,text:$('testText').value})
    });
    $('promptPreview').textContent = data.accepted ? `Mensagem colocada na fila. Fila: ${data.queueLength}` : 'Mensagem rejeitada pelos filtros.';
    refreshStatus();
  } catch(e) { $('promptPreview').textContent = 'Erro: '+e.message; }
}

async function connectTwitch() {
  try {
    const data = await api('/api/twitch-auth-url');
    window.location.href = data.url;
  } catch (e) { alert(e.message); }
}

async function reconnectTwitch() {
  try {
    await api('/api/reconnect-twitch', {method:'POST'});
    refreshStatus();
  } catch (e) { alert(e.message); }
}

async function copyFrom(id, button) {
  await navigator.clipboard.writeText($(id).value);
  const old = button.textContent;
  button.textContent = 'Copiado!';
  setTimeout(() => button.textContent = old, 1200);
}

makeSliders();
$('panelKey').value = key;
$('loginBtn').addEventListener('click', login);
$('panelKey').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
$('saveBtn').addEventListener('click', save);
$('answerChance').addEventListener('input', e => $('answerChanceOut').textContent = e.target.value+'%');
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => copyFrom(b.dataset.copy, b)));
$('simulateBtn').addEventListener('click', simulate);
$('injectBtn').addEventListener('click', injectTest);
$('connectTwitch').addEventListener('click', connectTwitch);
$('reconnectTwitch').addEventListener('click', reconnectTwitch);
$('clearQueue').addEventListener('click', async () => { await api('/api/clear-queue',{method:'POST'}); refreshStatus(); });
setInterval(refreshStatus, 3000);
if (key) login();
