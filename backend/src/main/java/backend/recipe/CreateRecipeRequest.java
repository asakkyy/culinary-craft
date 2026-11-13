package backend.recipe;

public record CreateRecipeRequest(String title, String category, int minutes) {
}
