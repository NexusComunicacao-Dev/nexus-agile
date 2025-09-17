import { getDb } from "./mongodb";
import type { Project, Sprint, Story } from "./types";
import type { BoardItem, PokerSession, PokerVote } from "./types";

let indexesEnsured = false;

export async function collections() {
  const db = await getDb();
  const projects = db.collection("projects");
  const sprints = db.collection("sprints");
  const stories = db.collection("stories");
  const board = db.collection("board_items") as any as import("mongodb").Collection<BoardItem>;
  const pokerSessions = db.collection("poker_sessions") as any as import("mongodb").Collection<PokerSession>;
  const pokerVotes = db.collection("poker_votes") as any as import("mongodb").Collection<PokerVote>;

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
      board.createIndex({ projectId: 1, status: 1, order: 1 }),
      board.createIndex({ storyId: 1 }),
      pokerSessions.createIndex({ projectId: 1, status: 1, createdAt: -1 }),
      pokerSessions.createIndex({ storyId: 1 }),
      pokerVotes.createIndex({ sessionId: 1, userId: 1 }, { unique: true }),
    ]).catch(() => {});
    indexesEnsured = true;
  }
  return { db, projects, sprints, stories, board, pokerSessions, pokerVotes };
}

export function toId(v: any): string {
  // store as string ObjectId (adapter returns string ids in token.sub)
  return String(v);
}
