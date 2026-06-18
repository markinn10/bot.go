package br.com.mvctransportes.core.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "rotas")
public class Rota {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String grupo;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String mensagem;

    @Column(nullable = false)
    private String regiao;

    @Column(nullable = false)
    private String botId;

    @Column(nullable = false)
    private String remetente;

    @Column(nullable = false)
    private LocalDateTime horario;

    @PrePersist
    public void prePersist() {
        this.horario = LocalDateTime.now();
    }
}
