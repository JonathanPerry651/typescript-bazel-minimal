package services.jwtwrapper;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpsServer;
import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsParameters;
import org.apache.commons.cli.*;
import io.netty.handler.codec.http.QueryStringDecoder;

import java.util.List;
import java.util.Map;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.logging.Logger;
import java.util.Base64;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

public class JwtWrapperServer {
    private static final Logger logger = Logger.getLogger(JwtWrapperServer.class.getName());
    private static final int PORT = 8082;
    // Default redirect if none provided (useful for dev)
    private static final String DEFAULT_REDIRECT_URL = "http://example.com/dest";

    private static ECPrivateKey privateKey;
    private static X509Certificate certificate;

    public static void main(String[] args) throws Exception {
        // 1. Parse Command Line Arguments
        Options options = new Options();
        Option privateKeyOpt = new Option("p", "private-key", true, "Path to PKCS#8 PEM Private Key");
        Option certOpt = new Option("c", "certificate", true, "Path to X.509 PEM Certificate");
        Option redirectUrlOpt = new Option("r", "redirect-url", true, "Target Redirect URL");
        Option httpsOpt = new Option("s", "https", false, "Enable HTTPS (requires private key and cert)");

        options.addOption(privateKeyOpt);
        options.addOption(certOpt);
        options.addOption(redirectUrlOpt);
        options.addOption(httpsOpt);

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
        boolean useHttps = cmd.hasOption(httpsOpt);

        // 2. Load Keys
        if (privPath != null && certPath != null) {
            logger.info("Loading keys from:\n  Private: " + privPath + "\n  Cert: " + certPath);
            loadKeysFromDisk(privPath, certPath);
        } else {
            logger.warning("No key paths provided. Generating temporary keys for demo.");
            if (useHttps) {
                logger.severe("HTTPS requires a certificate file. Please provide --private-key and --certificate.");
                System.exit(1);
            }
            generateKeys();
        }

        logger.info("Target Redirect URL: " + redirectUrl);

        // 3. Start Server
        HttpServer server;
        if (useHttps) {
            HttpsServer httpsServer = HttpsServer.create(new InetSocketAddress(PORT), 0);
            SSLContext sslContext = createSSLContext();
            httpsServer.setHttpsConfigurator(new HttpsConfigurator(sslContext) {
                public void configure(HttpsParameters params) {
                    try {
                        SSLContext context = getSSLContext();
                        javax.net.ssl.SSLEngine engine = context.createSSLEngine();
                        params.setNeedClientAuth(false);
                        params.setCipherSuites(engine.getEnabledCipherSuites());
                        params.setProtocols(engine.getEnabledProtocols());
                        params.setSSLParameters(context.getDefaultSSLParameters());
                    } catch (Exception ex) {
                        logger.severe("Failed to create HTTPS port");
                    }
                }
            });
            server = httpsServer;
            logger.info("JWT Bounce Server started on port " + PORT + " (HTTPS enabled)");
        } else {
            server = HttpServer.create(new InetSocketAddress(PORT), 0);
            logger.info("JWT Bounce Server started on port " + PORT + " (HTTP Only)");
        }

        server.createContext("/wrap-and-redirect", new WrapHandler(redirectUrl));
        server.setExecutor(null);
        server.start();
    }

    private static SSLContext createSSLContext() throws Exception {
        KeyStore ks = KeyStore.getInstance("PKCS12");
        ks.load(null, null); // Initialize empty keystore

        char[] password = "".toCharArray();
        ks.setKeyEntry("alias", privateKey, password, new java.security.cert.Certificate[] { certificate });

        KeyManagerFactory kmf = KeyManagerFactory.getInstance("SunX509");
        kmf.init(ks, password);

        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(kmf.getKeyManagers(), null, null);
        return sslContext;
    }

    private static void loadKeysFromDisk(String privPath, String certPath) throws Exception {
        String privKeyContent = Files.readString(Paths.get(privPath));
        privKeyContent = privKeyContent
                .replaceAll("-----BEGIN PRIVATE KEY-----", "")
                .replaceAll("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");

        byte[] privKeyBytes = Base64.getDecoder().decode(privKeyContent);
        KeyFactory kf = KeyFactory.getInstance("EC");
        privateKey = (ECPrivateKey) kf.generatePrivate(
                new PKCS8EncodedKeySpec(privKeyBytes));

        try (InputStream in = Files.newInputStream(Paths.get(certPath))) {
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            certificate = (X509Certificate) cf.generateCertificate(in);
        }
    }

    private static void generateKeys() throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
        kpg.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair kp = kpg.generateKeyPair();
        privateKey = (ECPrivateKey) kp.getPrivate();
    }

    static class WrapHandler implements HttpHandler {
        private final String redirectUrl;

        public WrapHandler(String redirectUrl) {
            this.redirectUrl = redirectUrl;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            QueryStringDecoder decoder = new QueryStringDecoder(exchange.getRequestURI());
            Map<String, java.util.List<String>> params = decoder.parameters();

            String targetRedirect = resolveTarget(params, this.redirectUrl);
            String body = generateRedirectHtml(targetRedirect);

            logger.info("Serving JS redirect to: " + targetRedirect);

            exchange.getResponseHeaders().set("Content-Type", "text/html");
            exchange.sendResponseHeaders(200, body.length());
            OutputStream os = exchange.getResponseBody();
            os.write(body.getBytes());
            os.close();
        }
    }

    // Visible for testing
    static String resolveTarget(Map<String, List<String>> params, String defaultUrl) {
        if (params.containsKey("redirect_url")) {
            List<String> values = params.get("redirect_url");
            if (values != null && !values.isEmpty()) {
                return values.get(0);
            }
        }
        if (params.containsKey("redirect")) {
            List<String> values = params.get("redirect");
            if (values != null && !values.isEmpty()) {
                return values.get(0);
            }
        }
        return defaultUrl;
    }

    // Visible for testing
    static String generateRedirectHtml(String targetRedirect) {
        // Simple JSON string escaping
        String safeTarget = targetRedirect
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("</script>", "<\\/script>"); // Prevent script injection break

        return "<html><body>" +
                "<script>" +
                "  var target = \"" + safeTarget + "\";" +
                "  if (window.location.hash) {" +
                "      target += window.location.hash;" +
                "  }" +
                "  window.location.replace(target);" +
                "</script>" +
                "Redirecting to " + safeTarget + "..." +
                "</body></html>";
    }
}
