CREATE TRIGGER booking_created AFTER INSERT ON bookings BEGIN
 INSERT INTO audits(workspace_id,booking_id,actor_id,action,detail,created_at)
 VALUES(NEW.workspace_id,NEW.id,NEW.updated_by,'created',NEW.title || ' / ' || NEW.day || ' / ' || NEW.hour || ':00 IST',NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER booking_changed AFTER UPDATE OF status,day,hour ON bookings
WHEN NEW.status <> OLD.status OR NEW.day <> OLD.day OR NEW.hour <> OLD.hour
BEGIN
 INSERT INTO audits(workspace_id,booking_id,actor_id,action,detail,created_at)
 VALUES(NEW.workspace_id,NEW.id,NEW.updated_by,CASE WHEN NEW.day<>OLD.day OR NEW.hour<>OLD.hour THEN 'rescheduled' ELSE NEW.status END,NEW.title || ' / ' || NEW.day || ' / ' || NEW.hour || ':00 IST',NEW.updated_at);
END;
