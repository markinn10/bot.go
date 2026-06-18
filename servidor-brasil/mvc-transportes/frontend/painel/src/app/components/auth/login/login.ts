import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  email = '';
  senha = '';
  mostrarSenha = false;
  erro = '';
  carregando = false;

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  async login() {
    if (!this.email || !this.senha) {
      this.erro = 'Preencha todos os campos.';
      return;
    }
    this.carregando = true;
    this.erro = '';
    this.cdr.detectChanges();

    try {
      const res = await fetch('https://api.mvctransportes.net.br/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: this.email, senha: this.senha })
});

      const data = await res.json();

      if (!res.ok) {
        this.erro = data.erro || 'Erro ao fazer login.';
        if (data.sugerirCadastro) {
          this.erro += ' Deseja se cadastrar?';
        }
        this.carregando = false;
        this.cdr.detectChanges();
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      this.router.navigate(['/dashboard']);

    } catch (e) {
      this.erro = 'Erro de conexão.';
      this.carregando = false;
      this.cdr.detectChanges();
    }
  }
}