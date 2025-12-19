package services.jwtwrapper;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.apache.commons.cli.*;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.logging.Logger;

public class JwtWrapperServer {
    private static final Logger logger = Logger.getLogger(JwtWrapperServer.class.getName());
    private static final int PORT = 8082;
    // Default redirect if none provided (useful for dev)
    private static final String DEFAULT_REDIRECT_URL = "http://example.com/dest"; 

    private static java.security.interfaces.RSAPrivateKey privateKey;
    private static java.security.interfaces.RSAPublicKey publicKey;

    public static void main(String[] args) throws Exception {
        // 1. Parse Command Line Arguments
        Options options = new Options();
        Option privateKeyOpt = new Option("p", "private-key", true, "Path to PKCS#8 PEM Private Key");
        Option certOpt = new Option("c", "certificate", true, "Path to X.509 PEM Certificate");
        Option redirectUrlOpt = new Option("r", "redirect-url", true, "Target Redirect URL");

        options.addOption(privateKeyOpt);
        options.addOption(certOpt);
        options.addOption(redirectUrlOpt);

        CommandLineParser parser = new DefaultParser();
        CommandLine cmd;
        try {
            cmd = parser.parse(options, args);
        } catch (ParseException e) {
            System.err.println("Error parsing arguments: " + e.getMessage());
            new HelpFormatter().printHelp("JwtWrapperServer", options);
            System.exit(1);
            return;
        }

        String redirectUrl = cmd.getOptionValue(redirectUrlOpt, DEFAULT_REDIRECT_URL);
        String privPath = cmd.getOptionValue(privateKeyOpt);
        String certPath = cmd.getOptionValue(certOpt);

        // 2. Load Keys
        if (privPath != null && certPath != null) {
            logger.info("Loading keys from:\n  Private: " + privPath + "\n  Cert: " + certPath);
            loadKeysFromDisk(privPath, certPath);
        } else {
             logger.warning("No key paths provided. Generating temporary keys for demo.");
             generateKeys();
        }
        
        logger.info("Target Redirect URL: " + redirectUrl);

        // 3. Start Server
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/wrap-and-redirect", new WrapHandler(redirectUrl));
        server.setExecutor(null);
        server.start();
        logger.info("JWT Wrapper Server started on port " + PORT + " (using RS256)");
    }

    private static void loadKeysFromDisk(String privPath, String certPath) throws Exception {
        String privKeyContent = java.nio.file.Files.readString(java.nio.file.Paths.get(privPath));
        privKeyContent = privKeyContent
            .replaceAll("-----BEGIN PRIVATE KEY-----", "")
            .replaceAll("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
        
        byte[] privKeyBytes = java.util.Base64.getDecoder().decode(privKeyContent);
        java.security.KeyFactory kf = java.security.KeyFactory.getInstance("RSA");
        privateKey = (java.security.interfaces.RSAPrivateKey) kf.generatePrivate(
            new java.security.spec.PKCS8EncodedKeySpec(privKeyBytes)
        );

        try (java.io.InputStream in = java.nio.file.Files.newInputStream(java.nio.file.Paths.get(certPath))) {
            java.security.cert.CertificateFactory cf = java.security.cert.CertificateFactory.getInstance("X.509");
            java.security.cert.X509Certificate cert = (java.security.cert.X509Certificate) cf.generateCertificate(in);
            publicKey = (java.security.interfaces.RSAPublicKey) cert.getPublicKey();
        }
    }

    private static void generateKeys() throws java.security.NoSuchAlgorithmException {
        java.security.KeyPairGenerator kpg = java.security.KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
        java.security.KeyPair kp = kpg.generateKeyPair();
        publicKey = (java.security.interfaces.RSAPublicKey) kp.getPublic();
        privateKey = (java.security.interfaces.RSAPrivateKey) kp.getPrivate();
    }

    static class WrapHandler implements HttpHandler {
        private final String redirectUrl;

        public WrapHandler(String redirectUrl) {
            this.redirectUrl = redirectUrl;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            logger.info("Received request: " + exchange.getRequestMethod() + " " + exchange.getRequestURI());

            String authHeader = exchange.getRequestHeaders().getFirst("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                sendError(exchange, 401, "Missing or invalid Authorization header");
                return;
            }

            String originalToken = authHeader.substring(7);

            try {
                DecodedJWT decoded = JWT.decode(originalToken);
                logger.info("Decoded token subject: " + decoded.getSubject());

                Algorithm algorithm = Algorithm.RSA256(publicKey, privateKey);

                String newToken = JWT.create()
                        .withIssuer("jwt-wrapper-service")
                        .withClaim("original_token", originalToken)
                        .withClaim("extra_metadata", "signed-by-server-private-key")
                        .withClaim("original_sub", decoded.getSubject())
                        .withClaim("redirect_url", this.redirectUrl) // Claim name requested by user
                        .sign(algorithm);

                logger.info("Generated new wrapped token (RS256).");

                String target = this.redirectUrl + "?token=" + newToken;
                exchange.getResponseHeaders().set("Location", target);
                exchange.sendResponseHeaders(302, -1); 
                
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
