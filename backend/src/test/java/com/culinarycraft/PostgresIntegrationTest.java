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
    @org.springframework.beans.factory.annotation.Autowired org.springframework.jdbc.core.JdbcTemplate limitJdbc;
    @org.springframework.beans.factory.annotation.Autowired org.springframework.transaction.PlatformTransactionManager limitTransactions;
    @org.junit.jupiter.api.BeforeEach void isolateRateLimitState() {
        var tx = new org.springframework.transaction.support.TransactionTemplate(limitTransactions);
        tx.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.executeWithoutResult(status -> limitJdbc.update("delete from authentication_limits"));
    }
    @TestConfiguration(proxyBeanMethods = false)
    public static class Database {
        @Bean
        @ServiceConnection
        PostgreSQLContainer<?> postgres() {
            return new PostgreSQLContainer<>("postgres:17-alpine");
        }
    }
}
