package com.rstglobal.shield.analytics.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class BulkLogIngestRequest {

    @NotEmpty(message = "logs list must not be empty")
    @Valid
    private List<LogIngestRequest> logs;
}
