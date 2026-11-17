package com.culinarycraft.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.mail.*;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.*;

@Component
@EnableAsync
public class AccountMailDelivery {
    private final JavaMailSender sender;
    private final String from;
    public AccountMailDelivery(JavaMailSender sender, @Value("${MAIL_FROM:culinary@localhost}") String from) {
        this.sender = sender; this.from = from;
    }
    @Bean("accountMailExecutor") java.util.concurrent.Executor executor() {
        var pool = new ThreadPoolTaskExecutor(); pool.setCorePoolSize(1); pool.setMaxPoolSize(2); pool.setQueueCapacity(100);
        pool.setThreadNamePrefix("account-mail-");
        pool.setRejectedExecutionHandler((task, executor) -> org.slf4j.LoggerFactory.getLogger(getClass()).warn("Account mail queue full; resend later"));
        return pool;
    }
    @Async("accountMailExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void send(AccountEmailService.Mail event) {
        try {
            var message = new SimpleMailMessage(); message.setFrom(from); message.setTo(event.recipient());
            message.setSubject(event.subject()); message.setText(event.text()); sender.send(message);
        } catch (MailException error) {
            // Never log recipient, mail body, token or provider response. Resend remains available.
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Account mail delivery failed; check SMTP connectivity");
        }
    }
}
