import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { RotasComponent } from './components/rotas/rotas';
import { FinanceiroComponent } from './components/financeiro/financeiro';
import { LoginComponent } from './components/auth/login/login';
import { CadastroComponent } from './components/auth/cadastro/cadastro';
import { EsqueciSenhaComponent } from './components/auth/esqueci-senha/esqueci-senha';
import { BotsComponent } from './components/bots/bots.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'cadastro', component: CadastroComponent },
  { path: 'esqueci-senha', component: EsqueciSenhaComponent },
  { path: 'dashboard', component: DashboardComponent },
  // ✅ Adicionada a rota para você conseguir entrar na tela de bots
  { path: 'bots', component: BotsComponent }, 
  { path: 'rotas', component: RotasComponent },
  { path: 'financeiro', component: FinanceiroComponent },
  { path: '**', redirectTo: 'login' }
];