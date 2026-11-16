package com.culinarycraft.service;

import com.culinarycraft.model.DemoUser;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DemoUserService {
    private final List<DemoUser> users = List.of(
        new DemoUser(1, "Анна Петрова", "USER", "АП", "Любитель домашней кухни"),
        new DemoUser(2, "Максим Еремин", "USER", "МЕ", "Автор рецептов"),
        new DemoUser(3, "Марина Волкова", "ADMIN", "МВ", "Модератор сообщества")
    );

    public List<DemoUser> all() { return users; }

    public DemoUser requireUser(Long id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Выберите демонстрационного пользователя");
        }
        return users.stream().filter(user -> user.id() == id).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неизвестный пользователь"));
    }

    public DemoUser requireAdmin(Long id) {
        DemoUser user = requireUser(id);
        if (!user.admin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Действие доступно только модератору");
        }
        return user;
    }

    public DemoUser optional(Long id) {
        if (id == null) return null;
        return users.stream().filter(u -> u.id() == id).findFirst().orElse(null);
    }
}
