// Liga as partes: entrada → voo → cabine/paisagem/som → renderização.
import * as THREE from 'three';
import { criarVoo, NOMES_FASES } from './flight.js';
import { calcularTremor } from './tremor.js';
import { acaoDaTecla, ACAO, criarLeitorControles, padraoVibracao, INTERVALO_MS, ehControle } from './input.js';
import { calcularRecentralizacao } from './recentrar.js';
import { criarCabine } from './cabin.js';
import { criarPaisagem } from './outside.js';
import { criarAudio } from './audio.js';

const NOMES_TURBULENCIA = ['desligada', 'leve', 'moderada', 'forte'];

// ?acelerar=N multiplica o tempo (só para testes e demonstração).
const acelerar = Math.min(20, Math.max(1, Number(new URLSearchParams(location.search).get('acelerar')) || 1));

const elInicio = document.querySelector('#inicio');
const elEntrar = document.querySelector('#entrar');
const elPainel = document.querySelector('#painel');
const elAviso = document.querySelector('#aviso');
const elErro = document.querySelector('#erro');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.prepend(renderer.domElement);

const cena = new THREE.Scene();
cena.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 2.0));
cena.add(new THREE.AmbientLight(0xffffff, 0.7));
const sol = new THREE.DirectionalLight(0xfff2d8, 1.2);
sol.position.set(-5, 6, 2);
cena.add(sol);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 30000);
const rig = new THREE.Group();
rig.add(camera);
cena.add(rig);

const cabine = criarCabine();
cena.add(cabine.grupo);
const paisagem = criarPaisagem(cena);
cena.add(paisagem.grupo);

const voo = criarVoo();

const audio = criarAudio();

// Só para o teste automático inspecionar o estado da cena e do som.
window.aviaoDebug = { cena, audio, voo, aplicarAcao };

// ---------- ações ----------
function aplicarAcao(acao) {
  retomarSom(); // qualquer ação da terapeuta também traz o som de volta, se o navegador o pausou
  switch (acao) {
    case ACAO.PROXIMA_FASE:
      voo.proximaFase();
      break;
    case ACAO.TURBULENCIA:
      voo.ciclarTurbulencia();
      break;
    case ACAO.DESLIGAR_TURBULENCIA:
      voo.desligarTurbulencia();
      break;
    case ACAO.CINTO:
      cabine.definirCinto(voo.alternarCinto());
      audio.tocar('ding');
      break;
    case ACAO.RECENTRALIZAR:
      recentralizar();
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', (evento) => {
  const acao = acaoDaTecla(evento);
  if (!acao) return;
  evento.preventDefault();
  aplicarAcao(acao);
});

// ---------- modo notebook: olhar com o mouse ----------
const olhar = { yaw: 0.45, pitch: -0.08, arrastando: false, x: 0, y: 0 };
function aplicarOlhar() {
  camera.position.copy(cabine.olhos);
  camera.rotation.set(olhar.pitch, olhar.yaw, 0, 'YXZ');
}
aplicarOlhar();

