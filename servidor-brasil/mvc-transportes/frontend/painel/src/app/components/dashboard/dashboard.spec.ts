import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard'; // Ajustado para DashboardComponent
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Componentes Standalone devem ser importados
      imports: [DashboardComponent],
      // Adicionando os providers essenciais para o Dashboard funcionar no teste
      providers: [
        provideRouter([]),
        provideHttpClient()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    
    // Força a detecção de mudanças para carregar o conteúdo inicial
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});