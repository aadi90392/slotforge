import { db, uid, randomToken } from "./server";
export async function createWorkspace(
  userId: string,
  name: string,
  before: D1PreparedStatement[] = [],
) {
  const id = uid();
  const queries = [
    db()
      .prepare(
        "INSERT INTO workspaces(id,name,owner_id,invite_code,timezone) VALUES(?,?,?,?,?)",
      )
      .bind(id, name, userId, randomToken(), "Asia/Kolkata"),
    db()
      .prepare(
        "INSERT INTO members(id,workspace_id,user_id,role) VALUES(?,?,?,?)",
      )
      .bind(uid(), id, userId, "owner"),
  ];
  await db().batch([...before, ...queries]);
  return id;
}
