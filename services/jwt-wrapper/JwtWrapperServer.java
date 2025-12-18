package services.jwtwrapper;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.logging.Logger;

public class JwtWrapperServer {
    private static final Logger logger = Logger.getLogger(JwtWrapperServer.class.getName());
    private static final int PORT = 8082;
    private static final String REDIRECT_URL = "http://example.com/dest"; // Default

    // For demo purposes, we generate a pair. In prod, load from Keystore/PEM.
    private static java.security.interfaces.RSAPrivateKey privateKey;
    private static java.security.interfaces.RSAPublicKey publicKey;

    public static void main(String[] args) throws Exception {
        // 0. Initialize Keys (Simulating loading valid x509 private key)
        generateKeys();

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/wrap-and-redirect", new WrapHandler());
        server.setExecutor(null);
        server.start();
        logger.info("JWT Wrapper Server started on port " + PORT + " (using RS256)");
    }

    private static void generateKeys() throws java.security.NoSuchAlgorithmException {
        java.security.KeyPairGenerator kpg = java.security.KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
        java.security.KeyPair kp = kpg.generateKeyPair();
        publicKey = (java.security.interfaces.RSAPublicKey) kp.getPublic();
        privateKey = (java.security.interfaces.RSAPrivateKey) kp.getPrivate();
    }

    static class WrapHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            logger.info("Received request: " + exchange.getRequestMethod() + " " + exchange.getRequestURI());

            // 1. Get Authorization Header
            String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                sendError(exchange, 401, "Missing or invalid Authorization header");
                return;
            }

            String originalToken = authHeader.substring(7);

            try {
                // 2. Decode original token (verify if we had the key, but here just decode)
                DecodedJWT decoded = JWT.decode(originalToken);
                logger.info("Decoded token subject: " + decoded.getSubject());

                // 3. Wrap in new JWT using RS256 (Asymmetric)
                // We sign with our Private Key. The recipient verifies with our Public Key (from x509).
                Algorithm algorithm = Algorithm.RSA256(publicKey, privateKey);

                String newToken = JWT.create()
                        .withIssuer("jwt-wrapper-service")
                        .withClaim("original_token", originalToken)
                        .withClaim("extra_metadata", "signed-by-server-private-key")
                        .withClaim("original_sub", decoded.getSubject())
                        .sign(algorithm);

                logger.info("Generated new wrapped token (RS256).");

                // 4. Redirect
                String target = REDIRECT_URL + "?token=" + newToken;
                exchange.getResponseHeaders().set("Location", target);
                exchange.sendResponseHeaders(302, -1); // 302 Found, no body
                
            } catch (Exception e) {
                logger.severe("Error processing token: " + e.getMessage());
                sendError(exchange, 400, "Invalid Token: " + e.getMessage());
            }
        }

        private void sendError(HttpExchange exchange, int code, String message) throws IOException {
            exchange.sendResponseHeaders(code, message.length());
            OutputStream os = exchange.getResponseBody();
            os.write(message.getBytes());
            os.close();
        }
    }
}
