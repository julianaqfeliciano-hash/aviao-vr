// Teste de fumaça: abre a página num Chromium sem óculos, percorre o app pelo teclado,
// confere o painel e salva fotos.  Uso: node tests/smoke.cjs [pasta-das-fotos]
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.resolve(__dirname, '..');
const SAIDA = path.resolve(process.argv[2] || path.join(RAIZ, 'tests', 'fotos'));
const PORTA = 8123;
const URL_APP = `http://localhost:${PORTA}/?acelerar=10`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function subirServidor() {
  const servidor = spawn('python3', ['-m', 'http.server', String(PORTA), '--bind', '127.0.0.1'], {
    cwd: RAIZ,
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://localhost:${PORTA}/`);
      if (r.ok) return servidor;
    } catch {
      /* ainda subindo */
    }
    await espera(100);
  }
  servidor.kill();
  throw new Error('servidor local não subiu');
}

async function principal() {
  fs.mkdirSync(SAIDA, { recursive: true });
  const servidor = await subirServidor();
  const navegador = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const erros = [];
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
    pagina.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
    pagina.on('console', (m) => {
      if (m.type() === 'error') erros.push(`console: ${m.text()}`);
      if (m.type() === 'warning' && /deprecat/i.test(m.text())) erros.push(`aviso de obsoleto: ${m.text()}`);
    });

    const painelContem = (texto, timeout = 5000) =>
      pagina
        .waitForFunction((t) => document.querySelector('#painel')?.textContent.includes(t), texto, { timeout })
        .catch(() => {
          throw new Error(`painel não mostrou "${texto}"`);
        });
    const foto = async (nome) => {
      await espera(400);
      await pagina.screenshot({ path: path.join(SAIDA, nome) });
      console.log(`foto: ${path.join(SAIDA, nome)}`);
    };

    await pagina.goto(URL_APP);
    await pagina.click('#entrar');

    await painelContem('Fase 1 – Parado no portão');
    await painelContem('Turbulência: desligada');
    await painelContem('Cinto: desligado');
    const estadoAudio = await pagina.evaluate(() => window.aviaoDebug.audio?.estado);
    if (estadoAudio !== 'running') throw new Error(`som não iniciou (estado: ${estadoAudio})`);
    const aviso = await pagina.textContent('#aviso');
    if (!aviso.includes('RV indisponível neste aparelho')) throw new Error(`aviso inesperado: "${aviso}"`);

    await pagina.keyboard.press('Space');
    await painelContem('Fase 2 – Taxiamento');
    await pagina.keyboard.press('KeyT');
    await painelContem('Turbulência: leve');
    await pagina.keyboard.press('Digit0');
    await painelContem('Turbulência: desligada');
    await pagina.keyboard.press('KeyC');
    await painelContem('Cinto: ligado');
    await foto('cabine.png');

    // Percurso completo, olhando mais para a janela (tempo acelerado 10×).
    await pagina.goto(URL_APP);
    await pagina.click('#entrar');
    await painelContem('Fase 1 – Parado no portão');
    await pagina.mouse.move(640, 360);
    await pagina.mouse.down();
    await pagina.mouse.move(750, 380, { steps: 5 });
    await pagina.mouse.up();
    await foto('portao.png');
    await pagina.keyboard.press('Space');
    await painelContem('Fase 2 – Taxiamento');
    await espera(1000);
    await foto('taxi.png');
    await pagina.keyboard.press('Space');
    await painelContem('Fase 3 – Decolagem');
    // Vigia, a cada quadro, se a neblina chegou a "dentro da nuvem" durante a decolagem.
    await pagina.evaluate(() => {
      window.viuNuvem = false;
      const vigiar = () => {
        if (window.aviaoDebug.cena.fog.far < 100) window.viuNuvem = true;
        else requestAnimationFrame(vigiar);
      };
      requestAnimationFrame(vigiar);
    });
    await espera(1100);
    await foto('decolagem-chao.png');
    await espera(1200);
    await foto('decolagem-subida.png');
    await painelContem('Fase 4 – Cruzeiro', 25000);
    if (!(await pagina.evaluate(() => window.viuNuvem))) throw new Error('não atravessou a camada de nuvens na decolagem');
    await espera(500);
    await foto('cruzeiro.png');
    await pagina.keyboard.press('Space');
    await painelContem('Fase 5 – Descida e pouso');
    await espera(4600);
    await foto('pouso-aproximacao.png');
    await espera(2600);
    await foto('pouso-parado.png');

    // Som acompanha a sessão de RV (sessão simulada): para ao tirar o óculos ou sair da RV,
    // volta ao recolocar, com gatilho/botão lateral ou com qualquer ação do controle.
    const ciclo = await pagina.evaluate(async () => {
      const { audio, aplicarAcao } = window.aviaoDebug;
      const estado = async (alvo) => {
        for (let i = 0; i < 100 && audio.estado !== alvo; i++) await new Promise((r) => setTimeout(r, 20));
        return audio.estado;
      };
      const sessao = new EventTarget();
      sessao.visibilityState = 'visible';
      audio.acompanharSessao(sessao);
      const r = {};
      sessao.visibilityState = 'hidden';
      sessao.dispatchEvent(new Event('visibilitychange'));
      r.oculto = await estado('suspended');
      sessao.visibilityState = 'visible';
      sessao.dispatchEvent(new Event('visibilitychange'));
      r.visivel = await estado('running');
      sessao.dispatchEvent(new Event('end'));
      r.fim = await estado('suspended');
      sessao.dispatchEvent(new Event('selectstart'));
      r.gatilho = await estado('running');
      sessao.dispatchEvent(new Event('end'));
      await estado('suspended');
      sessao.dispatchEvent(new Event('squeezestart'));
      r.lateral = await estado('running');
      sessao.dispatchEvent(new Event('end'));
      await estado('suspended');
      aplicarAcao('turbulencia');
      r.acao = await estado('running');
      return r;
    });
    const esperado = { oculto: 'suspended', visivel: 'running', fim: 'suspended', gatilho: 'running', lateral: 'running', acao: 'running' };
    if (JSON.stringify(ciclo) !== JSON.stringify(esperado)) {
      throw new Error(`som não acompanha a sessão: ${JSON.stringify(ciclo)}`);
    }

    // Taxiamento longo (exposição prolongada, 25 min): a faixa de taxiamento continua sob o avião.
    const taxi = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
    taxi.on('pageerror', (e) => erros.push(`pageerror (taxi): ${e.message}`));
    await taxi.goto(URL_APP);
    await taxi.click('#entrar');
    await taxi.keyboard.press('Space');
    await taxi.evaluate(() => window.aviaoDebug.voo.atualizar(1500));
    await espera(500);
    const faixa = await taxi.evaluate(() => {
      const malha = window.aviaoDebug.cena.getObjectByName('faixa-taxi');
      if (!malha) return 'sem faixa';
      malha.updateWorldMatrix(true, false);
      malha.geometry.computeBoundingBox();
      const caixa = malha.geometry.boundingBox.clone().applyMatrix4(malha.matrixWorld);
      return caixa.min.z <= -100 && caixa.max.z >= 100 ? 'ok' : `faixa de z=${caixa.min.z.toFixed(0)} a ${caixa.max.z.toFixed(0)}`;
    });
    if (faixa !== 'ok') throw new Error(`faixa de taxiamento não está sob o avião após 25 min: ${faixa}`);
    await taxi.close();

    // Falha no meio da abertura da RV: a sessão é encerrada (não fica aberta pela metade).
    const falha = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
    falha.on('pageerror', (e) => erros.push(`pageerror (falha): ${e.message}`));
    await falha.addInitScript(() => {
      window.sessaoEncerrada = false;
      const sessao = new EventTarget();
      sessao.end = async () => {
        window.sessaoEncerrada = true;
      };
      Object.defineProperty(navigator, 'xr', {
        configurable: true,
        value: { isSessionSupported: async () => true, requestSession: async () => sessao },
      });
    });
    await falha.goto(URL_APP);
    await falha.click('#entrar');
    await falha
      .waitForFunction(() => document.querySelector('#erro')?.textContent.includes('Não foi possível entrar na realidade virtual'), null, {
        timeout: 5000,
      })
      .catch(() => {
        throw new Error('sem mensagem de erro quando a abertura da RV falha');
      });
    if (!(await falha.evaluate(() => window.sessaoEncerrada))) throw new Error('sessão de RV ficou aberta após falha');
    await falha.close();

    // Quest recusando a sessão de RV: continua na tela inicial com mensagem, sem quebrar.
    const recusa = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
    recusa.on('pageerror', (e) => erros.push(`pageerror (recusa): ${e.message}`));
    await recusa.addInitScript(() => {
      Object.defineProperty(navigator, 'xr', {
        configurable: true,
        value: {
          isSessionSupported: async () => true,
          requestSession: async () => {
            throw new Error('recusado');
          },
        },
      });
    });
    await recusa.goto(URL_APP);
    await recusa.click('#entrar');
    await recusa
      .waitForFunction(() => document.querySelector('#erro')?.textContent.includes('Não foi possível entrar na realidade virtual'), null, {
        timeout: 5000,
      })
      .catch(() => {
        throw new Error('sem mensagem de erro quando a RV é recusada');
      });
    if (!(await recusa.isVisible('#inicio'))) throw new Error('tela inicial sumiu após recusa da RV');
    if (await recusa.isVisible('#painel')) throw new Error('modo notebook ativado após recusa da RV');

    if (erros.length) throw new Error(`erros na página:\n${erros.join('\n')}`);
    console.log('SMOKE OK');
  } finally {
    await navegador.close();
    servidor.kill();
  }
}

principal().catch((e) => {
  console.error(`SMOKE FALHOU: ${e.message}`);
  process.exit(1);
});
