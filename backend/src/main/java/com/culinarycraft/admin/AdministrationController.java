package com.culinarycraft.admin;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
public class AdministrationController {
    private final AdministrationService service;
    private final com.culinarycraft.service.RecipeService recipes;
    public AdministrationController(AdministrationService service, com.culinarycraft.service.RecipeService recipes) { this.service = service; this.recipes = recipes; }
    private long id(Jwt jwt) { return Long.parseLong(jwt.getSubject()); }
    @PostMapping("/api/recipes/{recipeId}/reports") @ResponseStatus(HttpStatus.CREATED)
    public RecipeReport.View report(@AuthenticationPrincipal Jwt jwt, @PathVariable long recipeId, @Valid @RequestBody AdministrationService.ReportInput input) {
        return service.report(id(jwt), recipeId, input);
    }
    @GetMapping("/api/reports") public PageView<RecipeReport.View> mine(@AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) { return service.mine(id(jwt), page, size); }
    @GetMapping("/api/reports/{reportId}") public RecipeReport.View mineOne(@AuthenticationPrincipal Jwt jwt, @PathVariable long reportId) {
        return service.mineOne(id(jwt), reportId);
    }
    @GetMapping("/api/admin/reports") public PageView<RecipeReport.View> queue(@AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) RecipeReport.Status status, @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return service.queue(id(jwt), status, search, page, size, sort);
    }
    @PostMapping("/api/admin/reports/{reportId}/decision") public RecipeReport.View decide(@AuthenticationPrincipal Jwt jwt,
        @PathVariable long reportId, @Valid @RequestBody AdministrationService.Decision input) { return service.decide(id(jwt), reportId, input); }
    @GetMapping("/api/admin/users") public PageView<AdministrationService.UserView> users(@AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "") String status, @RequestParam(defaultValue = "") String search,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
        @RequestParam(defaultValue = "") String role, @RequestParam(defaultValue = "registeredAt,desc") String sort) { return service.users(id(jwt), status, search, page, size, role, sort); }
    @PostMapping("/api/admin/recipes/{recipeId}/unpublish") public com.culinarycraft.model.RecipeView unpublish(@AuthenticationPrincipal Jwt jwt,
        @PathVariable long recipeId, @Valid @RequestBody AdministrationService.Block input) {
        return recipes.unpublish(recipeId, id(jwt), input.reason());
    }
    @PostMapping("/api/admin/users/{userId}/block") public AdministrationService.UserView block(@AuthenticationPrincipal Jwt jwt,
        @PathVariable long userId, @Valid @RequestBody AdministrationService.Block input) { return service.block(id(jwt), userId, true, input.reason().strip()); }
    @PostMapping("/api/admin/users/{userId}/unblock") public AdministrationService.UserView unblock(@AuthenticationPrincipal Jwt jwt, @PathVariable long userId) {
        return service.block(id(jwt), userId, false, "");
    }
    @GetMapping("/api/admin/audit") public PageView<AuditEvent.View> audit(@AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) AuditEvent.Action action, @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) { return service.audit(id(jwt), action, page, size); }
}
