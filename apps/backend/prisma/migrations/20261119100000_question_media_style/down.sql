-- Back to a release without media framing (SPECIFICATIONS-ROLLBACK §3): nothing to undo. The
-- column stays, which that release never reads; an upgrade again finds the framing there.
SELECT 1;
