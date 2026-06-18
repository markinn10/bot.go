import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuração RÍGIDA de carga
export const options = {
  scenarios: {
    // 1. Painéis Angular atualizando (Carga constante)
    dashboard_polling: {
      executor: 'constant-vus',
      vus: 20, // 20 telas de dashboard abertas
      duration: '1m',
    },
    // 2. Motoristas/Bots acordando ao mesmo tempo (Spike)
    pico_manha_rotas: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },  // Sobe pra 50 usuários rápido
        { duration: '30s', target: 150 }, // Explosão de 150 usuários simultâneos
        { duration: '10s', target: 0 },   // Desce rápido
      ],
      gracefulRampDown: '5s',
    },
  },
  // A BARREIRA DE QUALIDADE (Thresholds)
  thresholds: {
    'http_req_duration': ['p(95)<300', 'p(99)<600'], // 95% em menos de 300ms, 99% em menos de 600ms
    'http_req_failed': ['rate<0.01'],                // Taxa de erro (500, 404, 401) não pode passar de 1%.
  },
};

const BASE_URL = 'https://api.mvctransportes.net.br';

// 👉 IMPORTANTE: Lembre-se de substituir pela string do seu token JWT válido
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ2aW5pY2l1czIwMDRjaXJxdWVpcmFAZ21haWwuY29tIiwiYWRtaW4iOnRydWUsIm5vbWUiOiJNYXJjdXMiLCJpYXQiOjE3Nzc0Mjc2OTIsImV4cCI6MTc3NzUxNDA5Mn0.FVnFRjhVz6g2gHgG6j8XboC6VrJXsTPN3kKDakM8_GQ'; 

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  // Simulação 1: Painel buscando status dos bots
  const resBots = http.get(`${BASE_URL}/api/bots`, params);
  check(resBots, {
    'Bots retornaram 200': (r) => r.status === 200,
  });

  // Simulação 2: Motoristas/Bots buscando as rotas
  const resRotas = http.get(`${BASE_URL}/api/rotas/24h`, params);
  check(resRotas, {
    'Rotas retornaram 200': (r) => r.status === 200,
    'Rotas respondem rápido': (r) => r.timings.duration < 250,
  });

  // Simula o tempo que o usuário espera antes de bater na API de novo
  sleep(Math.random() * 3 + 2); 
}