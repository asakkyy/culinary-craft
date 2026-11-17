package com.culinarycraft.admin;

import com.culinarycraft.PostgresIntegrationTest;
import com.culinarycraft.persistence.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class ConcurrentReportTest extends PostgresIntegrationTest {
    @Autowired AdministrationService service;
    @Autowired DemoUserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentBlocksCannotRemoveTheLastActiveAdministrator() throws Exception {
        String suffix = UUID.randomUUID().toString();
        long before = users.countByRoleAndStatus("ADMIN", "ACTIVE");
        var first = users.saveAndFlush(DemoUserEntity.account("First admin", "first" + suffix + "@test.invalid", passwords.encode("Test password 123"), "ADMIN"));
        var second = users.saveAndFlush(DemoUserEntity.account("Second admin", "second" + suffix + "@test.invalid", passwords.encode("Test password 123"), "ADMIN"));
        var executor = Executors.newFixedThreadPool(2); var start = new CountDownLatch(1);
        try {
            java.util.function.BiFunction<Long, Long, Callable<Integer>> block = (actor, target) -> () -> {
                start.await();
                try { service.block(actor, target, true, "Конкурентная блокировка"); return 200; }
                catch (ResponseStatusException error) { return error.getStatusCode().value(); }
            };
            var a = executor.submit(block.apply(first.getId(), second.getId()));
            var b = executor.submit(block.apply(second.getId(), first.getId())); start.countDown();
            assertEquals(List.of(200, 403), List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS)).stream().sorted().toList());
            assertEquals(before + 1, users.countByRoleAndStatus("ADMIN", "ACTIVE"));
        } finally {
            executor.shutdownNow(); assertTrue(executor.awaitTermination(20, TimeUnit.SECONDS));
            jdbc.update("delete from administrative_audit where admin_id in (?, ?)", first.getId(), second.getId());
            jdbc.update("delete from demo_users where id in (?, ?)", first.getId(), second.getId());
        }
    }
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void onlyOneAdministratorCanCommitADecision() throws Exception {
        String suffix = UUID.randomUUID().toString();
        long reporter = users.saveAndFlush(DemoUserEntity.account("Reporter", "r" + suffix + "@test.invalid", passwords.encode("Test password 123"), "USER")).getId();
        long admin1 = users.saveAndFlush(DemoUserEntity.account("Admin 1", "a" + suffix + "@test.invalid", passwords.encode("Test password 123"), "ADMIN")).getId();
        long admin2 = users.saveAndFlush(DemoUserEntity.account("Admin 2", "b" + suffix + "@test.invalid", passwords.encode("Test password 123"), "ADMIN")).getId();
        long report = service.report(reporter, 1, new AdministrationService.ReportInput(RecipeReport.Reason.OTHER, "Одновременное рассмотрение жалобы")).id();
        var executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            java.util.function.LongFunction<Callable<Integer>> decision = actor -> () -> {
                start.await();
                try { service.decide(actor, report, new AdministrationService.Decision(RecipeReport.Status.RESOLVED, "Рассмотрено")); return 200; }
                catch (ResponseStatusException error) { return error.getStatusCode().value(); }
            };
            var a = executor.submit(decision.apply(admin1)); var b = executor.submit(decision.apply(admin2));
            start.countDown();
            assertEquals(List.of(200, 409), List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS)).stream().sorted().toList());
        } finally {
            executor.shutdownNow(); assertTrue(executor.awaitTermination(20, TimeUnit.SECONDS));
            // Only rows created by this test in its Testcontainers database.
            jdbc.update("delete from administrative_audit where target_type = 'REPORT' and target_id = ?", report);
            jdbc.update("delete from recipe_reports where id = ?", report);
            jdbc.update("delete from demo_users where id in (?, ?, ?)", reporter, admin1, admin2);
        }
    }
}
