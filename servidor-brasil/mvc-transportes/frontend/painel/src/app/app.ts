import { Component } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss' 
})
export class App {
  mostrarSidebar = false;
  mostrarModalLogout = false; // Controla a exibição do novo modal

  private rotasSemSidebar = ['/login', '/cadastro', '/esqueci-senha'];

  constructor(private router: Router) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        // Verifica se a rota atual deve ou não exibir a sidebar
        this.mostrarSidebar = !this.rotasSemSidebar.includes(event.urlAfterRedirects);
      }
    });
  }

  // 1. Apenas abre o modal estilizado
  sair() {
    this.mostrarModalLogout = true;
  }

  // 2. Fecha o modal se o usuário clicar em "Cancelar"
  fecharModalLogout() {
    this.mostrarModalLogout = false;
  }

  // 3. Executa a limpeza e o redirecionamento se o usuário clicar em "Sair"
  confirmarLogout() {
    localStorage.removeItem('token');
    localStorage.clear(); 
    
    this.mostrarModalLogout = false; // Esconde o modal antes de mudar de tela
    this.router.navigate(['/login']);
  }
}