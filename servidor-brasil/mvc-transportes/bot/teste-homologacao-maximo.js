/**
 * teste-homologacao-maximo.js
 *
 * Teste de performance máxima em HOMOLOGAÇÃO — MVC Transportes
 *
 * Cobre toda a stack real:
 *   [k6] → Fastify (localhost:5000) → PostgreSQL / PM2 / Spring (8080)
 *
 * Uso:
 *   k6 run teste-homologacao-maximo.js
 *   K6_EMAIL=seu@email K6_SENHA=suasenha k6 run teste-homologacao-maximo.js
 *
 * Relatório HTML (opcional):
 *   k6 run --out json=resultado.json teste-homologacao-maximo.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ─── Métricas customizadas ────────────────────────────────────────────────────
const tendLogin      = new Trend('duracao_login_ms',      true);
const tendBots       = new Trend('duracao_lista_bots_ms', true);
const tendRegioes    = new Trend('duracao_regioes_ms',    true);
const tendRotas      = new Trend('duracao_rotas_ms',      true);
const erroAuth       = new Rate('erros_autenticacao');
const erroApi        = new Rate('erros_api');
const reqTotal       = new Counter('requisicoes_total');

// ─── Configuração dos cenários ────────────────────────────────────────────────
export const options = {
  scenarios: {
    /**
     * C1 — Painel estável
     * Simula 15 abas do painel abertas atualizando constantemente.
     */
    painel_polling: {
      executor: 'constant-vus',
      vus: 15,
      duration: '60s',
      tags: { cenario: 'c1_painel' },
    },

    /**
     * C2 — Pico da manhã (spike de motoristas entrando no sistema)
     * Sobe de 0 → 80 VUs em 15s, sustenta 60s, desce em 10s.
     */
    pico_manha: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 80 },
        { duration: '60s', target: 80 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
      startTime: '65s',
      tags: { cenario: 'c2_pico' },
    },

    /**
     * C3 — Ciclo de vida dos bots (gestão via painel)
     * 5 usuários admin fazendo operações de gestão de bots.
     */
    gestao_bots: {
      executor: 'constant-vus',
      vus: 5,
      duration: '60s',
      tags: { cenario: 'c3_gestao' },
    },

    /**
     * C4 — Crash test (limite máximo da API)
     * Dispara 200 requisições/s por 20s para descobrir o ponto de ruptura.
     */
    crash_test: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 300,
      duration: '20s',
      startTime: '155s',
      tags: { cenario: 'c4_crash' },
    },
  },

  // ─── Thresholds de qualidade (SLA homologação) ────────────────────────────
  thresholds: {
    // Latência geral
    'http_req_duration':           ['p(95)<500', 'p(99)<1200'],
    // Login deve ser rápido
    'duracao_login_ms':            ['p(95)<400'],
    // Lista de bots: operação mais comum do painel
    'duracao_lista_bots_ms':       ['p(95)<300'],
    // Rotas (proxy → Spring)
    'duracao_rotas_ms':            ['p(95)<600'],
    // Taxa de erro total < 2%
    'http_req_failed':             ['rate<0.02'],
    // Erros de autenticação < 0.5%
    'erros_autenticacao':          ['rate<0.005'],
    // Erros de API (5xx) < 1%
    'erros_api':                   ['rate<0.01'],
  },
};

const BASE = 'http://localhost:5000';
const EMAIL = __ENV.K6_EMAIL || 'vinicius2004cirqueira@gmail.com';
const SENHA = __ENV.K6_SENHA || 'mvc@2024';

// ─── Setup: faz login e devolve o token pra todos os VUs ─────────────────────
export function setup() {
  const res = http.post(`${BASE}/auth/login`, JSON.stringify({ email: EMAIL, senha: SENHA }), {
    headers: { 'Content-Type': 'application/json' },
    tags:    { nome: 'setup_login' },
  });

  if (res.status !== 200) {
    console.error(`[SETUP] Login falhou (${res.status}): ${res.body}`);
    return { token: null };
  }

  const body = res.json();
  const nomeUsuario = body.usuario && body.usuario.nome ? body.usuario.nome : EMAIL;
  console.log(`[SETUP] Login ok — usuario: ${nomeUsuario}`);
  return { token: body.token };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
  };
}

function registrar(res, tendencia, operacao) {
  reqTotal.add(1);
  tendencia.add(res.timings.duration);

  const ok = res.status >= 200 && res.status < 300;
  erroApi.add(!ok);

  check(res, {
    [`${operacao}: status 2xx`]:   (r) => r.status >= 200 && r.status < 300,
    [`${operacao}: sem timeout`]:  (r) => r.timings.duration < 5000,
  });

  return ok;
}

