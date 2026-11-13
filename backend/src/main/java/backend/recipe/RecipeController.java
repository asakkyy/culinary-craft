package backend.recipe;

import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private final RecipeService service;

    public RecipeController(RecipeService service) {
        this.service = service;
    }

    @GetMapping
    public List<Recipe> list(@RequestParam(defaultValue = "") String query,
                             @RequestParam(defaultValue = "") String category) {
        return service.findAll(query, category);
    }

    @GetMapping("/{id}")
    public Recipe get(@PathVariable long id) {
        return service.findById(id);
    }

    @PostMapping
    public ResponseEntity<Recipe> create(@RequestBody CreateRecipeRequest request) {
        Recipe recipe = service.create(request);
        return ResponseEntity.created(URI.create("/api/recipes/" + recipe.id())).body(recipe);
    }
}
