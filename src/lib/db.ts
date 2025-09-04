import { getDb } from "./mongodb";
import type { Project, Sprint, Story } from "./types";

let indexesEnsured = false;

export async function collections() {
  const db = await getDb();
  const projects = db.collection("projects");
  const sprints = db.collection("sprints");
  const stories = db.collection("stories");

  if (!indexesEnsured) {
    await Promise.all([
      projects.createIndex({ ownerId: 1 }),
      projects.createIndex({ memberIds: 1 }),
      projects.createIndex({ key: 1 }, { unique: true }),
      sprints.createIndex({ projectId: 1 }),
      sprints.createIndex({ status: 1 }),
      stories.createIndex({ projectId: 1 }),
      stories.createIndex({ sprintId: 1 }),
      stories.createIndex({ status: 1 }),
    ]).catch(() => {});
    indexesEnsured = true;
  }
  return { db, projects, sprints, stories };
}

export function toId(v: any): string {
  // store as string ObjectId (adapter returns string ids in token.sub)
  return String(v);
}
