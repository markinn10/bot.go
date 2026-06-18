package br.com.mvctransportes.core.service;

import br.com.mvctransportes.core.model.BotStatus;
import br.com.mvctransportes.core.repository.BotStatusRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BotStatusService {

    private final BotStatusRepository botStatusRepository;

    public BotStatus salvarOuAtualizar(String botId, BotStatus dados) {
        BotStatus bot = botStatusRepository.findById(botId)
            .orElse(new BotStatus());
        bot.setId(botId);

        if (dados.getStatus() != null)      bot.setStatus(dados.getStatus());
        if (dados.getNumero() != null)      bot.setNumero(dados.getNumero());
        if (dados.getLastAction() != null)  bot.setLastAction(dados.getLastAction());
        if (dados.getPerf() != null)        bot.setPerf(dados.getPerf());
        if (dados.getOnline() != null)      bot.setOnline(dados.getOnline());
        if (dados.getForceOnline() != null) bot.setForceOnline(dados.getForceOnline());

        return botStatusRepository.save(bot);
    }

    public Optional<BotStatus> buscarPorId(String botId) {
        return botStatusRepository.findById(botId);
    }

    public List<BotStatus> listarTodos() {
        return botStatusRepository.findAll();
    }

    public void deletar(String botId) {
        botStatusRepository.deleteById(botId);
    }
}