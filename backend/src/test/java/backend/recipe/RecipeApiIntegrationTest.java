package backend.recipe;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RecipeApiIntegrationTest {

    @Value("${local.server.port}")
    private int port;

    private final HttpClient client = HttpClient.newHttpClient();

    @Test
    void listEndpointRespondsWithRecipes() throws IOException, InterruptedException {
        HttpResponse<String> response = request("/api/recipes?query=%D1%81%D1%8B%D1%80", "GET", null);
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("Сырники"));
        assertTrue(!response.body().contains("Паста с томатами"));
    }

    @Test
    void getMissingRecipeReturns404() throws IOException, InterruptedException {
        HttpResponse<String> response = request("/api/recipes/9999", "GET", null);
        assertEquals(404, response.statusCode());
        assertTrue(response.body().contains("error"));
    }

    @Test
    void postRecipeReturns201AndLocation() throws IOException, InterruptedException {
        HttpResponse<String> response = request("/api/recipes", "POST",
                "{\"title\":\"Блины\",\"category\":\"Завтрак\",\"minutes\":20}");
        assertEquals(201, response.statusCode());
        assertTrue(response.headers().firstValue("Location").orElse("").startsWith("/api/recipes/"));
        assertTrue(response.body().contains("Блины"));
    }

    @Test
    void postInvalidRecipeReturns400() throws IOException, InterruptedException {
        HttpResponse<String> response = request("/api/recipes", "POST",
                "{\"title\":\"\",\"category\":\"Завтрак\",\"minutes\":20}");
        assertEquals(400, response.statusCode());
        assertTrue(response.body().contains("error"));
    }

    private HttpResponse<String> request(String path, String method, String json)
            throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if ("POST".equals(method)) {
            builder.header("Content-Type", "application/json; charset=UTF-8")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));
        } else {
            builder.GET();
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }
}
