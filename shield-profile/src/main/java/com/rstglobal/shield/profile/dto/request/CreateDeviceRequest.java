package com.rstglobal.shield.profile.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateDeviceRequest {
    @NotNull
    private UUID profileId;

    @NotBlank
    private String name;

    private String deviceType;   // PHONE | TABLET | LAPTOP | CONSOLE | TV
    private String macAddress;
    private String dnsMethod;    // DOH | WIREGUARD | DHCP
}
