import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

export interface BotStatus {
  id: string;
  name?: string;
  status: string;
  numero?: string;
  lastAction?: string;
  perf?: string;
  cpu?: string;
  memory?: string;
  online?: boolean;
  forceOnline?: boolean;
  ultimaSincronizacao?: string;
  restarts?: number;
  uptime?: number;
}

@Injectable({ providedIn: 'root' })
export class BotService {
  // 👉 SEMPRE use a URL completa com 'api.' para não cair no HTML do painel
  private apiBase = 'https://api.mvctransportes.net.br/api/bots';
  
  private botsSubject = new BehaviorSubject<BotStatus[]>([]);
  bots$ = this.botsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.refresh();
    // Atualiza a lista automaticamente a cada 5 segundos
    setInterval(() => this.refresh(), 5000);
  }

  private getHeaders() {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({ 'Authorization': 'Bearer ' + token });
  }

 // refresh() {
    // Buscando na URL da API (Porta 5000 via Cloudflare)
   // this.http.get<any[]>(`${this.apiBase}/pm2`, { headers: this.getHeaders() }).subscribe({
    //  next: (pm2List) => {
       // const bots = pm2List.map(p => ({
          //id: p.id, 
       //   status: p.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
      //    cpu: p.cpu || '0%',
       //   memory: p.memory || '0MB',
        //  restarts: p.restarts || 0,
       //   uptime: p.uptime || 0,
        //  lastAction: p.status === 'ONLINE' ? 'Rodando' : 'Parado',
        //  online: p.status === 'ONLINE',
       //   ultimaSincronizacao: new Date().toLocaleTimeString()
      //  }));
       // this.botsSubject.next(bots);
   //   },
   //   error: (err) => console.error('Erro ao buscar bots:', err)
   // });
  //}

  refresh() {
  const headers = this.getHeaders();

  // 1. Buscamos as duas informações em paralelo
  // /pm2 (CPU/RAM) e / (Número/Status do Banco)
  const pm2Request = this.http.get<any[]>(`${this.apiBase}/pm2`, { headers });
  const dbRequest = this.http.get<BotStatus[]>(this.apiBase, { headers });

  import('rxjs').then(({ forkJoin }) => {
    forkJoin([pm2Request, dbRequest]).subscribe({
      next: ([pm2List, dbList]) => {
        const mergedBots = pm2List.map(p => {
          // Procura o bot correspondente no banco de dados
          const dbInfo = dbList.find(b => b.id === p.id);

          return {
            id: p.id,
            status: p.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
            cpu: p.cpu || '0%',
            memory: p.memory || '0MB',
            restarts: p.restarts || 0,
            uptime: p.uptime || 0,
            // 👉 AQUI ESTÁ A MÁGICA:
            // Prioriza o número e a ação que estão salvos no banco (enviados pelo Node)
            numero: dbInfo?.numero || 'Desconectado',
            lastAction: dbInfo?.lastAction || (p.status === 'ONLINE' ? 'Rodando' : 'Parado'),
            online: p.status === 'ONLINE',
            forceOnline: dbInfo?.forceOnline || false,
            ultimaSincronizacao: dbInfo?.ultimaSincronizacao || new Date().toLocaleTimeString()
          };
        });

        this.botsSubject.next(mergedBots);
      },
      error: (err) => console.error('Erro na sincronização:', err)
    });
  });
}

  listarTodos(): Observable<BotStatus[]> {
    return this.http.get<BotStatus[]>(this.apiBase, { headers: this.getHeaders() });
  }

  buscar(botId: string): Observable<BotStatus> {
    return this.http.get<BotStatus>(`${this.apiBase}/${botId}`, { headers: this.getHeaders() });
  }

  forcarOnline(botId: string, ligar: boolean): Observable<BotStatus> {
    return this.http.patch<BotStatus>(`${this.apiBase}/${botId}/force?ligar=${ligar}`, {}, { headers: this.getHeaders() });
  }

  deletar(botId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/${botId}`, { headers: this.getHeaders() });
  }
}