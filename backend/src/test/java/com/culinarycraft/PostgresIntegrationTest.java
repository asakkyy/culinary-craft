package com.culinarycraft;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;

/** Real PostgreSQL, production Flyway migrations, and rollback isolation for each test. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresIntegrationTest.Database.class)
@Transactional
public abstract class PostgresIntegrationTest {
    @TestConfiguration(proxyBeanMethods = false)
    public static class Database {
        @Bean
        @ServiceConnection
        PostgreSQLContainer<?> postgres() {
            return new PostgreSQLContainer<>("postgres:17-alpine");
        }
    }
}
