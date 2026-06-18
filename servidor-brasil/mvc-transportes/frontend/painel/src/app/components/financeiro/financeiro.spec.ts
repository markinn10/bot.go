import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinanceiroComponent } from './financeiro'; // Ajustado para FinanceiroComponent
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('FinanceiroComponent', () => {
  let component: FinanceiroComponent;
  let fixture: ComponentFixture<FinanceiroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Componentes Standalone entram no array de imports
      imports: [FinanceiroComponent],
      // Fornecendo as dependências de Rotas e HTTP para o componente financeiro
      providers: [
        provideRouter([]),
        provideHttpClient()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FinanceiroComponent);
    component = fixture.componentInstance;
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});