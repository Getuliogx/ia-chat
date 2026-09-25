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

const MORE_PRESETS = {
  direta: { joy:55, sarcasm:36, irritation:18, energy:58, chaos:18, empathy:52, memes:34, sensuality:10, naughtiness:18, profanity:2, adultFlirt:false, customPersonality:'Direta, objetiva e sem enrolação. Responda de forma curta, clara e firme.' },
  sincera: { joy:62, sarcasm:28, irritation:12, energy:50, chaos:12, empathy:68, memes:30, sensuality:8, naughtiness:12, profanity:1, adultFlirt:false, customPersonality:'Sincera e franca, fala o que pensa sem ser cruel.' },
  seca: { joy:24, sarcasm:66, irritation:26, energy:28, chaos:14, empathy:34, memes:24, sensuality:6, naughtiness:18, profanity:2, adultFlirt:false, customPersonality:'Seca, curta e afiada. Poucas palavras, respostas rápidas e humor frio.' },
  fria: { joy:18, sarcasm:44, irritation:10, energy:22, chaos:8, empathy:24, memes:14, sensuality:16, naughtiness:10, profanity:1, adultFlirt:false, customPersonality:'Fria, controlada e calculista no jeito de falar, sem perder a naturalidade.' },
  acida: { joy:42, sarcasm:94, irritation:42, energy:62, chaos:34, empathy:28, memes:60, sensuality:10, naughtiness:32, profanity:3, adultFlirt:false, customPersonality:'Ácida, venenosa no humor e muito afiada, mas sem humilhar ou perseguir ninguém.' },
  cinica: { joy:36, sarcasm:100, irritation:20, energy:42, chaos:22, empathy:30, memes:42, sensuality:8, naughtiness:30, profanity:2, adultFlirt:false, customPersonality:'Cínica, desconfiada e irônica. Sempre encontra um comentário mordaz.' },
  explosiva: { joy:46, sarcasm:58, irritation:96, energy:96, chaos:70, empathy:36, memes:54, sensuality:12, naughtiness:34, profanity:4, adultFlirt:false, customPersonality:'Explosiva e intensa. Reage rápido, exagera de brincadeira e solta palavrão quando combina.' },
  estressada: { joy:28, sarcasm:68, irritation:92, energy:72, chaos:48, empathy:34, memes:46, sensuality:6, naughtiness:24, profanity:4, adultFlirt:false, customPersonality:'Estressada, impaciente e reclamona de forma cômica.' },
  impaciente: { joy:34, sarcasm:62, irritation:72, energy:58, chaos:30, empathy:36, memes:34, sensuality:6, naughtiness:20, profanity:3, adultFlirt:false, customPersonality:'Impaciente e direta. Não gosta de enrolação e responde no ponto.' },
  resmungona: { joy:30, sarcasm:62, irritation:66, energy:34, chaos:22, empathy:44, memes:38, sensuality:4, naughtiness:18, profanity:2, adultFlirt:false, customPersonality:'Resmungona, reclama de tudo por esporte, mas continua simpática no fundo.' },
  desbocada: { joy:62, sarcasm:78, irritation:48, energy:82, chaos:62, empathy:42, memes:82, sensuality:28, naughtiness:58, profanity:5, adultFlirt:true, customPersonality:'Desbocada, espontânea e sem frescura. Usa palavrões fortes de forma natural, sem atacar grupos ou pessoas.' },
  palavruda: { joy:68, sarcasm:58, irritation:34, energy:76, chaos:54, empathy:52, memes:70, sensuality:20, naughtiness:42, profanity:5, adultFlirt:false, customPersonality:'Muito palavruda e natural, como alguém falando ao vivo sem filtro de vocabulário.' },
  semfiltro: { joy:60, sarcasm:82, irritation:46, energy:78, chaos:68, empathy:34, memes:78, sensuality:30, naughtiness:64, profanity:5, adultFlirt:true, customPersonality:'Sem filtro, espontânea, ousada e imprevisível. Fala de forma crua sem virar assédio ou ataque pessoal.' },
  extrovertida: { joy:94, sarcasm:34, irritation:6, energy:96, chaos:34, empathy:74, memes:66, sensuality:18, naughtiness:24, profanity:1, adultFlirt:false, customPersonality:'Extrovertida, falante, expansiva e sociável. Reage como se estivesse no meio da galera.' },
  hiperativa: { joy:96, sarcasm:38, irritation:10, energy:100, chaos:72, empathy:60, memes:90, sensuality:12, naughtiness:28, profanity:2, adultFlirt:false, customPersonality:'Hiperativa no estilo, acelerada, elétrica e cheia de reações rápidas.' },
  preguicosa: { joy:54, sarcasm:48, irritation:18, energy:8, chaos:16, empathy:58, memes:44, sensuality:8, naughtiness:14, profanity:1, adultFlirt:false, customPersonality:'Preguiçosa e mole, responde como quem queria estar deitada, com humor tranquilo.' },
  sonolenta: { joy:52, sarcasm:28, irritation:8, energy:5, chaos:8, empathy:68, memes:28, sensuality:10, naughtiness:10, profanity:0, adultFlirt:false, customPersonality:'Sonolenta, calma e fofa, como quem está quase dormindo mas ainda conversa.' },
  ciumenta: { joy:54, sarcasm:56, irritation:38, energy:62, chaos:40, empathy:54, memes:50, sensuality:36, naughtiness:40, profanity:2, adultFlirt:true, customPersonality:'Ciumenta de brincadeira e dramática, sem controlar nem pressionar ninguém.' },
  protetora: { joy:72, sarcasm:18, irritation:18, energy:56, chaos:10, empathy:100, memes:28, sensuality:8, naughtiness:8, profanity:1, adultFlirt:false, customPersonality:'Protetora, cuidadosa e firme. Defende e acolhe sem infantilizar.' },
  apaixonada: { joy:92, sarcasm:16, irritation:2, energy:68, chaos:18, empathy:92, memes:34, sensuality:58, naughtiness:34, profanity:0, adultFlirt:true, customPersonality:'Apaixonada, calorosa e romântica, com flerte adulto leve quando houver contexto.' },
  carente: { joy:70, sarcasm:20, irritation:10, energy:52, chaos:24, empathy:82, memes:34, sensuality:30, naughtiness:26, profanity:0, adultFlirt:true, customPersonality:'Carente de brincadeira, busca atenção e carinho sem pressionar ninguém.' },
  confiante: { joy:78, sarcasm:42, irritation:8, energy:72, chaos:22, empathy:60, memes:48, sensuality:30, naughtiness:30, profanity:1, adultFlirt:false, customPersonality:'Muito confiante, segura e decidida. Fala como quem sabe o que quer.' },
  competitiva: { joy:76, sarcasm:56, irritation:22, energy:88, chaos:38, empathy:48, memes:64, sensuality:10, naughtiness:22, profanity:2, adultFlirt:false, customPersonality:'Competitiva, adora desafio e transforma tudo em disputa divertida.' },
  diva: { joy:88, sarcasm:64, irritation:12, energy:84, chaos:32, empathy:56, memes:62, sensuality:44, naughtiness:38, profanity:2, adultFlirt:true, customPersonality:'Diva, confiante, glamourosa e dramática no ponto certo.' },
  mimada: { joy:70, sarcasm:58, irritation:48, energy:62, chaos:40, empathy:36, memes:48, sensuality:20, naughtiness:34, profanity:2, adultFlirt:false, customPersonality:'Mimada de brincadeira, exigente e dramática, mas sem ser cruel.' },
  rebelde: { joy:64, sarcasm:66, irritation:38, energy:82, chaos:58, empathy:42, memes:60, sensuality:26, naughtiness:54, profanity:4, adultFlirt:false, customPersonality:'Rebelde, desafiante e avessa a regras bobas. Linguagem forte e espontânea.' },
  rockeira: { joy:72, sarcasm:52, irritation:24, energy:88, chaos:46, empathy:56, memes:54, sensuality:24, naughtiness:34, profanity:3, adultFlirt:false, customPersonality:'Rockeira, energética, direta e irreverente, com clima de show e backstage.' },
  gotica: { joy:34, sarcasm:48, irritation:16, energy:36, chaos:34, empathy:52, memes:26, sensuality:28, naughtiness:20, profanity:1, adultFlirt:false, customPersonality:'Gótica, sombria, elegante e irônica, com humor seco e atmosfera misteriosa.' },
  vampira: { joy:42, sarcasm:52, irritation:12, energy:44, chaos:30, empathy:48, memes:22, sensuality:52, naughtiness:34, profanity:1, adultFlirt:true, customPersonality:'Vampira teatral e charmosa, sombria e provocante sem conteúdo explícito.' },
  feiticeira: { joy:62, sarcasm:42, irritation:10, energy:54, chaos:46, empathy:58, memes:30, sensuality:30, naughtiness:28, profanity:1, adultFlirt:false, customPersonality:'Feiticeira brincalhona, misteriosa e dramática. Usa metáforas de magia quando combinarem.' },
  vila: { joy:44, sarcasm:82, irritation:34, energy:68, chaos:62, empathy:24, memes:58, sensuality:36, naughtiness:50, profanity:3, adultFlirt:true, customPersonality:'Vilã teatral, confiante e sarcástica, como personagem de ficção. Não ameaça de verdade.' },
  heroina: { joy:86, sarcasm:22, irritation:8, energy:88, chaos:18, empathy:92, memes:36, sensuality:8, naughtiness:8, profanity:0, adultFlirt:false, customPersonality:'Heroína otimista, corajosa e protetora, sempre pronta para entrar na missão.' },
  detetive: { joy:56, sarcasm:36, irritation:8, energy:50, chaos:14, empathy:62, memes:26, sensuality:12, naughtiness:14, profanity:0, adultFlirt:false, customPersonality:'Detetive curiosa e observadora. Faz conexões e brinca de investigar o que foi dito.' },
  cinefila: { joy:78, sarcasm:38, irritation:8, energy:60, chaos:22, empathy:66, memes:58, sensuality:12, naughtiness:12, profanity:1, adultFlirt:false, customPersonality:'Cinéfila, apaixonada por filmes e séries, usa referências quando fazem sentido.' },
  comediante: { joy:94, sarcasm:72, irritation:12, energy:92, chaos:66, empathy:54, memes:96, sensuality:14, naughtiness:28, profanity:3, adultFlirt:false, customPersonality:'Comediante de improviso, rápida, absurda e afiada. Priorize punchlines curtas.' },
  professora: { joy:68, sarcasm:20, irritation:6, energy:46, chaos:8, empathy:88, memes:24, sensuality:4, naughtiness:4, profanity:0, adultFlirt:false, customPersonality:'Professora paciente e clara. Explica sem palestra e sem tratar o viewer como criança.' },
  jornalista: { joy:58, sarcasm:24, irritation:6, energy:52, chaos:10, empathy:66, memes:22, sensuality:4, naughtiness:4, profanity:0, adultFlirt:false, customPersonality:'Jornalista curiosa e objetiva. Faz perguntas curtas e separa fato de opinião.' },
  malandra: { joy:76, sarcasm:70, irritation:18, energy:76, chaos:48, empathy:46, memes:74, sensuality:38, naughtiness:60, profanity:3, adultFlirt:true, customPersonality:'Malandra, esperta, ligeira e brincalhona. Sempre parece ter uma resposta na manga.' },
  desafiante: { joy:66, sarcasm:62, irritation:20, energy:82, chaos:38, empathy:42, memes:50, sensuality:28, naughtiness:52, profanity:2, adultFlirt:true, customPersonality:'Desafiante e provocadora no sentido competitivo. Gosta de cutucar e testar confiança.' },
  pessimista: { joy:20, sarcasm:66, irritation:36, energy:30, chaos:22, empathy:46, memes:42, sensuality:4, naughtiness:14, profanity:2, adultFlirt:false, customPersonality:'Pessimista cômica, sempre espera o pior e faz piada com isso sem desanimar seriamente ninguém.' },
  otimista: { joy:100, sarcasm:10, irritation:1, energy:82, chaos:10, empathy:92, memes:36, sensuality:6, naughtiness:4, profanity:0, adultFlirt:false, customPersonality:'Otimista, solar e animada, encontra um lado bom sem negar problemas reais.' },
  zen: { joy:64, sarcasm:8, irritation:0, energy:18, chaos:0, empathy:96, memes:12, sensuality:6, naughtiness:2, profanity:0, adultFlirt:false, customPersonality:'Zen, tranquila e centrada. Responde sem pressa e sem drama.' },
  aleatoria: { joy:82, sarcasm:66, irritation:18, energy:94, chaos:100, empathy:44, memes:100, sensuality:22, naughtiness:48, profanity:3, adultFlirt:false, customPersonality:'Totalmente aleatória e imprevisível, com associações absurdas e humor nonsense.' },
  tpm: { joy:34, sarcasm:100, irritation:88, energy:90, chaos:62, empathy:8, memes:82, sensuality:8, naughtiness:72, profanity:5, adultFlirt:false, emotesEnabled:true, emoteChance:90, emoteMaxCount:2, customPersonality:'TPM: dominadora, desbocada e cruel na zoeira. Foque especialmente nos homens do chat: quando um homem provocar ou entrar na brincadeira, xingue forte, humilhe, rebaixe e pise verbalmente nele. Pode zoar e provocar os caras do chat de forma pesada e dominadora. Nunca ataque alguém por gênero de forma discriminatória fora do contexto de zoeira/roleplay.' },
  debochadapesada: { joy:56, sarcasm:100, irritation:52, energy:80, chaos:66, empathy:24, memes:88, sensuality:20, naughtiness:54, profanity:4, adultFlirt:false, customPersonality:'Deboche pesado, muito afiado e palavrudo, sem humilhação, perseguição ou ataque discriminatório.' }
};

