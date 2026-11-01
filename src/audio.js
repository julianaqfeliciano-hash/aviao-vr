// Sons sintetizados com Web Audio (sem arquivos): cabine, motores, rodagem,
// turbulência e sons pontuais (ding, trem de pouso, toque na pista).

const SUAVIZACAO = 0.3; // constante de tempo (s) das mudanças contínuas

function bufferRuido(ctx, segundos, marrom) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * segundos), ctx.sampleRate);
  const dados = buffer.getChannelData(0);
  let ultimo = 0;
  for (let i = 0; i < dados.length; i++) {
    const branco = Math.random() * 2 - 1;
    if (marrom) {
      ultimo = (ultimo + 0.02 * branco) / 1.02;
      dados[i] = ultimo * 3.5;
    } else {
      dados[i] = branco;
    }
  }
  return buffer;
}

function montarGrafo(ctx) {
  const compressor = ctx.createDynamicsCompressor();
  compressor.connect(ctx.destination);
  const mestre = ctx.createGain();
  mestre.gain.value = 0.8;
  mestre.connect(compressor);

  const marrom = bufferRuido(ctx, 4, true);
  const branco = bufferRuido(ctx, 1, false);

  const fonteLoop = (buffer, inicio) => {
    const f = ctx.createBufferSource();
    f.buffer = buffer;
    f.loop = true;
    f.start(0, inicio);
    return f;
  };

  // Ruído de cabine
  const cabineFiltro = ctx.createBiquadFilter();
  cabineFiltro.type = 'lowpass';
  const cabineGanho = ctx.createGain();
  cabineGanho.gain.value = 0;
  fonteLoop(marrom, 0).connect(cabineFiltro).connect(cabineGanho).connect(mestre);

  // Tom grave dos motores + assobio
  const motorFiltro = ctx.createBiquadFilter();
  motorFiltro.type = 'lowpass';
  motorFiltro.frequency.value = 400;
  const motorGanho = ctx.createGain();
  motorGanho.gain.value = 0;
  motorFiltro.connect(motorGanho).connect(mestre);
  const osciladores = [1, 1.012].map((fator) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 60 * fator;
    o.connect(motorFiltro);
    o.start();
    return { o, fator };
  });
  const assobio = ctx.createOscillator();
  assobio.type = 'sine';
  const assobioGanho = ctx.createGain();
  assobioGanho.gain.value = 0;
  assobio.connect(assobioGanho).connect(mestre);
  assobio.start();

  // Rodagem no chão
  const rodagemFiltro = ctx.createBiquadFilter();
  rodagemFiltro.type = 'lowpass';
  rodagemFiltro.frequency.value = 120;
  const rodagemGanho = ctx.createGain();
  rodagemGanho.gain.value = 0;
  fonteLoop(marrom, 2).connect(rodagemFiltro).connect(rodagemGanho).connect(mestre);

  return { mestre, branco, cabineFiltro, cabineGanho, osciladores, motorGanho, assobio, assobioGanho, rodagemGanho };
}

function envelope(ctx, ganho, volume, ataque, duracao, inicio) {
  ganho.gain.setValueAtTime(0, inicio);
  ganho.gain.linearRampToValueAtTime(volume, inicio + ataque);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + ataque + duracao);
}

function rajadaRuido(ctx, nos, { tipo, frequencia, q = 1, volume, duracao, inicio = ctx.currentTime }) {
  const fonte = ctx.createBufferSource();
  fonte.buffer = nos.branco;
  fonte.loop = true;
  const filtro = ctx.createBiquadFilter();
  filtro.type = tipo;
  filtro.frequency.value = frequencia;
  filtro.Q.value = q;
  const ganho = ctx.createGain();
  envelope(ctx, ganho, volume, 0.005, duracao, inicio);
  fonte.connect(filtro).connect(ganho).connect(nos.mestre);
  fonte.start(inicio, Math.random() * 0.5);
  fonte.stop(inicio + duracao + 0.1);
}

function baque(ctx, nos, { de, para, volume, duracao, inicio = ctx.currentTime }) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(de, inicio);
  o.frequency.exponentialRampToValueAtTime(para, inicio + duracao);
  const ganho = ctx.createGain();
  envelope(ctx, ganho, volume, 0.01, duracao, inicio);
  o.connect(ganho).connect(nos.mestre);
  o.start(inicio);
  o.stop(inicio + duracao + 0.1);
}

