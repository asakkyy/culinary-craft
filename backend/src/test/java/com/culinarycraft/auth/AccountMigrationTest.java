package com.culinarycraft.auth;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class AccountMigrationTest {
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");
    @Test void upgradesExistingDatabaseWithoutChangingOwnershipOrGivingLegacyAccountsPasswords() {
        var source = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        Flyway.configure().dataSource(source).target("2").load().migrate();
        var jdbc = new JdbcTemplate(source);
        var owners = jdbc.queryForList("select id, owner_id from recipes order by id");
        var reviews = jdbc.queryForList("select id, recipe_id, author_id from reviews order by id");
        var favorites = jdbc.queryForList("select user_id, recipe_id from favorites order by id");
        Flyway.configure().dataSource(source).load().migrate();
        assertEquals(owners, jdbc.queryForList("select id, owner_id from recipes order by id"));
        assertEquals(reviews, jdbc.queryForList("select id, recipe_id, author_id from reviews order by id"));
        assertEquals(favorites, jdbc.queryForList("select user_id, recipe_id from favorites order by id"));
        assertEquals(3, jdbc.queryForObject("select count(*) from demo_users where status = 'LEGACY' and password_hash is null and email is null", Integer.class));
        assertEquals(1001L, jdbc.queryForObject("select nextval(pg_get_serial_sequence('demo_users','id'))", Long.class));
    }
}