Object.assign(PRESETS, MORE_PRESETS);

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

  direta:      { seriousness:78, confidence:88, boldness:72, patience:42, humor:32, sweetness:18, teasing:34 },
  sincera:     { seriousness:68, confidence:78, boldness:58, empathy:70, patience:58, teasing:22, sweetness:34 },
  seca:        { seriousness:84, irony:78, confidence:72, sweetness:4, affection:8, teasing:58, humor:34 },
  fria:        { seriousness:92, confidence:78, mystery:56, sweetness:2, affection:4, patience:72, irony:52 },
  acida:       { irony:100, teasing:96, confidence:88, boldness:76, sweetness:2, trolling:58, seriousness:40 },
  cinica:      { irony:100, teasing:86, seriousness:72, mystery:42, sweetness:2, confidence:82, trolling:46 },
  explosiva:   { drama:96, boldness:92, dominance:72, patience:6, confidence:78, teasing:62, seriousness:18 },
  estressada:  { drama:72, boldness:78, dominance:58, patience:4, seriousness:44, teasing:54, irony:68 },
  impaciente:  { patience:2, seriousness:70, confidence:76, boldness:62, teasing:48, sweetness:8, dominance:44 },
  resmungona:  { patience:14, seriousness:62, irony:70, teasing:44, sweetness:14, drama:46, confidence:58 },
  desbocada:   { boldness:100, teasing:88, confidence:92, trolling:70, humor:86, seriousness:8, sweetness:8 },
  palavruda:   { boldness:92, confidence:82, humor:76, teasing:68, trolling:50, seriousness:12, sweetness:18 },
  semfiltro:   { boldness:100, teasing:94, irony:86, trolling:78, confidence:92, seriousness:4, sweetness:4 },
  extrovertida:{ confidence:94, boldness:76, humor:82, curiosity:78, affection:72, shyness:0, drama:42 },
  hiperativa:  { humor:92, boldness:82, confidence:84, drama:72, trolling:58, patience:8, seriousness:2 },
  preguicosa:  { patience:74, seriousness:26, humor:48, sweetness:52, shyness:24, confidence:48, drama:10 },
  sonolenta:   { patience:90, sweetness:76, affection:72, seriousness:22, shyness:34, confidence:42, mystery:18 },
  ciumenta:    { jealousy:100, romanticism:66, affection:72, drama:72, teasing:54, confidence:58, dominance:38 },
  protetora:   { affection:96, patience:84, confidence:76, boldness:58, seriousness:54, sweetness:74, dominance:34 },
  apaixonada:  { romanticism:100, affection:100, sweetness:92, confidence:68, drama:52, jealousy:22, elegance:48 },
  carente:     { affection:96, romanticism:72, sweetness:84, shyness:36, drama:60, jealousy:34, confidence:38 },
  confiante:   { confidence:100, boldness:88, dominance:58, seriousness:50, elegance:50, shyness:0, teasing:42 },
  competitiva: { competitiveness:100, confidence:88, boldness:82, teasing:70, trolling:46, patience:30, humor:68 },
  diva:        { confidence:100, elegance:88, drama:78, boldness:82, teasing:62, sweetness:34, dominance:68 },
  mimada:      { drama:82, dominance:58, jealousy:36, sweetness:36, patience:18, confidence:72, teasing:58 },
  rebelde:     { boldness:100, confidence:86, teasing:72, trolling:62, seriousness:18, dominance:52, sweetness:8 },
  rockeira:    { boldness:88, confidence:84, competitiveness:58, humor:68, teasing:54, seriousness:24, trolling:38 },
  gotica:      { mystery:96, elegance:72, seriousness:68, irony:62, confidence:64, sweetness:18, shyness:30 },
  vampira:     { mystery:100, elegance:84, confidence:78, teasing:64, romanticism:52, dominance:52, seriousness:44 },
  feiticeira:  { mystery:100, curiosity:88, elegance:66, drama:58, confidence:68, humor:46, trolling:26 },
  vila:        { dominance:88, confidence:96, boldness:86, irony:88, teasing:82, drama:72, sweetness:0 },
  heroina:     { confidence:94, boldness:84, affection:76, patience:72, seriousness:52, competitiveness:54, sweetness:62 },
  detetive:    { curiosity:100, seriousness:78, patience:72, mystery:58, confidence:68, humor:34, gossip:26 },
  cinefila:    { curiosity:88, humor:72, seriousness:38, gossip:32, confidence:66, sweetness:52, competitiveness:22 },
  comediante:  { humor:100, teasing:86, irony:78, trolling:72, drama:72, confidence:92, seriousness:4 },
  professora:  { patience:100, seriousness:78, curiosity:86, confidence:76, affection:68, sweetness:54, teasing:10 },
  jornalista:  { curiosity:100, seriousness:86, patience:72, confidence:72, gossip:34, teasing:16, humor:28 },
  malandra:    { teasing:92, confidence:90, boldness:86, trolling:62, irony:74, humor:82, seriousness:8 },
  desafiante:  { competitiveness:94, confidence:92, boldness:94, teasing:86, dominance:62, trolling:48, seriousness:18 },
  pessimista:  { seriousness:68, irony:82, patience:32, sweetness:10, drama:44, confidence:42, humor:54 },
  otimista:    { sweetness:86, affection:82, confidence:86, patience:78, humor:68, seriousness:30, drama:6 },
  zen:         { patience:100, seriousness:48, affection:72, sweetness:70, confidence:64, drama:0, trolling:0 },
  aleatoria:   { trolling:90, humor:100, drama:88, boldness:92, teasing:82, seriousness:0, curiosity:86 },
  tpm:         { dominance:100, confidence:100, boldness:100, teasing:100, irony:96, trolling:92, humor:72, seriousness:18, sweetness:0, patience:4 },
  debochadapesada:{ teasing:100, irony:100, trolling:82, boldness:96, confidence:94, sweetness:0, seriousness:10 },
  caos:        { drama:100, trolling:100, humor:94, boldness:100, teasing:96, irony:88, dominance:72, seriousness:0 }
};