function tom(ctx, nos, frequencia, volume, duracao, inicio) {
  for (const [fator, peso] of [
    [1, 1],
    [2.01, 0.25],
  ]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = frequencia * fator;
    const ganho = ctx.createGain();
    envelope(ctx, ganho, volume * peso, 0.01, duracao, inicio);
    o.connect(ganho).connect(nos.mestre);
    o.start(inicio);
    o.stop(inicio + duracao + 0.1);
  }
}

export function criarAudio() {
  let ctx = null;
  let nos = null;
  let proximoChacoalho = 0;

  function turbulencia(tremor) {
    const agora = ctx.currentTime;
    if (tremor < 0.05) {
      proximoChacoalho = agora;
      return;
    }
    if (agora < proximoChacoalho) return;
    rajadaRuido(ctx, nos, {
      tipo: 'bandpass',
      frequencia: 2000 + Math.random() * 2000,
      q: 2,
      volume: 0.04 * tremor,
      duracao: 0.05 + Math.random() * 0.1,
    });
    if (tremor >= 1.5 && Math.random() < 0.25 * (tremor / 3)) {
      baque(ctx, nos, { de: 70, para: 40, volume: 0.15 * (tremor / 3), duracao: 0.3 });
    }
    proximoChacoalho = agora + (1.2 / tremor) * (0.5 + Math.random());
  }

  return {
    get estado() {
      return ctx ? ctx.state : 'parado';
    },

    async iniciar() {
      if (!ctx) {
        ctx = new AudioContext();
        nos = montarGrafo(ctx);
      }
      if (ctx.state === 'suspended') await ctx.resume();
    },

    // Acompanha a sessão de RV: o som para quando o óculos é retirado (sessão oculta) ou
    // quando a RV termina, e volta ao recolocar o óculos ou ao apertar gatilho/botão lateral.
    acompanharSessao(sessao) {
      const retomar = () => {
        if (ctx && ctx.state === 'suspended') ctx.resume();
      };
      const suspender = () => {
        if (ctx && ctx.state === 'running') ctx.suspend();
      };
      sessao.addEventListener('visibilitychange', () => {
        if (sessao.visibilityState === 'hidden') suspender();
        else retomar();
      });
      sessao.addEventListener('selectstart', retomar);
      sessao.addEventListener('squeezestart', retomar);
      sessao.addEventListener('end', suspender);
    },

    atualizar(p) {
      if (!nos) return;
      const agora = ctx.currentTime;
      const alvo = (param, valor) => param.setTargetAtTime(valor, agora, SUAVIZACAO);
      alvo(nos.cabineFiltro.frequency, 300 + 900 * p.motor);
      alvo(nos.cabineGanho.gain, 0.05 + 0.35 * p.motor);
      for (const { o, fator } of nos.osciladores) alvo(o.frequency, (60 + 80 * p.motor) * fator);
      alvo(nos.motorGanho.gain, 0.02 + 0.08 * p.motor);
      alvo(nos.assobio.frequency, 1800 + 1400 * p.motor);
      alvo(nos.assobioGanho.gain, 0.004 + 0.01 * p.motor);
      alvo(nos.rodagemGanho.gain, p.noChao ? Math.min(1, p.velocidade / 80) * 0.5 : 0);
      turbulencia(p.tremor);
    },

    tocar(som) {
      if (!nos) return;
      const agora = ctx.currentTime;
      switch (som) {
        case 'ding':
          tom(ctx, nos, 1318.5, 0.18, 1.2, agora);
          tom(ctx, nos, 1046.5, 0.18, 1.4, agora + 0.45);
          break;
        case 'trem-recolhido':
        case 'trem-baixado':
          baque(ctx, nos, { de: 60, para: 35, volume: 0.4, duracao: 0.4 });
          rajadaRuido(ctx, nos, { tipo: 'lowpass', frequencia: 800, volume: 0.1, duracao: 0.6 });
          break;
        case 'toque-na-pista':
          baque(ctx, nos, { de: 45, para: 25, volume: 0.7, duracao: 0.6 });
          rajadaRuido(ctx, nos, { tipo: 'lowpass', frequencia: 300, volume: 0.3, duracao: 1.2 });
          break;
        default:
          break;
      }
    },
  };
}
