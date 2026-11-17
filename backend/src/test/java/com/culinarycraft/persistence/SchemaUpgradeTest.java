package com.culinarycraft.persistence;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class SchemaUpgradeTest {
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");
    @Test void upgradePreservesExistingAccountsAndRecipeOwnership() {
        var source = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        Flyway.configure().dataSource(source).target("5").load().migrate();
        var jdbc = new JdbcTemplate(source);
        jdbc.update("insert into demo_users(name,role,initials,subtitle,email,password_hash,status,token_version) values "
            + "('Existing user','USER','EU','','existing@example.test','unusable-test-hash','ACTIVE',7),"
            + "('Existing admin','ADMIN','EA','','existing-admin@example.test','unusable-test-hash','ACTIVE',9)");
        int recipes = jdbc.queryForObject("select count(*) from recipes", Integer.class);
        Flyway.configure().dataSource(source).load().migrate();
        assertEquals(recipes, jdbc.queryForObject("select count(*) from recipes", Integer.class));
        assertEquals(3, jdbc.queryForObject("select count(*) from demo_users where status = 'LEGACY' and password_hash is null", Integer.class));
        assertEquals(7L, jdbc.queryForObject("select token_version from demo_users where email = 'existing@example.test'", Long.class));
        assertNull(jdbc.queryForObject("select email_verified_at from demo_users where email = 'existing@example.test'", Object.class));
        assertNotNull(jdbc.queryForObject("select email_verified_at from demo_users where email = 'existing-admin@example.test'", Object.class));
        assertEquals(0, jdbc.queryForObject("select count(*) from account_email_tokens", Integer.class));
        Flyway.configure().dataSource(source).load().validate();
    }
}
