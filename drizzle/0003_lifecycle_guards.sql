-- Custom SQL migration file, put your code below! --
CREATE TRIGGER booking_resource_guard BEFORE INSERT ON bookings BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM resources WHERE id=NEW.resource_id AND workspace_id=NEW.workspace_id AND active=1) THEN RAISE(ABORT,'inactive_resource') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM members WHERE workspace_id=NEW.workspace_id AND user_id=NEW.user_id) THEN RAISE(ABORT,'missing_membership') END;
END;
--> statement-breakpoint
CREATE TRIGGER booking_update_guard BEFORE UPDATE OF day,hour,status ON bookings
WHEN NEW.status IN ('held','confirmed') BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM resources WHERE id=NEW.resource_id AND workspace_id=NEW.workspace_id AND active=1) THEN RAISE(ABORT,'inactive_resource') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM members WHERE workspace_id=NEW.workspace_id AND user_id=NEW.user_id) THEN RAISE(ABORT,'missing_membership') END;
END;
--> statement-breakpoint
CREATE INDEX booking_user_history ON bookings(workspace_id,user_id,day,hour);
