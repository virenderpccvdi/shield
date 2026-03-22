package com.rstglobal.shield.admin.dto.response;

import java.util.List;

public record BulkOpResult(int succeeded, int failed, List<String> errors) {}
