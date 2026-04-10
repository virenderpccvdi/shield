package com.rstglobal.shield.common.security;

import com.rstglobal.shield.common.exception.ShieldException;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Aspect
@Component
@Slf4j
public class SecurityAuditAspect {

    // Log security-relevant exceptions: auth failures, forbidden access, etc.
    @AfterThrowing(
        pointcut = "execution(* com.rstglobal.shield.*.service.*.*(..))",
        throwing = "ex"
    )
    public void logSecurityException(JoinPoint jp, ShieldException ex) {
        if (ex.getStatus() == HttpStatus.FORBIDDEN ||
            ex.getStatus() == HttpStatus.UNAUTHORIZED ||
            ex.getStatus() == HttpStatus.TOO_MANY_REQUESTS) {
            log.warn("[SECURITY_AUDIT] {} {} method={} args_count={}",
                ex.getStatus().value(),
                ex.getMessage(),
                jp.getSignature().toShortString(),
                jp.getArgs().length);
        }
    }
}
