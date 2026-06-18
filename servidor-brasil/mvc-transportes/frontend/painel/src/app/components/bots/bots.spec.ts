import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BotsComponent } from './bots.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('BotsComponent', () => {
  let component: BotsComponent;
  let fixture: ComponentFixture<BotsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // 1. Certifique-se de que o componente está em imports (se for Standalone)
      imports: [BotsComponent],
      // 2. Adicione os providers para evitar erros de injeção de dependência
      providers: [
        provideRouter([]),
        provideHttpClient()
      ]
    }).compileComponents();

    // 3. CORREÇÃO AQUI: Mudado de 'Bots' para 'BotsComponent'
    fixture = TestBed.createComponent(BotsComponent);
    component = fixture.componentInstance;
    
    // Detecta as mudanças iniciais (essencial para ler o HTML)
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});