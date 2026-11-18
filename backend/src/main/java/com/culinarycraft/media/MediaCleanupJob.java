package com.culinarycraft.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(name = "MEDIA_CLEANUP_ENABLED", havingValue = "true")
public class MediaCleanupJob {
    private final MediaCleanupService cleanup;
    private final boolean dryRun;
    public MediaCleanupJob(MediaCleanupService cleanup, @Value("${MEDIA_CLEANUP_DRY_RUN:true}") boolean dryRun) { this.cleanup = cleanup; this.dryRun = dryRun; }
    @Scheduled(fixedDelay = 3600000, initialDelay = 60000)
    public void run() {
        var report = cleanup.cleanup(dryRun);
        org.slf4j.LoggerFactory.getLogger(getClass()).info("Media maintenance dryRun={}, candidates={}, deleted={}, failed={}",
            dryRun, report.candidates().size(), report.deleted(), report.failed());
    }
}
