-- Back to a release where a slide has no picture of its own (SPECIFICATIONS-ROLLBACK §3):
-- nothing to undo. The columns stay, which that release never reads, and its slides are
-- written as before: the position has a default, the picture's key lets its media go.
SELECT 1;
