package com.culinarycraft.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DemoUserRepository extends JpaRepository<DemoUserEntity, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<DemoUserEntity> {
    long countByRoleAndStatus(String role, String status);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from DemoUserEntity u where u.id = :id")
    java.util.Optional<DemoUserEntity> lockById(@org.springframework.data.repository.query.Param("id") long id);
    java.util.Optional<DemoUserEntity> findByEmailIgnoreCase(String email);
    boolean existsByRoleAndStatus(String role, String status);
}
