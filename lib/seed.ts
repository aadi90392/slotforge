import { db, uid, randomToken } from "./server";
export const sampleRooms = [
  {
    name: "The Sunroom",
    kind: "Meeting room",
    capacity: 6,
    image: "/images/sunroom.jpg",
    location: "First floor · East wing",
    amenities: "Natural light,Whiteboard,Fast Wi-Fi",
  },
  {
    name: "The Boardroom",
    kind: "Meeting room",
    capacity: 12,
    image: "/images/boardroom.jpg",
    location: "Second floor · North wing",
    amenities: "Display screen,Video calls,Whiteboard",
  },
  {
    name: "Focus Studio",
    kind: "Focus room",
    capacity: 2,
    image: "/images/studio.jpg",
    location: "First floor · Quiet zone",
    amenities: "Sound insulated,Fast Wi-Fi,Standing desk",
  },
  {
    name: "The Commons",
    kind: "Collaboration",
    capacity: 8,
    image: "/images/commons.jpg",
    location: "Ground floor · Garden side",
    amenities: "Lounge seating,Natural light,Fast Wi-Fi",
  },
];
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
  for (const r of sampleRooms)
    queries.push(
      db()
        .prepare(
          "INSERT INTO resources(id,workspace_id,name,kind,capacity,image,location,amenities,active) VALUES(?,?,?,?,?,?,?,?,1)",
        )
        .bind(
          uid(),
          id,
          r.name,
          r.kind,
          r.capacity,
          r.image,
          r.location,
          r.amenities,
        ),
    );
  await db().batch([...before, ...queries]);
  return id;
}