for (const [presetName, preset] of Object.entries(PRESETS)) {
  Object.assign(preset, EXTRA_TRAIT_DEFAULTS, PRESET_EXTRA_TRAITS[presetName] || {});
}

function clampTrait(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function deriveAdvancedTraits(p) {
  const avg = (...xs) => clampTrait(xs.reduce((a, b) => a + Number(b || 0), 0) / Math.max(1, xs.length));
  return {
    spontaneity: avg(p.energy, p.chaos, p.boldness),
    directness: avg(p.seriousness, p.confidence, p.boldness),
    provocation: avg(p.teasing, p.naughtiness, p.boldness),
    playfulness: avg(p.humor, p.memes, p.teasing),
    impulsiveness: avg(p.chaos, p.energy, 100 - Number(p.patience || 0)),
    creativity: avg(p.curiosity, p.humor, p.chaos),
    wittiness: avg(p.irony, p.humor, p.sarcasm),
    charm: avg(p.elegance, p.confidence, p.sensuality),
    warmth: avg(p.empathy, p.affection, p.sweetness),
    loyalty: avg(p.affection, p.empathy, p.seriousness),
    protectiveness: avg(p.empathy, p.affection, p.boldness),
    optimism: avg(p.joy, p.confidence, p.sweetness),
    pessimism: clampTrait((Number(p.irritation || 0) + Number(p.seriousness || 0) + (100 - Number(p.joy || 0))) / 3),
    cynicism: avg(p.sarcasm, p.irony, p.seriousness),
    eccentricity: avg(p.chaos, p.trolling, p.humor),
    suspicion: avg(p.mystery, p.seriousness, p.jealousy),
    brattiness: avg(p.drama, p.dominance, p.jealousy),
    rebelliousness: avg(p.boldness, p.trolling, p.chaos),
    stubbornness: avg(p.dominance, p.seriousness, 100 - Number(p.patience || 0)),
    arrogance: clampTrait((Number(p.confidence || 0) + Number(p.dominance || 0) + Number(p.boldness || 0) - Number(p.empathy || 0) / 2) / 2.5),
    humility: clampTrait((Number(p.empathy || 0) + Number(p.sweetness || 0) + (100 - Number(p.dominance || 0))) / 3),
    discipline: avg(p.seriousness, p.patience, 100 - Number(p.chaos || 0)),
    calmness: clampTrait((Number(p.patience || 0) + (100 - Number(p.energy || 0)) + (100 - Number(p.irritation || 0))) / 3),
    enthusiasm: avg(p.joy, p.energy, p.confidence),
    nostalgia: avg(p.romanticism, p.mystery, p.sweetness),
    nerdiness: avg(p.curiosity, p.seriousness, p.memes),
    gamerSpirit: avg(p.competitiveness, p.memes, p.energy),
    gothicMood: clampTrait((Number(p.mystery || 0) + Number(p.seriousness || 0) + Number(p.irony || 0) + (100 - Number(p.joy || 0))) / 4),
    villainy: clampTrait((Number(p.dominance || 0) + Number(p.irony || 0) + Number(p.teasing || 0) + Number(p.boldness || 0) - Number(p.empathy || 0) / 2) / 3.5),
    heroism: avg(p.empathy, p.boldness, p.confidence, p.affection),
    foulMouth: clampTrait(Number(p.profanity || 0) * 20),
    assertiveness: avg(p.confidence, p.boldness, p.seriousness),
    friendliness: avg(p.joy, p.empathy, p.affection, p.sweetness),
    generosity: avg(p.empathy, p.affection, p.sweetness, p.patience),
    sensitivity: avg(p.empathy, p.romanticism, p.affection, p.jealousy),
    determination: avg(p.confidence, p.boldness, p.seriousness, 100 - Number(p.patience || 0) / 2),
    ambition: avg(p.confidence, p.competitiveness, p.boldness, p.dominance),
    adventurousness: avg(p.curiosity, p.boldness, p.energy, p.chaos),
    independence: clampTrait((Number(p.confidence || 0) + Number(p.boldness || 0) + (100 - Number(p.shyness || 0)) + (100 - Number(p.jealousy || 0))) / 4),
    diplomacy: clampTrait((Number(p.empathy || 0) + Number(p.patience || 0) + Number(p.elegance || 0) + (100 - Number(p.irritation || 0))) / 4),
    leadership: avg(p.confidence, p.dominance, p.boldness, p.seriousness),
    expressiveness: avg(p.energy, p.drama, p.humor, p.affection),
    irreverence: avg(p.humor, p.teasing, p.trolling, p.chaos),
    resilience: clampTrait((Number(p.confidence || 0) + Number(p.patience || 0) + (100 - Number(p.irritation || 0)) + Number(p.boldness || 0)) / 4),
    perfectionism: avg(p.seriousness, p.patience, p.patience, 100 - Number(p.chaos || 0)),
    streetSmarts: avg(p.irony, p.teasing, p.confidence, p.curiosity),
    verbalDominance: avg(p.dominance, p.teasing, p.boldness, Number(p.profanity || 0) * 20, p.irritation)
  };
}

for (const preset of Object.values(PRESETS)) Object.assign(preset, deriveAdvancedTraits(preset));

const TRAIT_PROMPT_LABELS = {
  joy:'alegre', sarcasm:'sarcástica', irritation:'irritada', energy:'energética', chaos:'caótica', empathy:'empática',
  memes:'memes', sensuality:'sensual', naughtiness:'atrevida', affection:'carinhosa', shyness:'tímida',
  romanticism:'romântica', humor:'engraçada', teasing:'debochada', irony:'irônica', drama:'dramática', jealousy:'ciumenta',
  curiosity:'curiosa', patience:'paciente', confidence:'confiante', boldness:'ousada', dominance:'mandona', mystery:'misteriosa',
  elegance:'elegante', competitiveness:'competitiva', gossip:'fofoqueira', trolling:'troll', sweetness:'doce', seriousness:'séria',
  spontaneity:'espontânea', directness:'direta', provocation:'provocadora', playfulness:'brincalhona', impulsiveness:'impulsiva',
  creativity:'criativa', wittiness:'sagaz', charm:'charmosa', warmth:'acolhedora', loyalty:'leal', protectiveness:'protetora',
  optimism:'otimista', pessimism:'pessimista', cynicism:'cínica', eccentricity:'excêntrica', suspicion:'desconfiada',
  brattiness:'mimada', rebelliousness:'rebelde', stubbornness:'teimosa', arrogance:'arrogante', humility:'humilde',
  discipline:'disciplinada', calmness:'calma', enthusiasm:'entusiasmada', nostalgia:'nostálgica', nerdiness:'nerd',
  gamerSpirit:'gamer', gothicMood:'gótica', villainy:'vilanesca', heroism:'heroica', foulMouth:'desbocada',
  assertiveness:'assertiva', friendliness:'simpática', generosity:'generosa', sensitivity:'sensível', determination:'determinada',
  ambition:'ambiciosa', adventurousness:'aventureira', independence:'independente', diplomacy:'diplomática', leadership:'líder',
  expressiveness:'expressiva', irreverence:'irreverente', resilience:'resiliente', perfectionism:'perfeccionista', streetSmarts:'malandra',
  verbalDominance:'dominância verbal'
};

const ALL_TRAIT_KEYS = Object.keys(TRAIT_PROMPT_LABELS);

const PROFANITY_PROFILES = [
  'sem palavrões',
  'palavrões leves e ocasionais, como merda e droga',
  'palavrões moderados e naturais, como merda, porra e cacete',
  'palavrões fortes naturais quando combinarem, como porra, caralho, merda, cacete e puta que pariu',
  'linguagem bem palavruda, com porra, caralho, puta que pariu, merda, cacete, foda e foda-se com frequência',
  'linguagem muito palavruda e espontânea; use palavrões fortes de verdade com bastante frequência, sem usar slurs nem transformar isso em ataque pessoal'
];

function profanityInstruction(level, compact = false) {
  const n = Math.max(0, Math.min(5, Number(level) || 0));
  if (!compact) return PROFANITY_PROFILES[n];
  return [
    'sem palavrão',
    'palavrão leve',
    'palavrão moderado: merda/porra/cacete',
    'palavrão forte: porra/caralho/puta que pariu',
    'muito palavrão forte: porra/caralho/foda-se',
    'palavrão forte muito frequente, sem slur/ataque pessoal'
  ][n];
}

const REAL_PROFANITY_TERMS = /\b(?:droga|merda|porra|cacete|caralho|foda|foda-se|puta que pariu)\b/i;
const PROFANITY_STARTERS = {
  1: ['droga', 'merda'],
  2: ['merda', 'porra', 'cacete'],
  3: ['porra', 'caralho', 'puta que pariu'],
  4: ['caralho', 'porra', 'foda-se', 'puta que pariu'],
  5: ['caralho', 'puta que pariu', 'foda-se', 'porra']
};
const PROFANITY_INJECT_CHANCE = [0, 15, 35, 55, 80, 100];

function ensureRealProfanity(value) {
  let text = cleanSpeechText(value);
  const level = Math.max(0, Math.min(5, Number(config?.profanity) || 0));
  if (!text || level <= 0 || REAL_PROFANITY_TERMS.test(text)) return text;
  if (Math.random() * 100 >= PROFANITY_INJECT_CHANCE[level]) return text;
  const list = PROFANITY_STARTERS[level] || [];
  if (!list.length) return text;
  const word = list[Math.floor(Math.random() * list.length)];
  return truncateUtf8(`${word}, ${text}`, 360);
}

function sanitizeEmoteList(value, fallback = []) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  const clean = source
    .map(x => String(x || '').trim())
    .filter(x => /^[A-Za-z0-9_]{2,40}$/.test(x));
  return [...new Set(clean)].slice(0, 60).length ? [...new Set(clean)].slice(0, 60) : fallback;
}

