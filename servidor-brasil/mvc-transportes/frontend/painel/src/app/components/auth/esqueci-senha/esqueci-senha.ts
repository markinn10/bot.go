import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-esqueci-senha',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './esqueci-senha.html',
  styleUrl: './esqueci-senha.scss'
})
export class EsqueciSenhaComponent {
  etapa = 1; // 1: email, 2: pergunta segurança, 3: nova senha
  email = '';
  respostaSeguranca = '';
  novaSenha = '';
  confirmarSenha = '';
  mostrarSenha = false;
  perguntaSeguranca = '';
  erro = '';
  sucesso = '';
  carregando = false;

 tokenReset = '';

async buscarEmail() {
    if (!this.email) { this.erro = 'Informe seu e-mail.'; return; }
    this.carregando = true;
    this.erro = '';
    try {
      const res = await fetch('/auth/esqueci-senha/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email })
      });
      const data = await res.json();
      if (!res.ok) { this.erro = data.erro; this.carregando = false; return; }
      this.perguntaSeguranca = data.pergunta;
      this.etapa = 2;
      this.carregando = false;
    } catch (e) { this.erro = 'Erro de conexão.'; this.carregando = false; }
  }

  async verificarResposta() {
    if (!this.respostaSeguranca) { this.erro = 'Informe a resposta.'; return; }
    this.carregando = true;
    this.erro = '';
    try {
      const res = await fetch('/auth/esqueci-senha/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, resposta: this.respostaSeguranca })
      });
      const data = await res.json();
      if (!res.ok) { this.erro = data.erro; this.carregando = false; return; }
      this.tokenReset = data.token;
      this.etapa = 3;
      this.carregando = false;
    } catch (e) { this.erro = 'Erro de conexão.'; this.carregando = false; }
  }

  async redefinirSenha() {
    if (!this.novaSenha || !this.confirmarSenha) { this.erro = 'Preencha todos os campos.'; return; }
    if (this.novaSenha.length < 6) { this.erro = 'Mínimo 6 caracteres.'; return; }
    if (this.novaSenha !== this.confirmarSenha) { this.erro = 'As senhas não coincidem.'; return; }
    this.carregando = true;
    this.erro = '';
    try {
      const res = await fetch('/auth/esqueci-senha/redefinir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.tokenReset, novaSenha: this.novaSenha })
      });
      const data = await res.json();
      if (!res.ok) { this.erro = data.erro; this.carregando = false; return; }
      this.sucesso = data.sucesso;
      this.carregando = false;
    } catch (e) { this.erro = 'Erro de conexão.'; this.carregando = false; }
  }
  }