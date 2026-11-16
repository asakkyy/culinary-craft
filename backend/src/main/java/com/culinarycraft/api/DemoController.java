package com.culinarycraft.api;

import com.culinarycraft.model.DemoUser;
import com.culinarycraft.service.DemoUserService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class DemoController {
    private final DemoUserService users;
    public DemoController(DemoUserService users) { this.users = users; }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "storage", "IN_MEMORY", "mode", "PROTOTYPE");
    }

    @GetMapping("/users/demo")
    public List<DemoUser> demoUsers() { return users.all(); }
}
