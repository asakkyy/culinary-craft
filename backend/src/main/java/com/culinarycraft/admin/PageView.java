package com.culinarycraft.admin;

import java.util.List;
import org.springframework.data.domain.Page;

public record PageView<T>(List<T> content, long total, int page, int size, int totalPages) {
    public static <T> PageView<T> of(Page<T> page) {
        return new PageView<>(page.getContent(), page.getTotalElements(), page.getNumber(), page.getSize(), page.getTotalPages());
    }
}
