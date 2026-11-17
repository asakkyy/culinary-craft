CREATE TABLE media_files (
    id UUID PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES demo_users(id),
    recipe_id BIGINT REFERENCES recipes(id),
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('AVATAR', 'RECIPE')),
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CHECK ((kind = 'AVATAR' AND recipe_id IS NULL) OR (kind = 'RECIPE' AND recipe_id IS NOT NULL))
);
CREATE UNIQUE INDEX media_avatar_owner_unique ON media_files(owner_id) WHERE kind = 'AVATAR';
CREATE UNIQUE INDEX media_recipe_cover_unique ON media_files(recipe_id) WHERE kind = 'RECIPE';
