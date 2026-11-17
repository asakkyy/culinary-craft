package com.culinarycraft.auth;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Shared fixed windows survive failed logins, restarts and multiple application instances. */
@Service
public class AuthenticationLimits {
    private final JdbcTemplate jdbc;
    public AuthenticationLimits(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean allow(String scope, String identity, int maximum, int seconds) {
        final String bucket;
        try {
            bucket = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest((scope + ":" + identity).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
        jdbc.update("delete from authentication_limits where window_start < current_timestamp - interval '2 days'");
        int count = jdbc.queryForObject("""
            insert into authentication_limits(bucket, window_start, attempts) values (?, current_timestamp, 1)
            on conflict (bucket) do update set
              attempts = case when authentication_limits.window_start <= current_timestamp - (? * interval '1 second')
                then 1 else least(authentication_limits.attempts + 1, 1000000) end,
              window_start = case when authentication_limits.window_start <= current_timestamp - (? * interval '1 second')
                then current_timestamp else authentication_limits.window_start end
            returning attempts
            """, Integer.class, bucket, seconds, seconds);
        return count <= maximum;
    }
}
