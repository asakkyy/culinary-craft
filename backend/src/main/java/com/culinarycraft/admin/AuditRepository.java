package com.culinarycraft.admin;

import org.springframework.data.jpa.repository.*;

public interface AuditRepository extends JpaRepository<AuditEvent, Long>, JpaSpecificationExecutor<AuditEvent> {}
