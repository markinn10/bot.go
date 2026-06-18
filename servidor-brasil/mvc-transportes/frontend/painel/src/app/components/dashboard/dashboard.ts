import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotService, BotStatus } from '../../services/bot';
import { RotaService, Rota } from '../../services/rota';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {

  bots: BotStatus[] = [];
  rotas: Rota[] = [];
  private subs: Subscription = new Subscription();

  get botsOnline(): number {
    return this.bots.filter(b => b.status === 'ONLINE').length;
  }

  get totalRotas24h(): number {
    return this.rotas.length;
  }

  constructor(
    private botService: BotService,
    private rotaService: RotaService
  ) {}

  ngOnInit(): void {
    this.botService.bots$.subscribe(data => {
      const sistema = ['mvc-backend', 'mvc-server', 'mvc-painel', 'mvc-backend-prod', 'mvc-server-prod'];
      
      // Filtra e salva apenas os robôs reais
      this.bots = data.filter(bot => !sistema.includes(bot.id));
    });
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}