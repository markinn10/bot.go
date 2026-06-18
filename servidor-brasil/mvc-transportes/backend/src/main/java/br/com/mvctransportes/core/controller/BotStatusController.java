package br.com.mvctransportes.core.controller;

import br.com.mvctransportes.core.model.BotStatus;
import br.com.mvctransportes.core.service.BotStatusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bots")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BotStatusController {

    private final BotStatusService botStatusService;

    @PutMapping("/{botId}")
    public ResponseEntity<BotStatus> atualizarStatus(
            @PathVariable String botId,
            @RequestBody BotStatus dados) {
        return ResponseEntity.ok(botStatusService.salvarOuAtualizar(botId, dados));
    }

    @GetMapping("/{botId}")
    public ResponseEntity<BotStatus> buscar(@PathVariable String botId) {
        return botStatusService.buscarPorId(botId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<BotStatus>> listarTodos() {
        return ResponseEntity.ok(botStatusService.listarTodos());
    }

    @PatchMapping("/{botId}/force")
    public ResponseEntity<BotStatus> forcarOnline(
            @PathVariable String botId,
            @RequestParam boolean ligar) {
        BotStatus dados = new BotStatus();
        dados.setForceOnline(ligar);
        return ResponseEntity.ok(botStatusService.salvarOuAtualizar(botId, dados));
    }

    @DeleteMapping("/{botId}")
    public ResponseEntity<Void> deletar(@PathVariable String botId) {
        botStatusService.deletar(botId);
        return ResponseEntity.noContent().build();
    }
}