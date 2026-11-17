package com.culinarycraft.service;

import com.culinarycraft.model.DemoUser;
import com.culinarycraft.persistence.DemoUserEntity;
import com.culinarycraft.persistence.DemoUserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class DemoUserService {
    private final DemoUserRepository users;

    public DemoUserService(DemoUserRepository users) { this.users = users; }

    public List<DemoUser> all() {
        return users.findAll(Sort.by("id")).stream().filter(user -> "LEGACY".equals(user.getStatus()))
            .map(DemoUserEntity::toModel).toList();
    }

    public DemoUser requireUser(Long id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Выберите демонстрационного пользователя");
        }
        return users.findById(id).map(DemoUserEntity::toModel)
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
        return users.findById(id).map(DemoUserEntity::toModel).orElse(null);
    }
}
