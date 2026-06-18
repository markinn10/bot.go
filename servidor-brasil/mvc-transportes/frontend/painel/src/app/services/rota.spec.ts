import { TestBed } from '@angular/core/testing';
import { RotaService } from './rota'; 
import { provideHttpClient } from '@angular/common/http';

describe('RotaService', () => {
  let service: RotaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RotaService, provideHttpClient()]
    });
    service = TestBed.inject(RotaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
