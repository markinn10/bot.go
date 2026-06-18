import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.scss'
})
export class CadastroComponent {
  nome = '';
  sobrenome = '';
  email = '';
  telefone = '';
  senha = '';
  confirmarSenha = '';
  perguntaSeguranca = '';
  respostaSeguranca = '';
  mostrarSenha = false;
  mostrarConfirmar = false;
  erro = '';
  sucesso = '';
  carregando = false;

  perguntas = [
    'Qual o nome do seu primeiro animal de estimação?',
    'Qual o nome da cidade onde você nasceu?',
    'Qual o nome da sua mãe?',
    'Qual o seu time de futebol?',
    'Qual o modelo do seu primeiro carro?'
  ];

  async cadastrar() {
    if (!this.nome || !this.sobrenome || !this.email || !this.telefone || !this.senha || !this.confirmarSenha || !this.perguntaSeguranca || !this.respostaSeguranca) {
      this.erro = 'Preencha todos os campos obrigatórios.';
      return;
    }
    if (this.senha.length < 8) {
      this.erro = 'A senha deve ter no mínimo 8 caracteres.';
      return;
    }
    if (this.senha !== this.confirmarSenha) {
      this.erro = 'As senhas não coincidem.';
      return;
    }
    this.carregando = true;
    this.erro = '';

    try {
      const res = await fetch('/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: this.nome,
          sobrenome: this.sobrenome,
          email: this.email,
          telefone: this.telefone,
          senha: this.senha,
          pergunta_seguranca: this.perguntaSeguranca,
          resposta_seguranca: this.respostaSeguranca
        })
      });

      const data = await res.json();

      if (!res.ok) {
        this.erro = data.erro || 'Erro ao cadastrar.';
        this.carregando = false;
        return;
      }

      this.sucesso = data.sucesso;
      this.carregando = false;

    } catch (e) {
      this.erro = 'Erro de conexão.';
      this.carregando = false;
    }
  }
}