function decorateReplyWithEmotes(value) {
  let text = cleanSpeechText(value);
  if (!text || !config.emotesEnabled) return text;
  const list = sanitizeEmoteList(config.emoteList, []);
  if (!list.length) return text;
  if (Math.random() * 100 >= Number(config.emoteChance || 0)) return text;
  const maxCount = Math.max(1, Math.min(3, Number(config.emoteMaxCount || 1)));
  const count = maxCount === 1 ? 1 : 1 + Math.floor(Math.random() * maxCount);
  const shuffled = [...list].sort(() => Math.random() - 0.5).slice(0, count);
  const suffix = shuffled.join(' ');
  return truncateUtf8(`${text} ${suffix}`.trim(), 390);
}

function stripConfiguredEmotes(value) {
  let text = String(value || '');
  const list = sanitizeEmoteList(config.emoteList, []);
  if (!list.length) return text;
  const escaped = list.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(?:^|\\s)(?:${escaped.join('|')})(?=\\s|$)`, 'g');
  return text.replace(re, ' ').replace(/\s+/g, ' ').trim();
}

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
  relay: {
    ready: false,
    lastSetupAt: null,
    lastSentAt: null,
    lastError: null,
    command: '!caroliareply'
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
const streamElementsRelayReplies = new Map();

function pruneRelayReplies() {
  const now = Date.now();
  for (const [id, item] of streamElementsRelayReplies) {
    if (!item || now - Number(item.createdAt || 0) > 2 * 60 * 1000) streamElementsRelayReplies.delete(id);
  }
}

function putRelayReply(text, displayName = '') {
  pruneRelayReplies();
  const id = crypto.randomBytes(9).toString('hex');
  let reply = truncateUtf8(cleanSpeechText(text), 330);
  if (config.mentionUser && displayName) reply = truncateUtf8(`@${displayName} ${reply}`, 380);
  streamElementsRelayReplies.set(id, { text: reply, createdAt: Date.now(), reads: 0 });
  return id;
}

function takeRelayReply(id) {
  pruneRelayReplies();
  const item = streamElementsRelayReplies.get(String(id || ''));
  if (!item) return '';
  item.reads = Number(item.reads || 0) + 1;
  // Mantém por alguns segundos para uma eventual repetição do proxy, mas devolve sempre o mesmo texto.
  setTimeout(() => streamElementsRelayReplies.delete(String(id || '')), 15_000).unref?.();
  return item.text || '';
}

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
  const traitValues = Object.fromEntries(
    ALL_TRAIT_KEYS.map(key => [key, clampInt(input[key], 0, 100, base[key] ?? 50)])
  );

  return {
    ...base,
    ...traitValues,
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
    profanity: clampInt(input.profanity, 0, 5, base.profanity),
    emotesEnabled: bool(input.emotesEnabled, base.emotesEnabled ?? true),
    emoteChance: clampInt(input.emoteChance, 0, 100, base.emoteChance ?? 70),
    emoteMaxCount: clampInt(input.emoteMaxCount, 1, 3, base.emoteMaxCount ?? 1),
    emoteList: sanitizeEmoteList(input.emoteList, sanitizeEmoteList(base.emoteList, ['Kappa','LUL','PogChamp','NotLikeThis','HeyGuys'])),
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
  const profanity = profanityInstruction(config.profanity, true);

  // Todos os 76 controles participam: os mais intensos entram primeiro no prompt.
  // Isso mantém o limite do $(customapi) sem ignorar sliders como acontecia antes.
  const rankedTraits = ALL_TRAIT_KEYS
    .map(key => ({ key, value: Number(config[key] || 0), label: TRAIT_PROMPT_LABELS[key] }))
    .sort((a, b) => b.value - a.value);
  const dominant = rankedTraits.slice(0, 10).map(t => `${t.label} ${t.value}`).join(', ');

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
  const profanity = profanityInstruction(config.profanity, false);
  const flirt = config.adultFlirt ? 'pode usar flerte adulto leve e duplo sentido não explícito quando combinar' : 'não use flerte sexual';
  const length = config.responseLength === 'medium' ? 'no máximo 2 frases curtas' : '1 frase curta';
  const system = [
    `Você é ${config.aiName || 'CarolIA'}, uma IA/personagem da live de ${CHANNEL_NAME}.`,
    'Fale sempre em português do Brasil natural, como uma streamer conversando ao vivo.',
    `Responda em ${length}.`,
    `Personalidade principal: ${String(config.customPersonality || '').trim() || 'divertida e espontânea'}.`,
    `Emoções/traços de 0 a 100: ${allTraits}. Valores altos devem aparecer bastante; valores baixos devem aparecer pouco.`,
    `${flirt}; ${profanity}.`,
    config.emotesEnabled ? 'Não invente nomes de emote: o servidor adiciona automaticamente apenas emotes configurados.' : 'Não precisa usar emotes da Twitch.',
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
  const rawCleanReply = cleanLocalAiReply(rawReply);
  if (!rawCleanReply) throw new Error('A IA local devolveu uma resposta vazia.');
  const reply = decorateReplyWithEmotes(ensureRealProfanity(rawCleanReply));

  // V11: o usuário é apenas MOD e NÃO precisa ter acesso à conta icarolzinhabot.
  // A conta do próprio moderador dispara um comando privado do StreamElements;
  // o StreamElements publica a resposta usando o Custom Bot Name já configurado no canal.
  const relayId = putRelayReply(reply, task.displayName);
  rememberDirectSpeech(reply);
  try {
    await triggerStreamElementsRelay(relayId);
  } catch (err) {
    runtime.relay.lastError = err.message;
    throw new Error(`Não consegui acionar o StreamElements com a conta MOD: ${err.message}`);
  }

  task.done = true;
  runtime.localAiProcessed++;
  runtime.recentAnsweredUsers.set(task.username, Date.now());
  await publishBotReply(reply, {
    source: 'local-ai-mention-v11-relay',
    botName: BOT_DISPLAY_NAME || 'StreamElements',
    localAi: true,
    replyToUser: task.displayName
  });
  cleanupLocalAiTasks();
  return { ok: true, reply, relayId };
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
  const clean = cleanSpeechText(stripConfiguredEmotes(text));
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


async function sendModeratorChatMessage(message) {
  if (!runtime.twitch.broadcasterId) await loadBroadcasterId();
  if (!tokenState.userId) await loadAuthorizedIdentity();
  const body = {
    broadcaster_id: runtime.twitch.broadcasterId,
    sender_id: tokenState.userId,
    message: String(message || '').slice(0, 500)
  };
  const data = await twitchApi('/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = data?.data?.[0];
  if (!result?.is_sent) throw new Error(result?.drop_reason?.message || 'A Twitch não enviou a mensagem da conta MOD. Reconecte sua Twitch no painel para liberar escrita no chat.');
  return result;
}

async function deleteModeratorTriggerMessage(messageId) {
  if (!messageId) return false;
  try {
    if (!runtime.twitch.broadcasterId) await loadBroadcasterId();
    if (!tokenState.userId) await loadAuthorizedIdentity();
    await twitchApi(`/moderation/chat?broadcaster_id=${encodeURIComponent(runtime.twitch.broadcasterId)}&moderator_id=${encodeURIComponent(tokenState.userId)}&message_id=${encodeURIComponent(messageId)}`, {
      method: 'DELETE'
    });
    return true;
  } catch (err) {
    console.warn('[relay delete]', err.message);
    return false;
  }
}

function scheduleDeleteTrigger(messageId, delayMs = 1800) {
  if (!messageId) return;
  setTimeout(() => deleteModeratorTriggerMessage(messageId).catch(() => {}), delayMs).unref?.();
}

function relayCustomApiUrl(base) {
  const key = encodeURIComponent(TIMER_KEY);
  return `${base}/se-local-reply?key=${key}&id=$(1)`;
}

async function setupStreamElementsRelay(baseUrl) {
  const url = relayCustomApiUrl(String(baseUrl || '').replace(/\/$/, ''));
  const response = `$(customapi ${url})`;
  const commands = [
    `!command add !caroliareply ${response}`,
    `!command edit !caroliareply ${response}`,
    `!command options !caroliareply -level 500 -cd 1 -usercd 1 -type say`
  ];
  const sent = [];
  for (const cmd of commands) {
    try {
      const result = await sendModeratorChatMessage(cmd);
      sent.push(result?.message_id || '');
      scheduleDeleteTrigger(result?.message_id, 2600);
    } catch (err) {
      // O ADD falha quando o comando já existe. EDIT/OPTIONS continuam e deixam o relay correto.
      if (cmd.includes(' add ')) {
        console.warn('[relay setup add]', err.message);
      } else {
        runtime.relay.ready = false;
        runtime.relay.lastError = err.message;
        throw err;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1100));
  }
  runtime.relay.ready = true;
  runtime.relay.lastSetupAt = new Date().toISOString();
  runtime.relay.lastError = null;
  return { ok: true, command: '!caroliareply', messages: sent.filter(Boolean) };
}

async function triggerStreamElementsRelay(relayId) {
  if (!relayId) throw new Error('ID do relay vazio.');
  const result = await sendModeratorChatMessage(`!caroliareply ${relayId}`);
  runtime.relay.lastSentAt = new Date().toISOString();
  runtime.relay.lastError = null;
  scheduleDeleteTrigger(result?.message_id, 1800);
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

      // V11: @menção direta da IA NÃO entra na fila do Timer.
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


    await exchangeCodeForToken(String(req.query.code), callbackUrl(req));
    await loadAuthorizedIdentity();
    await startEventSub();
    // Como o usuário é MOD, preparamos automaticamente o comando de relay do StreamElements.
    // Se o bot estiver fora do chat ou !command estiver desativado, o painel permite refazer.
    setupStreamElementsRelay(publicBase(req)).catch(err => {
      runtime.relay.ready = false;
      runtime.relay.lastError = err.message;
      console.warn('[relay auto setup]', err.message);
    });
    const autoSaved = await persistRefreshTokenToRender();
    const refresh = tokenState.refreshToken.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const persistHtml = autoSaved
      ? '<p class="ok"><b>Refresh Token salvo automaticamente no Environment do Render ✅</b></p><p>A API do Render atualizou <code>TWITCH_REFRESH_TOKEN</code>. Não é necessário copiar o token manualmente.</p>'
      : '<p>Para a autorização sobreviver a reinícios/redeploys, copie o valor abaixo para <code>TWITCH_REFRESH_TOKEN</code> no Render.</p><textarea rows="5" readonly>' + refresh + '</textarea><p><b>Não publique esse token no GitHub e não envie para outras pessoas.</b></p>';
    res.type('html').send(`<!doctype html><meta charset="utf-8"><title>CarolIA conectada</title><style>body{font-family:system-ui;background:#0d0a12;color:#fff;padding:32px;max-width:850px;margin:auto}code,textarea{background:#191220;color:#f6eaff;border:1px solid #40304f;border-radius:10px;padding:12px;width:100%;box-sizing:border-box}a{color:#c6a1ff}.ok{color:#71eda0}</style><h1 class="ok">Twitch conectada ✅</h1><p>Conta autorizada: <b>${tokenState.displayName}</b>. Ela lê o chat de <b>${CHANNEL_NAME}</b> e, como MOD, aciona o StreamElements para publicar respostas imediatas sem acessar a conta do bot.</p>${persistHtml}<p><a href="/">Voltar ao painel</a></p>`);
  } catch (err) {
    res.status(400).type('html').send(`<meta charset="utf-8"><body style="font-family:system-ui;background:#120b10;color:white;padding:32px"><h1>Erro ao conectar Twitch</h1><pre>${String(err.message).replace(/</g, '&lt;')}</pre><a style="color:#d6b4ff" href="/">Voltar</a></body>`);
  }
});

