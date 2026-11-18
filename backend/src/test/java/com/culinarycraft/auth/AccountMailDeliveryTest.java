package com.culinarycraft.auth;

import com.culinarycraft.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import static org.mockito.Mockito.*;

class AccountMailDeliveryTest extends PostgresIntegrationTest {
    @Autowired ApplicationEventPublisher events;
    @Autowired PlatformTransactionManager transactions;
    @Test void deliversOnlyAfterSuccessfulCommit() {
        var tx = new TransactionTemplate(transactions); tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.executeWithoutResult(status -> {
            events.publishEvent(new AccountEmailService.Mail("test@e2e.invalid", "Commit", "Synthetic message"));
            verifyNoInteractions(testMailSender);
        });
        verify(testMailSender, timeout(3000)).send(any(org.springframework.mail.SimpleMailMessage.class));
    }
    @Test void rollbackDoesNotSendMail() {
        var tx = new TransactionTemplate(transactions); tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.executeWithoutResult(status -> {
            events.publishEvent(new AccountEmailService.Mail("test@e2e.invalid", "Rollback", "Synthetic message"));
            status.setRollbackOnly();
        });
        verifyNoInteractions(testMailSender);
    }
}
