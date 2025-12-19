package experiments.midnightkiller;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.LocalTime;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

public class MidnightKiller {
    private static final Logger logger = Logger.getLogger(MidnightKiller.class.getName());

    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: bazel run //experiments/midnight-killer -- <TimeZoneID>");
            System.err.println("Example: bazel run //experiments/midnight-killer -- America/New_York");
            System.exit(1);
        }

        String zoneIdString = args[0];
        try {
            killAtNextMidnight(zoneIdString);
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    public static void killAtNextMidnight(String zoneIdString) {
        ZoneId zoneId = ZoneId.of(zoneIdString);
        ZonedDateTime now = ZonedDateTime.now(zoneId);
        
        // Get next midnight (00:00 of the next day)
        ZonedDateTime nextMidnight = now.toLocalDate().plusDays(1).atStartOfDay(zoneId);
        
        long delaySeconds = ChronoUnit.SECONDS.between(now, nextMidnight);
        
        logger.info("Current time in " + zoneId + ": " + now);
        logger.info("Next midnight in " + zoneId + ": " + nextMidnight);
        logger.info("Application will die in " + delaySeconds + " seconds (" + (delaySeconds / 3600.0) + " hours).");

        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        
        // Schedule death
        scheduler.schedule(() -> {
            System.err.println("\nIt is now midnight in " + zoneIdString + ". Goodbye world.");
            System.exit(0);
        }, delaySeconds, TimeUnit.SECONDS);

        // Keep main thread alive (or allow it to exit if other non-daemon threads exist, 
        // but explicit keep-alive is safer for a demo app)
        try {
             Thread.currentThread().join();
        } catch (InterruptedException e) {
             Thread.currentThread().interrupt();
        }
    }
}