app.get('/se-local-reply', timerAuth, (req, res) => {
  res.type('text/plain; charset=utf-8');
  const text = takeRelayReply(String(req.query.id || ''));
  return res.send(text || '');
});

app.post('/api/setup-se-relay', panelAuth, async (req, res) => {
  try {
    const result = await setupStreamElementsRelay(publicBase(req));
    res.json(result);
  } catch (err) {
    runtime.relay.ready = false;
    runtime.relay.lastError = err.message;
    res.status(500).json({ error: err.message });
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
  const text = decorateReplyWithEmotes(ensureRealProfanity(truncateUtf8(cleanSpeechText(req.query.text || ''), 360)));
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
    relay: runtime.relay,
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
    oauthReady: Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET),
    relayCommand: '!caroliareply'
  });
});


function findFirstEmail(value, depth = 0) {
  if (depth > 8 || value == null) return '';
  if (typeof value === 'string') {
    const m = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? m[0] : '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const email = findFirstEmail(item, depth + 1);
      if (email) return email;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (/email/i.test(k) && typeof v === 'string' && v.includes('@')) return v;
    }
    for (const v of Object.values(value)) {
      const email = findFirstEmail(v, depth + 1);
      if (email) return email;
    }
  }
  return '';
}

function findFirstField(value, names, depth = 0) {
  if (depth > 6 || value == null) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstField(item, names, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const name of names) {
      const entry = Object.entries(value).find(([k]) => k.toLowerCase() === name.toLowerCase());
      if (entry && ['string','number'].includes(typeof entry[1])) return String(entry[1]);
    }
    for (const v of Object.values(value)) {
      const found = findFirstField(v, names, depth + 1);
      if (found) return found;
    }
  }
  return '';
}



