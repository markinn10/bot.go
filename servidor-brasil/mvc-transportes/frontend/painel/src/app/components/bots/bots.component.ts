import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';   
import { BotService, BotStatus } from '../../services/bot';

@Component({
  selector: 'app-bots',
  templateUrl: './bots.html',
  styleUrls: ['./bots.scss'], 
  standalone: true, 
  imports: [CommonModule, FormsModule] 
})
export class BotsComponent implements OnInit {
  bots: BotStatus[] = [];
  carregando: { [key: string]: string } = {};
  qrcodes: { [key: string]: string } = {};

  // 👉 O relógio para driblar o cache do navegador
  timestamp = Date.now();

  modal = {
    visivel: false,
    ativo: false, 
    tipo: '',
    bot: null as BotStatus | null,
    inputNome: '',
    titulo: '',    
    mensagem: '',  
    confirmarTexto: '' 
  };

  constructor(public botService: BotService) {}

  ngOnInit(): void {
    this.botService.bots$.subscribe((data: BotStatus[]) => {
      // FILTRO: Remove os processos que não são bots de operação
      const sistema = ['mvc-backend', 'mvc-server', 'mvc-painel', 'mvc-backend-prod', 'mvc-backend-dev'];
      this.bots = data.filter(bot => !sistema.includes(bot.id));
    });

    // 👉 Atualiza o tempo silenciosamente a cada 3 segundos
    setInterval(() => {
      this.timestamp = Date.now();
    }, 3000);
  }

  // 👉 Função que gera a URL do QR Code atualizada
  getQrUrl(botId: string): string {
    return `https://api.mvctransportes.net.br/qrcodes/${botId}.png?t=${this.timestamp}`;
  }

  // 👉 O Angular agora impõe a regra visual enquanto carrega
  isOnline(bot: BotStatus): boolean {
    if (this.carregando[bot.id] === 'stop') return false; // Finge que já morreu
    if (this.carregando[bot.id] === 'play') return true;  // Finge que já ligou
    return bot.status === 'ONLINE' || bot.online === true;
  }

  // 👉 Texto inteligente para o status lá no topo do card
  getStatusText(bot: BotStatus): string {
    if (this.carregando[bot.id] === 'stop') return 'PARANDO...';
    if (this.carregando[bot.id] === 'play') return 'INICIANDO...';
    return bot.status || 'OFFLINE';
  }

  normalizarNome(event: Event) {
    const input = event.target as HTMLInputElement;
    const pos = input.selectionStart ?? input.value.length;
    const normalizado = input.value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    this.modal.inputNome = normalizado;
    input.value = normalizado;
    input.setSelectionRange(pos, pos);
  }

  abrirModalNovo() {
    this.abrirModal(null, 'novo');
  }

  abrirModal(bot: BotStatus | null, tipo: string) {
    this.modal.tipo = tipo;
    this.modal.bot = bot;
    this.modal.ativo = true;
    this.modal.visivel = true;
    this.modal.inputNome = '';

    const nomes: any = {
      'play': { t: 'Iniciar Bot', m: 'Deseja ligar este robô?', c: 'Ligar' },
      'stop': { t: 'Parar Bot', m: 'Deseja desligar este robô?', c: 'Desligar' },
      'restart': { t: 'Reiniciar Bot', m: 'Deseja reiniciar este robô?', c: 'Reiniciar' },
      'delete': { t: 'Excluir Bot', m: 'Tem certeza que deseja excluir?', c: 'Excluir' },
      'novo': { t: 'Novo Bot', m: 'Digite o nome do novo robô:', c: 'Criar' },
      'trocar': { t: 'Trocar Número', m: 'Isso irá resetar a sessão do WhatsApp e gerar um novo QR Code.', c: 'Gerar QR Code' }
    };

    const config = nomes[tipo] || { t: 'Confirmar', m: 'Deseja continuar?', c: 'Confirmar' };
    this.modal.titulo = config.t;
    this.modal.mensagem = config.m;
    this.modal.confirmarTexto = config.c;
  }

  fecharModal() {
    this.modal.ativo = false;
    this.modal.visivel = false;
  }

  confirmarModal() {
    const token = localStorage.getItem('token');
    const bot = this.modal.bot;
    const tipo = this.modal.tipo;
    const nomeNovoBot = this.modal.inputNome;
    const baseUrl = 'https://api.mvctransportes.net.br';

    const loadId = bot ? bot.id : (tipo === 'novo' ? 'novo_processo' : '');
    const targetId = bot ? bot.id : nomeNovoBot;
    
    this.fecharModal(); // O modal some na hora
    if (loadId) this.carregando[loadId] = tipo;

    // 👉 MÁGICA DA INTERFACE OTIMISTA: Atualiza a tela antes do servidor responder
    if (bot) {
      if (tipo === 'play') bot.lastAction = 'Enviando comando de início...';
      if (tipo === 'stop') bot.lastAction = 'Desligando processo...';
    }

    if (tipo === 'trocar' || tipo === 'novo' || (tipo === 'play' && (!bot?.numero || bot?.numero === 'Desconectado'))) {
      this.qrcodes[targetId] = 'pending'; 
    } else {
      this.qrcodes[targetId] = 'false'; 
    }

    // 👉 DELETE INSTANTÂNEO
    if (tipo === 'delete') {
      this.bots = this.bots.filter(b => b.id !== targetId);
    }

    let endpoint = tipo;
    if (tipo === 'play') endpoint = 'start';
    if (tipo === 'novo') endpoint = 'create';
    if (tipo === 'trocar') endpoint = 'trocar-numero';
    if (tipo === 'delete') endpoint = 'delete';

    // 👉 FIRE AND FORGET: A requisição não trava mais a função com 'await'
    fetch(`${baseUrl}/api/bots/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: targetId })
    })
    .then(res => res.json())
    .then(data => {
      if (data.sucesso) {
        // Quando o servidor terminar (daqui a alguns segundos), atualizamos tudo
        setTimeout(() => {
          this.botService.refresh();
          if (this.qrcodes[targetId] === 'pending') {
             this.qrcodes[targetId] = 'pending'; 
          }
          if (loadId) this.carregando[loadId] = ''; // Tira o "..." do botão
        }, 1500);
      }
    })
    .catch(err => {
      console.error('Erro na operação:', err);
      if (loadId) this.carregando[loadId] = ''; // Libera o botão se der erro de rede
    });
  }
}