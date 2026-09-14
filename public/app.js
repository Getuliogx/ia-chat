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
  ['naughtiness','😏 Atrevimento'],
  ['affection','🤗 Carinho'],
  ['shyness','🙈 Timidez'],
  ['romanticism','💕 Romantismo'],
  ['humor','🤣 Humor'],
  ['teasing','🙃 Deboche'],
  ['irony','😼 Ironia'],
  ['drama','🎭 Drama'],
  ['jealousy','😒 Ciúmes'],
  ['curiosity','🔎 Curiosidade'],
  ['patience','🧘 Paciência'],
  ['confidence','😎 Confiança'],
  ['boldness','🔥 Ousadia'],
  ['dominance','👑 Dominância'],
  ['mystery','🔮 Mistério'],
  ['elegance','💎 Elegância'],
  ['competitiveness','🎮 Competitividade'],
  ['gossip','🗣️ Fofoca'],
  ['trolling','🧌 Troll'],
  ['sweetness','🥰 Doçura'],
  ['seriousness','🧐 Seriedade']
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
    'ignoreBroadcaster','ignoreBots','preferQuestions','preferMentions','preferFlirtyMessages','customPersonality',
    'avatarEnabled','avatarImageUrl','ttsEnabled','ttsVoice','ttsRate','ttsPitch','ttsVolume','botResponseWindowSeconds',
    'localAiEnabled','localAiMentionOnly','localAiPort','localAiMaxTokens','localAiTemperature','localAiTimeoutSeconds'
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
  ['enabled','adultFlirt','mentionUser','ignoreCommands','ignoreBroadcaster','ignoreBots','preferQuestions','preferMentions','preferFlirtyMessages','avatarEnabled','ttsEnabled','localAiEnabled','localAiMentionOnly']
    .forEach(id => out[id] = $(id).checked);
  ['aiName','responseLength','customPersonality','avatarImageUrl','ttsVoice'].forEach(id => out[id] = $(id).value);
  ['profanity','answerChance','cooldownSeconds','maxQueueAgeSeconds','queueSize','minMessageChars','ttsRate','ttsPitch','ttsVolume','botResponseWindowSeconds','localAiPort','localAiMaxTokens','localAiTemperature','localAiTimeoutSeconds']
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
  $('overlayUrl').value = s.overlayUrl || '';
  $('openOverlay').dataset.url = s.overlayUrl || '';
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
    $('spokenReplies').textContent = s.spokenReplies || 0;
    $('overlayClients').textContent = s.overlayClients || 0;
    if ($('localAiPending')) $('localAiPending').textContent = s.localAiPending || 0;
    if ($('localAiProcessed')) $('localAiProcessed').textContent = s.localAiProcessed || 0;
    const localOnline = Boolean(s.localAiWorker?.online && s.localAiWorker?.ok);
    if ($('localAiMiniDot')) $('localAiMiniDot').classList.toggle('on', localOnline);
    if ($('localAiStatus')) $('localAiStatus').textContent = localOnline ? 'IA local conectada ao Qwen' : 'IA local offline/aguardando';
    if ($('localAiDetail')) $('localAiDetail').textContent = localOnline
      ? `${s.localAiWorker?.model || 'Qwen local'} • ${s.localAiPending || 0} aguardando`
      : (s.localAiWorker?.error || 'Abra o avatar no OBS e execute INICIAR_CAROLIA_LOCAL.cmd.');
    if ($('lastLocalAiError')) $('lastLocalAiError').textContent = s.localAiWorker?.error || s.relay?.lastError || 'Nenhum.';
    const relayReady = Boolean(s.relay?.ready);
    if ($('relayMiniDot')) $('relayMiniDot').classList.toggle('on', relayReady);
    if ($('relayIdentity')) $('relayIdentity').textContent = relayReady ? 'StreamElements preparado' : 'Relay aguardando/preparação necessária';
    if ($('relayDetail')) $('relayDetail').textContent = relayReady
      ? `Comando ${s.relay?.command || '!caroliareply'} • usa ${s.twitch?.authorizedDisplayName || 'sua conta MOD'} para acionar o bot`
      : (s.relay?.lastError || 'Reconecte sua Twitch (MOD) e clique em Preparar relay.');
    if ($('ttsGenerated')) $('ttsGenerated').textContent = s.ttsGenerated || 0;
    if ($('ttsFailures')) $('ttsFailures').textContent = s.ttsFailures || 0;
    if ($('lastTtsError')) $('lastTtsError').textContent = s.lastTtsError || 'Nenhum.';
    $('lastError').textContent = s.twitch?.lastError || 'Nenhum.';
    $('callbackUrl').value = s.callbackUrl || $('callbackUrl').value;
    $('timerLine').value = s.timerLine || $('timerLine').value;
    $('overlayUrl').value = s.overlayUrl || $('overlayUrl').value;
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

