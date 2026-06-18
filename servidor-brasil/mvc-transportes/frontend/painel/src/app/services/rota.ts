import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { BehaviorSubject, Observable } from "rxjs";

export interface Rota {
  id: number;
  grupo: string;
  mensagem: string;
  regiao: string;
  botId: string;
  remetente: string;
  horario: string;
}

@Injectable({ providedIn: "root" })
export class RotaService {
  private api = "https://api.mvctransportes.net.br/api/rotas";
  private rotasSubject = new BehaviorSubject<Rota[]>([]);
  rotas$ = this.rotasSubject.asObservable();

  constructor(private http: HttpClient) {
    this.refresh();
    setInterval(() => this.refresh(), 5000);
  }

  // 👉 Lógica para pegar o token salvo no navegador
  private getHeaders() {
    const token = localStorage.getItem('token') || '';
    return { headers: new HttpHeaders({ 'Authorization': `Bearer ${token}` }) };
  }

  refresh() {
    // Enviando os headers na requisição!
    this.http.get<Rota[]>(this.api + "/24h", this.getHeaders()).subscribe({
      next: (data) => this.rotasSubject.next(data),
      error: (err) => console.error("Erro nas rotas:", err)
    });
  }

  listarTodas(): Observable<Rota[]> {
    return this.http.get<Rota[]>(this.api, this.getHeaders());
  }

  listarUltimas24h(): Observable<Rota[]> {
    return this.http.get<Rota[]>(this.api + "/24h", this.getHeaders());
  }

  listarPorBot(botId: string): Observable<Rota[]> {
    return this.http.get<Rota[]>(this.api + "/bot/" + botId, this.getHeaders());
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(this.api + "/" + id, this.getHeaders());
  }
}