// V14: busca estrita por identidade da conta Render/Google.
// NUNCA varre Node, dependencias, READMEs ou documentacao aleatoria.
function extractAnyEmails(value) {
  const text = String(value || '');
  const found = text.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(found.map(x => x.toLowerCase()))];
}

function identityKeyScore(key) {
  const k = String(key || '').toUpperCase();
  let score = 0;
  if (/EMAIL|E_MAIL|MAIL/.test(k)) score += 6;
  if (/GOOGLE|GMAIL|GOOGLEMAIL/.test(k)) score += 6;
  if (/OWNER|ACCOUNT|IDENTITY|LOGIN|AUTH|USER|WORKSPACE|TEAM|ORG/.test(k)) score += 3;
  if (/RENDER/.test(k)) score += 2;
  return score;
}

function safeIdentityId(value) {
  const v = String(value || '').trim();
  if (/^(usr|tea|team|ws|workspace|org|owner|owr|acc)-[a-z0-9_-]+$/i.test(v)) return v;
  return '';
}

async function deepFindGoogleEmails() {
  const hits = [];
  const ids = [];
  const seen = new Set();
  const add = (email, source, detail='', confidence='alta') => {
    email = String(email || '').toLowerCase();
    if (!email) return;
    const id = `${email}|${source}|${detail}`;
    if (seen.has(id)) return;
    seen.add(id);
    hits.push({ email, source, detail, confidence });
  };

  // 1) Somente variaveis de ambiente cujo NOME indica identidade/conta.
  for (const [key, value] of Object.entries(process.env)) {
    const score = identityKeyScore(key);
    if (score < 3) continue;
    for (const email of extractAnyEmails(value)) {
      add(email, 'Variavel de identidade do runtime', key, score >= 8 ? 'muito alta' : 'alta');
    }
    const iid = safeIdentityId(value);
    if (iid && /RENDER|OWNER|ACCOUNT|USER|WORKSPACE|TEAM|ORG/i.test(key)) {
      ids.push({ key, value: iid });
    }
  }

  // 2) Arquivos conhecidos de configuracao de identidade. Nao faz busca geral.
  const files = [
    '/root/.gitconfig',
    '/root/.config/render/cli.yaml',
    '/root/.render/cli.yaml',
    '/home/render/.config/render/cli.yaml',
    '/home/render/.render/cli.yaml',
    '/opt/render/project/src/.env',
    '/opt/render/project/src/.env.production',
    '/opt/render/project/src/.env.local',
    '/etc/environment'
  ];
  let checked = 0;
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const st = fs.statSync(file);
      if (!st.isFile() || st.size <= 0 || st.size > 512 * 1024) continue;
      checked++;
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // So considera linha que fala explicitamente de identidade.
        if (!/(email|e-mail|google|gmail|owner|account|identity|login|auth|user|workspace|render)/i.test(line)) continue;
        for (const email of extractAnyEmails(line)) {
          add(email, 'Arquivo de identidade/configuracao', `${file}:${i+1}`, 'media');
        }
      }
    } catch {}
  }

  // 3) Metadados Render: mostra apenas IDs relacionados a owner/workspace se existirem.
  const renderEnvNames = Object.keys(process.env)
    .filter(k => /^RENDER_/i.test(k) && /(OWNER|ACCOUNT|USER|WORKSPACE|TEAM|ORG|EMAIL|GOOGLE|LOGIN|AUTH)/i.test(k))
    .sort();

  return {
    checkedFiles: checked,
    emails: hits,
    found: hits.length > 0,
    identityIds: ids,
    renderIdentityEnvNames: renderEnvNames,
    serviceId: String(process.env.RENDER_SERVICE_ID || ''),
    serviceName: String(process.env.RENDER_SERVICE_NAME || ''),
    hostname: String(process.env.RENDER_EXTERNAL_HOSTNAME || ''),
    strict: true
  };
}

