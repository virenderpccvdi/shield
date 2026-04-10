package com.rstglobal.shield.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Page;

import java.time.Instant;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final String message;
    private final String error;
    private final String path;
    private final String correlationId;

    @Builder.Default
    private final Instant timestamp = Instant.now();

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder().success(true).data(data).build();
    }

    public static <T> ApiResponse<T> ok(T data, String message) {
        return ApiResponse.<T>builder().success(true).data(data).message(message).build();
    }

    public static <T> ApiResponse<T> error(String error, String message) {
        return ApiResponse.<T>builder().success(false).error(error).message(message).build();
    }

    public static <T> ApiResponse<T> error(String error, String message, String path, String correlationId) {
        return ApiResponse.<T>builder()
                .success(false).error(error).message(message)
                .path(path).correlationId(correlationId).build();
    }

    /** Wrap a Spring Page into the standard paginated envelope. */
    public static <T> ApiResponse<PagedResponse<T>> page(Page<T> p) {
        return ok(PagedResponse.of(p));
    }
}
