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

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class ForwardingHandler implements HttpHandler {

    private final String targetDomain; // e.g., "https://api.otherdomain.com"
    private final HttpClient httpClient;

    public ForwardingHandler(String targetDomain) {
        this.targetDomain = targetDomain;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        try {
            // 1. Construct the target URI (preserving path and query)
            String fullTargetUrl = targetDomain + exchange.getRequestURI().toString();
            
            // 2. Prepare the outgoing request
            HttpRequest.Builder rb = HttpRequest.newBuilder()
                    .uri(URI.create(fullTargetUrl))
                    .method(exchange.getRequestMethod(), 
                            HttpRequest.BodyPublishers.ofInputStream(() -> exchange.getRequestBody()));

            // 3. Copy Request Headers
            exchange.getRequestHeaders().forEach((key, values) -> {
                // Skip headers that might cause conflicts like 'Host' or 'Content-Length'
                if (!key.equalsIgnoreCase("Host") && !key.equalsIgnoreCase("Content-Length")) {
                    for (String value : values) {
                        rb.header(key, value);
                    }
                }
            });

            // 4. Execute the request
            HttpResponse<InputStream> response = httpClient.send(rb.build(), 
                    HttpResponse.BodyHandlers.ofInputStream());

            // 5. Copy Response Headers back to the client
            response.headers().map().forEach((key, values) -> {
                for (String value : values) {
                    exchange.getResponseHeaders().add(key, value);
                }
            });

            // 6. Send response status and body
            exchange.sendResponseHeaders(response.statusCode(), 0); // 0 = chunked transfer
            try (InputStream is = response.body(); OutputStream os = exchange.getResponseBody()) {
                is.transferTo(os);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            exchange.sendResponseHeaders(500, -1);
        } catch (Exception e) {
            e.printStackTrace();
            exchange.sendResponseHeaders(502, -1); // Bad Gateway
        } finally {
            exchange.close();
        }
    }
}

