import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent { // 👈 Mudamos de 'Login' para 'LoginComponent'

  // Injetamos o roteador para fazer a navegação da página
  constructor(private router: Router) {}

  // Função que será ativada ao clicar no botão "Acessar Sistema"
  entrar() {
    this.router.navigate(['/dashboard']);
  }
  
}