package com.culinarycraft.admin;

import com.culinarycraft.persistence.*;
import com.culinarycraft.service.RecipeService;
import jakarta.persistence.EntityManager;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class AdministrationService {
    public record ReportInput(@NotNull RecipeReport.Reason reason, @Size(max = 1000) String description) {}
    public record Decision(@NotNull RecipeReport.Status status, @NotBlank @Size(min = 3, max = 1000) String comment,
                           boolean unpublishRecipe) {
        public Decision(RecipeReport.Status status, String comment) { this(status, comment, false); }
    }
    public record Block(@NotBlank @Size(min = 3, max = 500) String reason) {}
    public record UserView(long id, String name, String email, String role, String status, Instant registeredAt, String blockReason, Instant blockedAt, String avatarUrl) {}
    private final DemoUserRepository users;
    private final RecipeRepository recipes;
    private final RecipeService recipeService;
    private final ReportRepository reports;
    private final AuditRepository audit;
    private final AuditService events;
    private final EntityManager entities;
    public AdministrationService(DemoUserRepository users, RecipeRepository recipes, RecipeService recipeService, ReportRepository reports,
                                 AuditRepository audit, AuditService events, EntityManager entities) {
        this.users = users; this.recipes = recipes; this.recipeService = recipeService; this.reports = reports;
        this.audit = audit; this.events = events; this.entities = entities;
    }
    private DemoUserEntity active(long id) {
        var user = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!"ACTIVE".equals(user.getStatus())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return user;
    }
    private void admin(long id) {
        if (!"ADMIN".equals(active(id).getRole())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
    private Pageable page(int page, int size, String field) {
        return PageRequest.of(Math.max(0, Math.min(1000000, page)), Math.max(1, Math.min(50, size)), Sort.by(Sort.Direction.DESC, field, "id"));
    }
    private Pageable sorted(int page, int size, String sort, Set<String> allowed) {
        String[] parts = sort.split(",");
        if (parts.length != 2 || !allowed.contains(parts[0]) || !Set.of("asc", "desc").contains(parts[1])) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестная сортировка");
        }
        return PageRequest.of(Math.max(0, Math.min(1000000, page)), Math.max(1, Math.min(50, size)),
            Sort.by(Sort.Direction.fromString(parts[1]), parts[0]).and(Sort.by(Sort.Direction.DESC, "id")));
    }
    private RecipeReport.View view(RecipeReport report, boolean admin) {
        String name = users.findById(report.getReporterId()).orElseThrow().toModel().name();
        return report.view(name, admin);
    }
    private PageView<RecipeReport.View> views(Page<RecipeReport> page, boolean administrator) {
        var names = users.findAllById(page.getContent().stream().map(RecipeReport::getReporterId).distinct().toList())
            .stream().collect(java.util.stream.Collectors.toMap(DemoUserEntity::getId, user -> user.toModel().name()));
        return PageView.of(page.map(report -> report.view(names.get(report.getReporterId()), administrator)));
    }
    public RecipeReport.View report(long actor, long recipeId, ReportInput input) {
        String description = input.description() == null ? "" : input.description().strip();
        if (!description.isEmpty() && description.length() < 10) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Опишите проблему подробнее или оставьте описание пустым");
        users.lockById(actor).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)); active(actor);
        var recipe = recipes.findById(recipeId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)).toModel();
        if (!"APPROVED".equals(recipe.status())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (reports.existsByReporterIdAndRecipeIdAndReasonAndStatusIn(actor, recipeId, input.reason(),
            List.of(RecipeReport.Status.OPEN, RecipeReport.Status.IN_REVIEW))) throw new ResponseStatusException(HttpStatus.CONFLICT, "Такая жалоба уже рассматривается");
        if (reports.countByReporterIdAndCreatedAtAfter(actor, Instant.now().minusSeconds(3600)) >= 5) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Не более 5 жалоб в час");
        }
        return view(reports.saveAndFlush(new RecipeReport(actor, recipeId, recipe.title(), input.reason(), description)), false);
    }
    @Transactional(readOnly = true) public PageView<RecipeReport.View> mine(long actor, int page, int size) {
        active(actor); return views(reports.findByReporterId(actor, page(page, size, "createdAt")), false);
    }
    @Transactional(readOnly = true) public RecipeReport.View mineOne(long actor, long id) {
        active(actor); var report = reports.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (report.getReporterId() != actor) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return view(report, false);
    }
    @Transactional(readOnly = true) public PageView<RecipeReport.View> queue(long actor, RecipeReport.Status status, String search, int page, int size) {
        return queue(actor, status, search, page, size, "createdAt,desc");
    }
    @Transactional(readOnly = true) public PageView<RecipeReport.View> queue(long actor, RecipeReport.Status status, String search, int page, int size, String sort) {
        admin(actor); return views(reports.search(status, "%" + search.strip().toLowerCase(Locale.ROOT) + "%",
            sorted(page, size, sort, Set.of("createdAt", "id", "status", "recipeTitle"))), true);
    }
    public RecipeReport.View decide(long actor, long id, Decision input) {
        admin(actor);
        String comment = input.comment().strip();
        if (comment.length() < 3) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Добавьте комментарий");
        if (input.unpublishRecipe() && input.status() != RecipeReport.Status.RESOLVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Снятие с публикации требует закрытия жалобы");
        }
        var report = reports.lock(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (report.getStatus() == RecipeReport.Status.RESOLVED || report.getStatus() == RecipeReport.Status.REJECTED
            || input.status() == RecipeReport.Status.OPEN || report.getStatus() == input.status()
            || (report.getModeratorId() != null && report.getModeratorId() != actor)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Жалоба уже рассмотрена или занята другим администратором");
        }
        if (input.unpublishRecipe()) recipeService.unpublish(report.getRecipeId(), actor, comment);
        report.decide(input.status(), actor, comment);
        events.record(actor, AuditEvent.Action.valueOf("REPORT_" + input.status()), "REPORT", id, "Status: " + input.status());
        return view(report, true);
    }
    private UserView userView(DemoUserEntity user) {
        return new UserView(user.getId(), user.toModel().name(), user.getEmail(), user.getRole(), user.getStatus(),
            user.getRegisteredAt(), user.getBlockReason(), user.getBlockedAt(), user.getAvatarUrl());
    }
    @Transactional(readOnly = true) public PageView<UserView> users(long actor, String status, String search, int page, int size) {
        return users(actor, status, search, page, size, "", "registeredAt,desc");
    }
    @Transactional(readOnly = true) public PageView<UserView> users(long actor, String status, String search, int page, int size, String role, String sort) {
        admin(actor);
        if (!status.isEmpty() && !Set.of("ACTIVE", "BLOCKED", "LEGACY").contains(status)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестный статус");
        if (!role.isEmpty() && !Set.of("USER", "ADMIN").contains(role)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестная роль");
        String term = "%" + search.strip().toLowerCase(Locale.ROOT) + "%";
        Specification<DemoUserEntity> spec = (root, query, cb) -> cb.and(
            status.isEmpty() ? cb.conjunction() : cb.equal(root.get("status"), status),
            role.isEmpty() ? cb.conjunction() : cb.equal(root.get("role"), role),
            cb.or(cb.like(cb.lower(root.get("name")), term), cb.like(cb.lower(root.get("email")), term)));
        return PageView.of(users.findAll(spec, sorted(page, size, sort, Set.of("name", "email", "registeredAt", "status", "role"))).map(this::userView));
    }
    public UserView block(long actor, long target, boolean blocked, String reason) {
        if (blocked && reason.strip().length() < 3) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите причину блокировки");
        // Same lock as bootstrap: serialize all changes affecting administrator availability.
        entities.createNativeQuery("select pg_advisory_xact_lock(91273561)").getSingleResult();
        admin(actor);
        var user = users.lockById(target).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (actor == target) throw new ResponseStatusException(HttpStatus.CONFLICT, "Нельзя заблокировать собственный аккаунт");
        if ("LEGACY".equals(user.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Legacy-аккаунт не поддерживает вход");
        if (blocked && "ADMIN".equals(user.getRole()) && "ACTIVE".equals(user.getStatus())
            && users.countByRoleAndStatus("ADMIN", "ACTIVE") <= 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "Нельзя заблокировать последнего администратора");
        String expected = blocked ? "ACTIVE" : "BLOCKED";
        if (!expected.equals(user.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Статус уже изменён");
        user.block(blocked, reason);
        events.record(actor, blocked ? AuditEvent.Action.USER_BLOCKED : AuditEvent.Action.USER_UNBLOCKED, "USER", target, blocked ? reason : "Access restored");
        return userView(user);
    }
    @Transactional(readOnly = true) public PageView<AuditEvent.View> audit(long actor, AuditEvent.Action action, int page, int size) {
        admin(actor);
        Specification<AuditEvent> spec = (root, query, cb) -> action == null ? cb.conjunction() : cb.equal(root.get("action"), action);
        var result = audit.findAll(spec, page(page, size, "createdAt"));
        var names = users.findAllById(result.stream().map(event -> event.view().adminId()).distinct().toList()).stream()
            .collect(java.util.stream.Collectors.toMap(DemoUserEntity::getId, user -> user.toModel().name()));
        return PageView.of(result.map(event -> event.view(names.get(event.view().adminId()))));
    }
}