async function testAvatar() {
  const msg = $('avatarMsg');
  try {
    msg.textContent = 'Gerando voz e enviando para o avatar...';
    msg.className = 'msg';
    const data = await api('/api/test-avatar', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:$('avatarTestText').value})
    });
    const audioOk = Boolean(data.lastSpokenReply?.audioUrl) && !data.lastTtsError;
    if (data.overlayClients <= 0) {
      msg.textContent = 'Nenhum avatar está conectado. Abra a URL do avatar/Browser Source.';
      msg.className = 'msg err';
    } else if (!audioOk) {
      msg.textContent = `Avatar conectado, mas o TTS falhou: ${data.lastTtsError || 'MP3 não foi gerado.'}`;
      msg.className = 'msg err';
    } else {
      msg.textContent = `MP3 gerado e enviado para ${data.overlayClients} avatar(s).`;
      msg.className = 'msg ok';
    }
    refreshStatus();
  } catch (e) {
    msg.textContent = e.message;
    msg.className = 'msg err';
  }
}

async function connectTwitch() {
  try {
    const data = await api('/api/twitch-auth-url');
    window.location.href = data.url;
  } catch (e) { alert(e.message); }
}

async function setupSeRelay() {
  try {
    const data = await api('/api/setup-se-relay', {method:'POST'});
    alert(data.ok ? 'Relay do StreamElements preparado. Agora @menções podem responder pelo bot sem login na conta do bot.' : 'Não foi possível preparar o relay.');
    refreshStatus();
  } catch (e) { alert(e.message); }
}



