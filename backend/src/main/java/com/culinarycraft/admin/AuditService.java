package com.culinarycraft.admin;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {
    private final AuditRepository audit;
    public AuditService(AuditRepository audit) { this.audit = audit; }
    @Transactional public void record(long admin, AuditEvent.Action action, String type, long target, String details) {
        audit.save(new AuditEvent(admin, action, type, target, details));
    }
}
