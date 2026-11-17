package com.culinarycraft.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DemoUserRepository extends JpaRepository<DemoUserEntity, Long> {
    java.util.Optional<DemoUserEntity> findByEmailIgnoreCase(String email);
    boolean existsByRoleAndStatus(String role, String status);
}
