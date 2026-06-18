package br.com.mvctransportes.core.service;

import br.com.mvctransportes.core.model.Rota;
import br.com.mvctransportes.core.repository.RotaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RotaService {

    private final RotaRepository rotaRepository;

    public Rota salvar(Rota rota) {
        return rotaRepository.save(rota);
    }

    public List<Rota> listarTodas() {
        return rotaRepository.findAllByOrderByHorarioDesc();
    }

    public List<Rota> listarPorBot(String botId) {
        return rotaRepository.findByBotId(botId);
    }

    public List<Rota> listarUltimas24h() {
    return rotaRepository.findByHorarioAfterOrderByHorarioDesc(LocalDateTime.now().minusHours(24));
    }

    public long contarPorBotHoje(String botId) {
        return rotaRepository.countByBotIdAndHorarioAfter(
            botId, LocalDateTime.now().withHour(0).withMinute(0).withSecond(0)
        );
    }

    public void deletar(Long id) {
        rotaRepository.deleteById(id);
    }
}
