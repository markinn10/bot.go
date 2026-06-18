import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EsqueciSenhaComponent } from './esqueci-senha'; 
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

describe('EsqueciSenhaComponent', () => {
  let component: EsqueciSenhaComponent;
  let fixture: ComponentFixture<EsqueciSenhaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EsqueciSenhaComponent],
      providers: [provideRouter([]), provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(EsqueciSenhaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});