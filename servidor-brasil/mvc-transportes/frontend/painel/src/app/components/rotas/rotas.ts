import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RotaService, Rota } from '../../services/rota';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-rotas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rotas.html',
  styleUrl: './rotas.scss'
})
export class RotasComponent implements OnInit, OnDestroy {

  rotas: Rota[] = [];
  private sub: Subscription = new Subscription();

  // ==========================================
  // CONTROLES DE PAGINAÇÃO
  // ==========================================
  paginaAtual: number = 1;
  itensPorPagina: number = 10;

  constructor(private rotaService: RotaService) {}

  ngOnInit() {
    this.sub = this.rotaService.rotas$.subscribe(data => {
      // AUTO-FOCUS SNIPER: Se a lista cresceu (chegou rota nova), volta pra página 1 na hora!
      if (data.length > this.rotas.length) {
        this.paginaAtual = 1;
      }
      
      this.rotas = data;
    });
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  deletar(id: number) {
    if (confirm('Excluir esta rota?')) {
      this.rotaService.deletar(id).subscribe(() => {
        // Se deletar o último item de uma página, volta para a página anterior
        if (this.rotasPaginadas.length === 1 && this.paginaAtual > 1) {
          this.paginaAtual--;
        }
      });
    }
  }

  // ==========================================
  // LÓGICA DE FATIAMENTO DA TABELA
  // ==========================================
  
  // 1. O HTML agora deve ler este getter (*ngFor="let rota of rotasPaginadas")
  get rotasPaginadas(): Rota[] {
    const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
    const fim = inicio + this.itensPorPagina;
    return this.rotas.slice(inicio, fim);
  }

  // 2. Calcula o total de páginas
  get totalPaginas(): number {
    return Math.ceil(this.rotas.length / this.itensPorPagina);
  }

  // 3. Cria um limite de botões (Máximo 5) para não estourar a tela do celular
  get paginas(): number[] {
    const maxBotoesVisiveis = 5;
    let inicio = Math.max(1, this.paginaAtual - Math.floor(maxBotoesVisiveis / 2));
    let fim = inicio + maxBotoesVisiveis - 1;

    if (fim > this.totalPaginas) {
      fim = this.totalPaginas;
      inicio = Math.max(1, fim - maxBotoesVisiveis + 1);
    }

    const pags = [];
    for (let i = inicio; i <= fim; i++) {
      pags.push(i);
    }
    return pags;
  }

  // 4. Ação do clique na setinha ou número
  mudarPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaAtual = pagina;
    }
  }
}