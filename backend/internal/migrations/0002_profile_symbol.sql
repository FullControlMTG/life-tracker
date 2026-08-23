-- Player symbols identify who dealt commander damage, so a saved player keeps
-- the symbol they play under. Empty means "no preference" - the seat keeps
-- whichever symbol it was assigned.
ALTER TABLE profiles ADD COLUMN symbol TEXT NOT NULL DEFAULT '';
