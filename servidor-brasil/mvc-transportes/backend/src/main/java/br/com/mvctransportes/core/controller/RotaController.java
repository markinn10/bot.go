// Source code is decompiled from a .class file using FernFlower decompiler (from Intellij IDEA).
package br.com.mvctransportes.core.controller;

import br.com.mvctransportes.core.model.Rota;
import br.com.mvctransportes.core.service.RotaService;
import java.util.List;
import lombok.Generated;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/rotas"})
@CrossOrigin(
   origins = {"*"}
)
public class RotaController {
   private final RotaService rotaService;

   @PostMapping
   public ResponseEntity<Rota> receberRota(@RequestBody Rota rota) {
      return ResponseEntity.ok(this.rotaService.salvar(rota));
   }

   @GetMapping
   public ResponseEntity<List<Rota>> listarTodas() {
      return ResponseEntity.ok(this.rotaService.listarTodas());
   }

   @GetMapping({"/24h"})
   public ResponseEntity<List<Rota>> listarUltimas24h() {
      return ResponseEntity.ok(this.rotaService.listarUltimas24h());
   }

   @GetMapping({"/bot/{botId}"})
   public ResponseEntity<List<Rota>> listarPorBot(@PathVariable String botId) {
      return ResponseEntity.ok(this.rotaService.listarPorBot(botId));
   }

   @GetMapping({"/bot/{botId}/hoje"})
   public ResponseEntity<Long> contarHoje(@PathVariable String botId) {
      return ResponseEntity.ok(this.rotaService.contarPorBotHoje(botId));
   }

   @DeleteMapping({"/{id}"})
   public ResponseEntity<Void> deletar(@PathVariable Long id) {
      this.rotaService.deletar(id);
      return ResponseEntity.noContent().build();
   }

   @Generated
   public RotaController(final RotaService rotaService) {
      this.rotaService = rotaService;
   }
}
