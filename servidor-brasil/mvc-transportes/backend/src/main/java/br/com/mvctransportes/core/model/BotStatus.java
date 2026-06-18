package br.com.mvctransportes.core.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "bot_status")
public class BotStatus {

    @Id
    private String id;

    private String status;
    private String numero;
    private String lastAction;
    private String perf;
    private Boolean online;
    private Boolean forceOnline;
    private LocalDateTime ultimaSincronizacao;

    @PrePersist
    @PreUpdate
    public void preUpdate() {
        this.ultimaSincronizacao = LocalDateTime.now();
    }
}
