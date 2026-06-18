// Source code is decompiled from a .class file using FernFlower decompiler (from Intellij IDEA).
package br.com.mvctransportes.core.repository;

import br.com.mvctransportes.core.model.Rota;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RotaRepository extends JpaRepository<Rota, Long> {
   List<Rota> findAllByOrderByHorarioDesc();

   List<Rota> findByBotId(String botId);

   List<Rota> findByHorarioAfterOrderByHorarioDesc(LocalDateTime horario);

   long countByBotIdAndHorarioAfter(String botId, LocalDateTime horario);
}
