package com.rstglobal.shield.admin.dto;

import lombok.Data;

@Data
public class ContactSubmitRequest {
    private String name;
    private String email;
    private String phone;
    private String company;
    private String message;
    private String source;
}
