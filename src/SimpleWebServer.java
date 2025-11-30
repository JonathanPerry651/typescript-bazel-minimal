package src;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.OutputStream;
import java.io.File;
import java.nio.file.Files;
import java.net.InetSocketAddress;

public class SimpleWebServer {
    public static void main(String[] args) throws IOException {
        int port = 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // Serve files from the current directory (runfiles root)
        // We expect assets to be under src/
        server.createContext("/", new FileHandler("src"));

        server.setExecutor(null); // creates a default executor
        System.out.println("Serving HTTP on port " + port);
        server.start();
    }

    static class FileHandler implements HttpHandler {
        private final String rootDir;

        public FileHandler(String rootDir) {
            this.rootDir = rootDir;
        }

        @Override
        public void handle(HttpExchange t) throws IOException {
            String path = t.getRequestURI().getPath();
            if (path.equals("/")) {
                path = "/src/index.html";
            } else if (path.equals("/index.js")) {
                path = "/src/index.js";
            } else if (path.equals("/index.js.map")) {
                path = "/src/index.js.map";
            }

            File file = new File("." + path);
            if (file.exists() && !file.isDirectory()) {
                String contentType = "application/octet-stream";
                if (path.endsWith(".html")) {
                    contentType = "text/html";
                } else if (path.endsWith(".js")) {
                    contentType = "application/javascript";
                } else if (path.endsWith(".css")) {
                    contentType = "text/css";
                }
                t.getResponseHeaders().set("Content-Type", contentType);
                t.sendResponseHeaders(200, file.length());
                OutputStream os = t.getResponseBody();
                Files.copy(file.toPath(), os);
                os.close();
            } else {
                String response = "404 (Not Found)\n";
                t.sendResponseHeaders(404, response.length());
                OutputStream os = t.getResponseBody();
                os.write(response.getBytes());
                os.close();
            }
        }
    }
}
