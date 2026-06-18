import { TestBed } from '@angular/core/testing';
import { BotService } from './bot'; // Ajustado para BotService
import { provideHttpClient } from '@angular/common/http';

describe('BotService', () => {
  let service: BotService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BotService, provideHttpClient()]
    });
    service = TestBed.inject(BotService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});