renderer.domElement.addEventListener('pointerdown', (e) => {
  olhar.arrastando = true;
  olhar.x = e.clientX;
  olhar.y = e.clientY;
});
window.addEventListener('pointerup', () => {
  olhar.arrastando = false;
});
window.addEventListener('pointermove', (e) => {
  if (!olhar.arrastando || renderer.xr.isPresenting) return;
  olhar.yaw += (e.clientX - olhar.x) * 0.005;
  olhar.pitch = THREE.MathUtils.clamp(olhar.pitch + (e.clientY - olhar.y) * 0.005, -1.4, 1.4);
  olhar.x = e.clientX;
  olhar.y = e.clientY;
  aplicarOlhar();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Há uma cena em andamento (notebook ou RV)? Fora disso o som não deve voltar sozinho.
let modoAtivo = false;

function iniciarModoNotebook() {
  modoAtivo = true;
  elInicio.classList.add('oculto');
  elPainel.classList.remove('oculto');
  elAviso.classList.remove('oculto');
  elAviso.textContent =
    'RV indisponível neste aparelho — modo notebook: Espaço = próxima fase · T = turbulência · ' +
    '0 = desliga turbulência · C = cinto · arraste o mouse para olhar';
}

// ---------- realidade virtual ----------
const leitorControles = criarLeitorControles();
let quadrosNaSessao = 0;
let recentralizarPendente = false;

// Coloca a cabeça atual no ponto dos olhos do assento, olhando para a frente.
function recentralizar() {
  recentralizarPendente = false;
  if (!renderer.xr.isPresenting) return;
  const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
  const r = calcularRecentralizacao(camera.position, yaw, cabine.olhos);
  rig.position.set(r.posicao.x, r.posicao.y, r.posicao.z);
  rig.rotation.set(0, r.rotacaoY, 0);
}

function pulso(gamepad, intensidade, duracaoMs) {
  try {
    const atuador = gamepad.hapticActuators?.[0];
    if (atuador?.pulse) {
      atuador.pulse(intensidade, duracaoMs)?.catch?.(() => {});
      return;
    }
    gamepad.vibrationActuator
      ?.playEffect?.('dual-rumble', { duration: duracaoMs, strongMagnitude: intensidade, weakMagnitude: intensidade })
      ?.catch?.(() => {});
  } catch {
    // vibração é só confirmação; sem ela a sessão continua
  }
}

function vibrar(gamepad, padrao) {
  if (!gamepad) return;
  let atraso = 0;
  for (const { duracaoMs, intensidade } of padrao) {
    setTimeout(() => pulso(gamepad, intensidade, duracaoMs), atraso);
    atraso += duracaoMs + INTERVALO_MS;
  }
}

function lerControles(sessao) {
  const controles = [];
  for (const fonte of sessao.inputSources) {
    if (!fonte.gamepad || fonte.handedness === 'none' || !ehControle(fonte)) continue;
    controles.push({ mao: fonte.handedness, botoes: fonte.gamepad.buttons.map((b) => b.pressed), gamepad: fonte.gamepad });
  }
  for (const { acao, mao } of leitorControles.ler(controles)) {
    aplicarAcao(acao);
    const estado = { numeroFase: voo.numeroFase, turbulencia: voo.turbulencia };
    vibrar(controles.find((c) => c.mao === mao)?.gamepad, padraoVibracao(acao, estado));
  }
}

const suporteRV = (async () => {
  try {
    return Boolean(await navigator.xr?.isSessionSupported('immersive-vr'));
  } catch {
    return false;
  }
})();

async function entrarNaRV() {
  const sessao = await navigator.xr.requestSession('immersive-vr');
  try {
    renderer.xr.setReferenceSpaceType('local');
    renderer.xr.setFoveation(1);
    await renderer.xr.setSession(sessao);
  } catch (erro) {
    // Não deixa a RV aberta pela metade: encerra para que a próxima tentativa funcione.
    try {
      await sessao.end();
    } catch {
      // já encerrada
    }
    throw erro;
  }
  leitorControles.reiniciar(); // nova sessão: botões já apertados não disparam
  audio.acompanharSessao(sessao);
  modoAtivo = true;
  elErro.classList.add('oculto');
  elInicio.classList.add('oculto');
  quadrosNaSessao = 0;
  recentralizarPendente = true;
  sessao.addEventListener('end', () => {
    // O voo continua no estado em que estava; volta a tela inicial para entrar de novo.
    // O som é suspenso por audio.acompanharSessao e volta no próximo "Entrar no avião".
    modoAtivo = false;
    elInicio.classList.remove('oculto');
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    aplicarOlhar();
  });
}

elEntrar.addEventListener('click', async () => {
  const somPronto = audio.iniciar(); // cria o som ainda dentro do toque do usuário
  if (await suporteRV) {
    try {
      await entrarNaRV();
    } catch {
      elErro.textContent = 'Não foi possível entrar na realidade virtual. Toque no botão para tentar de novo.';
      elErro.classList.remove('oculto');
    }
  } else {
    iniciarModoNotebook();
  }
  await somPronto;
});

// O navegador pode suspender o som (ex.: aba em segundo plano); retoma no próximo toque.
function retomarSom() {
  if (modoAtivo && audio.estado === 'suspended') audio.iniciar();
}
document.addEventListener('visibilitychange', retomarSom);
window.addEventListener('pointerdown', retomarSom);
window.addEventListener('keydown', retomarSom);

// ---------- painel ----------
let textoPainel = '';
function atualizarPainel(p) {
  const texto =
    `Fase ${p.numeroFase} – ${NOMES_FASES[p.numeroFase - 1]}\n` +
    `Turbulência: ${NOMES_TURBULENCIA[p.turbulencia]}\n` +
    `Cinto: ${p.cinto ? 'ligado' : 'desligado'}`;
  if (texto !== textoPainel) {
    textoPainel = texto;
    elPainel.textContent = texto;
  }
}

// ---------- laço ----------
let tempo = 0;
let ultimoQuadroMs = null;
renderer.setAnimationLoop((agoraMs) => {
  // Limite de 0,1 s por quadro: se a sessão pausar (óculos retirado), o voo pausa junto.
  const delta = ultimoQuadroMs === null ? 0 : Math.max(0, (agoraMs - ultimoQuadroMs) / 1000);
  ultimoQuadroMs = agoraMs;
  const dt = Math.min(delta, 0.1) * acelerar;
  tempo += dt;
  if (renderer.xr.isPresenting) {
    lerControles(renderer.xr.getSession());
    quadrosNaSessao += 1;
    if (recentralizarPendente && quadrosNaSessao >= 10) recentralizar();
  }
  const p = voo.atualizar(dt);
  cabine.atualizar(calcularTremor(tempo, p.tremor));
  paisagem.atualizar(p, tempo);
  audio.atualizar(p);
  for (const evento of p.eventos) audio.tocar(evento);
  atualizarPainel(p);
  renderer.render(cena, camera);
});
