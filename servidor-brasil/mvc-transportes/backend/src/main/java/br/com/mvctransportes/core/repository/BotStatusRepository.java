package br.com.mvctransportes.core.repository;

import br.com.mvctransportes.core.model.BotStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BotStatusRepository extends JpaRepository<BotStatus, String> {
}