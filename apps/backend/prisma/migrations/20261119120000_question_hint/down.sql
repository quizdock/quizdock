-- Back to a release without hints (SPECIFICATIONS-ROLLBACK §3): nothing to undo. The column
-- stays, which that release never reads; an upgrade again finds the hints there.
SELECT 1;
