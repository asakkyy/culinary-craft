package com.culinarycraft.media;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class MediaReferences {
    private final JdbcTemplate jdbc;
    public MediaReferences(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public void uploading() { jdbc.queryForObject("select pg_advisory_xact_lock_shared(61319488)", Object.class); }
    public void cleaning() { jdbc.queryForObject("select pg_advisory_xact_lock(61319488)", Object.class); }
    public boolean used(UUID id) {
        String url = "/api/media/" + id;
        return Boolean.TRUE.equals(jdbc.queryForObject("""
            select exists(select 1 from media_files where id = ?)
                or exists(select 1 from recipes where image_url = ?)
                or exists(select 1 from demo_users where avatar_url = ?)
            """, Boolean.class, id, url, url));
    }
}
