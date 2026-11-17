CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE recipes ADD COLUMN search_text TEXT NOT NULL DEFAULT '';

CREATE FUNCTION cc_recipe_document(p_id BIGINT, p_title TEXT, p_description TEXT) RETURNS TEXT
LANGUAGE sql AS $$
    SELECT lower(p_title || ' ' || p_description || ' ' || coalesce(
        (SELECT string_agg(value, ' ' ORDER BY position) FROM recipe_tags WHERE recipe_id = p_id), ''));
$$;
UPDATE recipes SET search_text = cc_recipe_document(id, title, description);

CREATE FUNCTION cc_recipe_document_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.search_text := cc_recipe_document(NEW.id, NEW.title, NEW.description);
    RETURN NEW;
END;
$$;
CREATE TRIGGER recipe_document_changed BEFORE INSERT OR UPDATE OF title, description ON recipes
FOR EACH ROW EXECUTE FUNCTION cc_recipe_document_changed();

CREATE FUNCTION cc_recipe_tags_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected BIGINT;
BEGIN
    IF TG_OP = 'DELETE' THEN affected := OLD.recipe_id; ELSE affected := NEW.recipe_id; END IF;
    UPDATE recipes SET search_text = cc_recipe_document(id, title, description) WHERE id = affected;
    IF TG_OP = 'UPDATE' THEN
        IF OLD.recipe_id <> NEW.recipe_id THEN
            UPDATE recipes SET search_text = cc_recipe_document(id, title, description) WHERE id = OLD.recipe_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;
CREATE TRIGGER recipe_tags_changed AFTER INSERT OR UPDATE OR DELETE ON recipe_tags
FOR EACH ROW EXECUTE FUNCTION cc_recipe_tags_changed();

CREATE INDEX recipes_search_trgm ON recipes USING gin(search_text gin_trgm_ops) WHERE status = 'APPROVED';
CREATE INDEX recipes_approved_newest ON recipes(created_at DESC, id DESC) WHERE status = 'APPROVED';
CREATE INDEX recipes_approved_quick ON recipes(prep_minutes, id DESC) WHERE status = 'APPROVED';
CREATE INDEX recipes_approved_category ON recipes(lower(category), created_at DESC, id DESC) WHERE status = 'APPROVED';
CREATE INDEX reviews_recipe_rating ON reviews(recipe_id, rating);
CREATE INDEX users_status_registered ON demo_users(status, registered_at DESC, id DESC);
CREATE INDEX users_registered ON demo_users(registered_at DESC, id DESC);
CREATE INDEX reports_created ON recipe_reports(created_at DESC, id DESC);
CREATE INDEX audit_created ON administrative_audit(created_at DESC, id DESC);
CREATE INDEX recipes_media_reference ON recipes USING hash(image_url);
CREATE INDEX users_avatar_reference ON demo_users USING hash(avatar_url);
