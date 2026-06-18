import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the logo text', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    
    // Forçamos a sidebar a aparecer para o teste validar o HTML
    app.mostrarSidebar = true; 
    fixture.detectChanges(); 

    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    
    // O uso do '?' evita erro caso o elemento não seja encontrado no ciclo de vida inicial
    const logoText = compiled.querySelector('.logo-text')?.textContent;
    expect(logoText).toContain('MVC Transportes');
  });
});