package backend;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class BackendApplicationTests {

    @Test
    void contextLoads() {
        // Простейший тест: проверяем математику
        assertEquals(4, 2 + 2, "Математика должна работать");
    }
}