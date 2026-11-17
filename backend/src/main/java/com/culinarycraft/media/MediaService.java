package com.culinarycraft.media;

import com.culinarycraft.auth.AccountView;
import com.culinarycraft.persistence.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class MediaService {
    public record MediaView(UUID id, String url) {}
    private final MediaRepository files;
    private final ImageStorage storage;
    private final DemoUserRepository users;
    private final RecipeRepository recipes;
    public MediaService(MediaRepository files, ImageStorage storage, DemoUserRepository users, RecipeRepository recipes) {
        this.files = files; this.storage = storage; this.users = users; this.recipes = recipes;
    }
    private DemoUserEntity account(long id) {
        var user = users.lockById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!"ACTIVE".equals(user.getStatus())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return user;
    }
    private void remove(List<MediaFile> old) {
        files.deleteAll(old); files.flush();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { old.forEach(file -> storage.delete(file.getId())); }
        });
    }
    private MediaFile store(MultipartFile upload, long owner, Long recipe, String kind) {
        var image = storage.write(upload);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) { if (status != STATUS_COMMITTED) storage.delete(image.id()); }
        });
        return files.saveAndFlush(new MediaFile(image.id(), owner, recipe, kind, image.bytes(), image.width(), image.height()));
    }
    public AccountView avatar(long userId, MultipartFile upload) {
        var user = account(userId);
        var old = files.findByOwnerIdAndKind(userId, "AVATAR");
        // Validate and write before touching the old reference.
        var image = storage.write(upload);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) { if (status != STATUS_COMMITTED) storage.delete(image.id()); }
        });
        remove(old);
        var file = files.saveAndFlush(new MediaFile(image.id(), userId, null, "AVATAR", image.bytes(), image.width(), image.height()));
        user.avatar(file.url()); return AccountView.of(user);
    }
    public void deleteAvatar(long userId) {
        var user = account(userId); remove(files.findByOwnerIdAndKind(userId, "AVATAR")); user.avatar(null);
    }
    private RecipeEntity ownRecipe(long id, long userId) {
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!"ACTIVE".equals(user.getStatus())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        var recipe = recipes.findForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (recipe.toModel().ownerId() != userId && !"ADMIN".equals(user.getRole())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return recipe;
    }
    public MediaView photo(long recipeId, long userId, MultipartFile upload) {
        var recipe = ownRecipe(recipeId, userId);
        var old = files.findByRecipeId(recipeId);
        // Removing metadata is transactional; its files remain until commit.
        remove(old);
        var file = store(upload, recipe.toModel().ownerId(), recipeId, "RECIPE");
        recipe.photo(file.url()); return new MediaView(file.getId(), file.url());
    }
    public void deletePhoto(long recipeId, long userId) {
        var recipe = ownRecipe(recipeId, userId); remove(files.findByRecipeId(recipeId)); recipe.photo("");
    }
    public void deleteForRecipe(long recipeId) { remove(files.findByRecipeId(recipeId)); }
    @Transactional(readOnly = true)
    public byte[] read(UUID id, Long userId) {
        var file = files.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (file.getRecipeId() != null) {
            var recipe = recipes.findById(file.getRecipeId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)).toModel();
            var user = userId == null ? null : users.findById(userId).orElse(null);
            if (!"APPROVED".equals(recipe.status()) && (user == null || (!"ADMIN".equals(user.getRole()) && recipe.ownerId() != userId))) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND);
            }
        }
        return storage.read(id);
    }
}