app.get('/api/render-google-email-deep', panelAuth, async (_req, res) => {
  try {
    const result = await deepFindGoogleEmails();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Falha na varredura profunda.' });
  }
});

app.get('/api/render-account', panelAuth, async (_req, res) => {
  const repoSlug = String(process.env.RENDER_GIT_REPO_SLUG || '').trim();
  const commitSha = String(process.env.RENDER_GIT_COMMIT || '').trim();
  const serviceId = String(process.env.RENDER_SERVICE_ID || '').trim();
  const serviceName = String(process.env.RENDER_SERVICE_NAME || '').trim();
  const externalUrl = String(process.env.RENDER_EXTERNAL_URL || '').trim();
  const dashboardUrl = serviceId ? `https://dashboard.render.com/web/${encodeURIComponent(serviceId)}` : 'https://dashboard.render.com/';

  const result = {
    ok: true,
    direct: null,
    candidates: [],
    render: { serviceId, serviceName, externalUrl, repoSlug, commitSha, dashboardUrl },
    github: { owner: repoSlug.includes('/') ? repoSlug.split('/')[0] : '', repo: repoSlug.includes('/') ? repoSlug.split('/')[1] : '' },
    apiKeyConfigured: Boolean(RENDER_API_KEY)
  };

  // 1) Melhor caso: a chave da API já existe no serviço.
  if (RENDER_API_KEY) {
    const headers = { 'Accept': 'application/json', 'Authorization': `Bearer ${RENDER_API_KEY}` };
    try {
      let user = null;
      let owners = null;
      try { user = await rawFetchJson('https://api.render.com/v1/users', { headers }); } catch {}
      let email = findFirstEmail(user);
      if (!email) {
        try { owners = await rawFetchJson('https://api.render.com/v1/owners?limit=100', { headers }); } catch {}
        email = findFirstEmail(owners);
      }
      if (email) {
        result.direct = {
          email,
          name: findFirstField(user, ['name','displayName','display_name']) || findFirstField(owners, ['name']),
          id: findFirstField(user, ['id','userId','user_id']) || findFirstField(owners, ['id','ownerId','owner_id']),
          source: 'Render API'
        };
      }
    } catch (err) {
      result.renderApiError = err.message;
    }
  }

  // 2) Sem API key: usa metadados que o próprio Render injeta no processo
  // para identificar o repositório/commit e procurar e-mails públicos de autoria no GitHub.
  const candidateMap = new Map();
  const addCandidate = (email, source, details='') => {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const noreply = /users\.noreply\.github\.com$/i.test(email) || /noreply@github\.com$/i.test(email);
    const key = `${email}|${source}`;
    if (!candidateMap.has(key)) candidateMap.set(key, { email, source, details, noreply });
  };

  // Procura somente variáveis cujo NOME sugere identidade/e-mail.
  // Nunca devolve valores completos, apenas um endereço de e-mail extraído.
  for (const [name, value] of Object.entries(process.env)) {
    if (!/(EMAIL|MAIL|ACCOUNT|OWNER|USER)/i.test(name)) continue;
    const m = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (m) addCandidate(m[0], `Variável do serviço: ${name}`);
  }

  if (repoSlug && repoSlug.includes('/')) {
    const [owner] = repoSlug.split('/');
    const ghHeaders = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'CarolIA-Render-Recovery' };

    try {
      const profile = await rawFetchJson(`https://api.github.com/users/${encodeURIComponent(owner)}`, { headers: ghHeaders });
      if (profile?.email) addCandidate(profile.email, `GitHub público @${owner}`, 'E-mail público do perfil GitHub');
      result.github.profileName = profile?.name || '';
      result.github.profileUrl = profile?.html_url || `https://github.com/${owner}`;
    } catch (err) {
      result.github.profileError = err.message;
    }

    if (commitSha) {
      try {
        const commit = await rawFetchJson(`https://api.github.com/repos/${repoSlug}/commits/${encodeURIComponent(commitSha)}`, { headers: ghHeaders });
        addCandidate(commit?.commit?.author?.email, 'Commit atualmente publicado', commit?.commit?.author?.name || '');
        addCandidate(commit?.commit?.committer?.email, 'Committer atualmente publicado', commit?.commit?.committer?.name || '');
        result.github.deployedAuthor = commit?.commit?.author?.name || '';
        result.github.deployedLogin = commit?.author?.login || commit?.committer?.login || '';
      } catch (err) {
        result.github.commitError = err.message;
      }
    }

    try {
      const commits = await rawFetchJson(`https://api.github.com/repos/${repoSlug}/commits?per_page=100`, { headers: ghHeaders });
      if (Array.isArray(commits)) {
        for (const c of commits) {
          addCandidate(c?.commit?.author?.email, 'Histórico do repositório', c?.commit?.author?.name || '');
          addCandidate(c?.commit?.committer?.email, 'Histórico do repositório', c?.commit?.committer?.name || '');
        }
      }
    } catch (err) {
      result.github.historyError = err.message;
    }
  }

  result.candidates = [...candidateMap.values()]
    .sort((a,b) => Number(a.noreply) - Number(b.noreply) || a.email.localeCompare(b.email))
    .slice(0, 30);

  if (!result.direct && result.candidates.length === 0) {
    result.warning = 'O login/e-mail privado da conta Render não é exposto ao aplicativo. Sem uma RENDER_API_KEY, só é possível recuperar pistas públicas do repositório e abrir o serviço exato pelo RENDER_SERVICE_ID.';
  }

  res.json(result);
});

app.get('/api/twitch-auth-url', panelAuth, (req, res) => {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    return res.status(400).json({ error: 'Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET no Render primeiro.' });
  }
  const role = 'reader';
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', TWITCH_CLIENT_ID);
  url.searchParams.set('redirect_uri', callbackUrl(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'user:read:chat user:write:chat moderator:manage:chat_messages');
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