async function findRenderGoogleDeep() {
  const out = $('renderAccountResult');
  const btn = $('findRenderGoogleDeep');
  if (!out) return;
  out.textContent = 'Fazendo varredura profunda dentro do runtime do Render...';
  out.className = 'smallpre msg';
  if (btn) btn.disabled = true;
  try {
    const data = await api('/api/render-google-email-deep');
    const lines = [];
    lines.push('=== VARREDURA PROFUNDA DA CONTA GOOGLE ===');
    if (data.serviceName) lines.push(`Servico Render: ${data.serviceName}`);
    if (data.serviceId) lines.push(`Service ID: ${data.serviceId}`);
    lines.push(`Arquivos/verificacoes processados: ${data.checkedFiles ?? 0}`);
    lines.push('');
    if (Array.isArray(data.emails) && data.emails.length) {
      const unique = [];
      const seen = new Set();
      for (const item of data.emails) {
        if (!seen.has(item.email)) { seen.add(item.email); unique.push(item); }
      }
      lines.push('CONTAS GOOGLE ENCONTRADAS NO PROPRIO RUNTIME:');
      unique.forEach((x,i) => lines.push(`${i+1}. ${x.email}\n   origem: ${x.source}${x.detail ? ` — ${x.detail}` : ''}`));
      lines.push('');
      lines.push('Teste primeiro os enderecos acima no login Google do Render.');
      out.className = 'smallpre msg ok';
    } else {
      lines.push('NENHUM @gmail.com ou @googlemail.com EXISTE nos dados que o servico Render consegue ler.');
      lines.push('Isso significa que o login Google privado nao foi repassado ao processo do projeto.');
      out.className = 'smallpre msg err';
    }
    out.textContent = lines.join('\n');
  } catch (err) {
    out.textContent = `Erro na varredura: ${err.message}`;
    out.className = 'smallpre msg err';
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function findRenderAccount() {
  const out = $('renderAccountResult');
  const openBtn = $('openRenderService');
  if (!out) return;
  out.textContent = 'Lendo os metadados do serviço e procurando pistas no GitHub...';
  out.className = 'smallpre';
  if (openBtn) openBtn.classList.add('hidden');
  try {
    const data = await api('/api/render-account');
    const lines = [];

    if (data.direct?.email) {
      lines.push(`✅ E-MAIL CONFIRMADO PELA API DO RENDER: ${data.direct.email}`);
      if (data.direct.name) lines.push(`Nome: ${data.direct.name}`);
      if (data.direct.id) lines.push(`ID: ${data.direct.id}`);
    } else {
      lines.push('A conta não tem RENDER_API_KEY salva; então não existe acesso autorizado ao e-mail privado do login.');
    }

    lines.push('');
    lines.push('DADOS DO PRÓPRIO SERVIÇO:');
    if (data.render?.serviceName) lines.push(`Serviço: ${data.render.serviceName}`);
    if (data.render?.serviceId) lines.push(`Service ID: ${data.render.serviceId}`);
    if (data.render?.repoSlug) lines.push(`Repositório ligado: ${data.render.repoSlug}`);
    if (data.render?.commitSha) lines.push(`Commit publicado: ${data.render.commitSha}`);

    const real = (data.candidates || []).filter(x => !x.noreply);
    const noreply = (data.candidates || []).filter(x => x.noreply);
    if (real.length) {
      lines.push('');
      lines.push('📧 E-MAIL(S) REAL(IS) ENCONTRADO(S) NO PROJETO/HISTÓRICO:');
      real.forEach((x,i) => lines.push(`${i+1}. ${x.email} — ${x.source}${x.details ? ` (${x.details})` : ''}`));
      lines.push('');
      lines.push('Esses são candidatos encontrados em dados públicos do repositório. O projeto não consegue provar qual deles foi usado como login do Render sem autenticação da conta.');
    } else {
      lines.push('');
      lines.push('Nenhum e-mail real público apareceu nos commits/perfil do GitHub.');
    }

    if (noreply.length) {
      lines.push('');
      lines.push(`GitHub noreply encontrado: ${noreply[0].email} (isso identifica o GitHub, mas não é um Gmail utilizável).`);
    }

    if (data.github?.owner) {
      lines.push('');
      lines.push(`Conta GitHub ligada ao deploy: @${data.github.owner}`);
    }

    if (data.warning) {
      lines.push('');
      lines.push(`ℹ ${data.warning}`);
    }

    out.textContent = lines.join('\n');
    out.className = real.length || data.direct?.email ? 'smallpre msg ok' : 'smallpre';

    if (openBtn && data.render?.dashboardUrl) {
      openBtn.dataset.url = data.render.dashboardUrl;
      openBtn.classList.remove('hidden');
    }
  } catch (e) {
    out.textContent = `Erro ao analisar o projeto: ${e.message}`;
    out.className = 'smallpre msg err';
  }
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
if ($('setupSeRelay')) $('setupSeRelay').addEventListener('click', setupSeRelay);
if ($('findRenderGoogleDeep')) $('findRenderGoogleDeep').addEventListener('click', findRenderGoogleDeep);
if ($('findRenderAccount')) $('findRenderAccount').addEventListener('click', findRenderAccount);
if ($('openRenderService')) $('openRenderService').addEventListener('click', () => { const u=$('openRenderService').dataset.url; if (u) window.open(u,'_blank','noopener'); });
$('reconnectTwitch').addEventListener('click', reconnectTwitch);
$('testAvatar').addEventListener('click', testAvatar);
$('openOverlay').addEventListener('click', () => {
  const url = $('openOverlay').dataset.url || $('overlayUrl').value;
  if (url) window.open(url, '_blank', 'noopener');
});
$('clearQueue').addEventListener('click', async () => { await api('/api/clear-queue',{method:'POST'}); refreshStatus(); });
setInterval(refreshStatus, 3000);
if (key) login();
