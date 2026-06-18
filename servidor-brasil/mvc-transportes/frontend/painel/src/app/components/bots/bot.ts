import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';   
import { BotService, BotStatus } from '../../services/bot';

@Component({
  selector: 'app-bots',
  templateUrl: './bots.html', // ⏪ Voltamos para o nome longo
  styleUrls: ['./bots.scss'],   // ⏪ Voltamos para o nome longo
  standalone: true, 
  imports: [CommonModule, FormsModule] 
})
export class BotsComponent implements OnInit {
  bots: BotStatus[] = [];
  carregando: { [key: string]: string } = {};
  qrcodes: { [key: string]: string } = {};

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
      this.bots = data;
    });
  }

  isOnline(bot: BotStatus): boolean {
    return bot.status === 'ONLINE' || bot.online === true;
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
      'trocar': { t: 'Trocar Número', m: 'Isso irá resetar a sessão do WhatsApp.', c: 'Gerar QR Code' }
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

  async confirmarModal() {
    const token = localStorage.getItem('token');
    const bot = this.modal.bot;
    const tipo = this.modal.tipo;
    const nomeNovoBot = this.modal.inputNome;

    this.fecharModal();
    const loadId = bot ? bot.id : 'novo_processo';
    this.carregando[loadId] = tipo;

    const baseUrl = 'https://api.mvctransportes.net.br';

    try {
      let endpoint = tipo;
      if (tipo === 'play') endpoint = 'start';
      if (tipo === 'novo') endpoint = 'create';
      if (tipo === 'trocar') endpoint = 'trocar-numero';

      const res = await fetch(`${baseUrl}/api/bots/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: bot ? bot.id : nomeNovoBot })
      });

      const data = await res.json();
      if (data.sucesso) {
        if (tipo === 'trocar' && data.qrcode) {
          this.qrcodes[bot!.id] = data.qrcode;
        }
        // Atualiza a lista automaticamente após a ação
        setTimeout(() => this.botService.refresh(), 1200);
      }
    } catch (err) {
      console.error('Erro na requisição:', err);
    } finally {
      this.carregando[loadId] = '';
    }
  }
}