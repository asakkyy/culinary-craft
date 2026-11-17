package com.culinarycraft.admin;

import com.culinarycraft.persistence.*;
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
    public record ReportInput(@NotNull RecipeReport.Reason reason, @NotBlank @Size(min = 10, max = 1000) String description) {}
    public record Decision(@NotNull RecipeReport.Status status, @NotBlank @Size(min = 3, max = 1000) String comment) {}
    public record Block(@NotBlank @Size(min = 3, max = 500) String reason) {}
    public record UserView(long id, String name, String email, String role, String status, Instant registeredAt, String blockReason, Instant blockedAt) {}
    private final DemoUserRepository users;
    private final RecipeRepository recipes;
    private final ReportRepository reports;
    private final AuditRepository audit;
    private final AuditService events;
    private final EntityManager entities;
    public AdministrationService(DemoUserRepository users, RecipeRepository recipes, ReportRepository reports,
                                 AuditRepository audit, AuditService events, EntityManager entities) {
        this.users = users; this.recipes = recipes; this.reports = reports; this.audit = audit; this.events = events; this.entities = entities;
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
        if (input.description().strip().length() < 10) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Опишите проблему подробнее");
        users.lockById(actor).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)); active(actor);
        var recipe = recipes.findById(recipeId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)).toModel();
        if (!"APPROVED".equals(recipe.status())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (reports.existsByReporterIdAndRecipeIdAndReasonAndStatusIn(actor, recipeId, input.reason(),
            List.of(RecipeReport.Status.OPEN, RecipeReport.Status.IN_REVIEW))) throw new ResponseStatusException(HttpStatus.CONFLICT, "Такая жалоба уже рассматривается");
        if (reports.countByReporterIdAndCreatedAtAfter(actor, Instant.now().minusSeconds(3600)) >= 5) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Не более 5 жалоб в час");
        }
        return view(reports.saveAndFlush(new RecipeReport(actor, recipeId, recipe.title(), input.reason(), input.description().strip())), false);
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
        admin(actor); return views(reports.search(status, "%" + search.strip().toLowerCase(Locale.ROOT) + "%", page(page, size, "createdAt")), true);
    }
    public RecipeReport.View decide(long actor, long id, Decision input) {
        admin(actor);
        if (input.comment().strip().length() < 3) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Добавьте комментарий");
        var report = reports.lock(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (report.getStatus() == RecipeReport.Status.RESOLVED || report.getStatus() == RecipeReport.Status.REJECTED
            || input.status() == RecipeReport.Status.OPEN || report.getStatus() == input.status()
            || (report.getModeratorId() != null && report.getModeratorId() != actor)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Жалоба уже рассмотрена или занята другим администратором");
        }
        report.decide(input.status(), actor, input.comment().strip());
        events.record(actor, AuditEvent.Action.valueOf("REPORT_" + input.status()), "REPORT", id, "Status: " + input.status());
        return view(report, true);
    }
    private UserView userView(DemoUserEntity user) {
        return new UserView(user.getId(), user.toModel().name(), user.getEmail(), user.getRole(), user.getStatus(),
            user.getRegisteredAt(), user.getBlockReason(), user.getBlockedAt());
    }
    @Transactional(readOnly = true) public PageView<UserView> users(long actor, String status, String search, int page, int size) {
        admin(actor);
        if (!status.isEmpty() && !Set.of("ACTIVE", "BLOCKED", "LEGACY").contains(status)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестный статус");
        String term = "%" + search.strip().toLowerCase(Locale.ROOT) + "%";
        Specification<DemoUserEntity> spec = (root, query, cb) -> cb.and(
            status.isEmpty() ? cb.conjunction() : cb.equal(root.get("status"), status),
            cb.or(cb.like(cb.lower(root.get("name")), term), cb.like(cb.lower(root.get("email")), term)));
        return PageView.of(users.findAll(spec, page(page, size, "registeredAt")).map(this::userView));
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
        return PageView.of(audit.findAll(spec, page(page, size, "createdAt")).map(AuditEvent::view));
    }
}
