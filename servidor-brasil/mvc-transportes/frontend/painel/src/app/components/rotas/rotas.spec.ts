import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RotasComponent } from './rotas'; // Ajustado de Rotas para RotasComponent
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('RotasComponent', () => {
  let component: RotasComponent;
  let fixture: ComponentFixture<RotasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Componentes Standalone entram no array de imports
      imports: [RotasComponent],
      // Providers para evitar erro de injeção de dependência no componente de Rotas
      providers: [
        provideRouter([]),
        provideHttpClient()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RotasComponent);
    component = fixture.componentInstance;
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});