// ─── Cenário C1 + C2 — Painel / Pico da manhã ────────────────────────────────
function fluxoPainel(token) {
  group('painel — bots PM2', () => {
    const res = http.get(`${BASE}/api/bots/pm2`, {
      headers: headers(token),
      tags:    { operacao: 'lista_bots' },
    });
    registrar(res, tendBots, 'lista_bots');

    erroAuth.add(res.status === 401);

    if (res.status === 200) {
      const bots = res.json();
      const nomesValidos = ['teste-vini', 'markin-teste'];

      check(res, {
        'bots: array retornado':    () => Array.isArray(bots),
        'bots: tem bots na lista':  () => Array.isArray(bots) && bots.length > 0,
        'bots: campos obrigatorios': () =>
          Array.isArray(bots) && bots.every(b => b.id && b.status && b.memory),
      });
    }
  });

  sleep(0.2);

  group('painel — regioes por bot', () => {
    const bots = ['teste-vini', 'markin-teste'];
    const botId = bots[Math.floor(Math.random() * bots.length)];
    const res = http.get(`${BASE}/api/bots/${botId}/regioes`, {
      headers: headers(token),
      tags:    { operacao: 'get_regioes' },
    });
    registrar(res, tendRegioes, 'get_regioes');
    erroAuth.add(res.status === 401);
  });

  sleep(Math.random() * 1 + 0.5);
}

// ─── Cenário C3 — Gestão de bots ─────────────────────────────────────────────
function fluxoGestao(token) {
  const bots = ['teste-vini', 'markin-teste'];
  const botId = bots[Math.floor(Math.random() * bots.length)];

  group('gestao — ler regioes', () => {
    const res = http.get(`${BASE}/api/bots/${botId}/regioes`, {
      headers: headers(token),
      tags:    { operacao: 'gestao_get_regioes' },
    });
    registrar(res, tendRegioes, 'gestao_get_regioes');
  });

  sleep(0.3);

  group('gestao — atualizar regioes', () => {
    const regioes = [
      ['aguas claras', 'vicente pires', 'vp'],
      ['jockey', 'joquei', 'colonia agricola'],
      ['aguas claras', 'jockey', 'previsao de rotas'],
    ][Math.floor(Math.random() * 3)];

    const res = http.put(
      `${BASE}/api/bots/${botId}/regioes`,
      JSON.stringify({ regioes }),
      {
        headers: headers(token),
        tags:    { operacao: 'gestao_put_regioes' },
      }
    );
    registrar(res, tendRegioes, 'gestao_put_regioes');
    check(res, {
      'regioes: salvas com sucesso': (r) => {
        if (r.status !== 200) return false;
        const b = r.json();
        return b && b.sucesso === true;
      },
    });
  });

  sleep(Math.random() * 2 + 1);
}

// ─── Cenário C4 — Crash test (usa fluxo mais leve) ───────────────────────────
function fluxoCrash(token) {
  const res = http.get(`${BASE}/api/bots/pm2`, {
    headers: headers(token),
    tags:    { operacao: 'crash_lista_bots' },
  });
  registrar(res, tendBots, 'crash_bots');
}

// ─── Função default (k6 roteia aqui por VU) ───────────────────────────────────
export default function (data) {
  if (!data.token) {
    console.warn('[VU] Token não disponível — pulando iteração');
    sleep(2);
    return;
  }

  const cenario = __ENV.K6_SCENARIO || '';

  if (cenario === 'gestao_bots') {
    fluxoGestao(data.token);
  } else if (cenario === 'crash_test') {
    fluxoCrash(data.token);
  } else {
    // c1_painel, c2_pico e qualquer outro
    fluxoPainel(data.token);
  }
}

// ─── Teardown: resumo humano no terminal ─────────────────────────────────────
export function teardown(data) {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  TESTE DE HOMOLOGAÇÃO MÁXIMO — RESUMO');
  console.log('═'.repeat(60));
  console.log('  Verifique os thresholds acima (✓ = passou / ✗ = falhou)');
  console.log('  Métricas chave:');
  console.log('    duracao_lista_bots_ms  → p95 esperado < 300ms');
  console.log('    duracao_regioes_ms     → p95 esperado < 500ms');
  console.log('    http_req_failed        → esperado < 2%');
  console.log('    erros_autenticacao     → esperado < 0.5%');
  console.log('═'.repeat(60));
}
