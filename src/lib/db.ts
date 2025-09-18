import { getDb } from "./mongodb";
import type { Project, Sprint, Story } from "./types";
import type { BoardItem, PokerSession, PokerVote } from "./types";

let indexesEnsured = false;

export async function collections() {
  const db = await getDb();
  const projects = db.collection("projects");
  const sprints = db.collection("sprints");
  const stories = db.collection("stories");
  const pokerSessions = db.collection("poker_sessions");
  const pokerVotes = db.collection("poker_votes");

  if (!indexesEnsured) {
    try {
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
      // Ajuste de índice de votos: remover antigo se existir
      const voteIndexes = await pokerVotes.indexes().catch(() => []);
      const legacy = voteIndexes.find((i: any) => i.name === "sessionId_1_userId_1");
      if (legacy) {
        await pokerVotes.dropIndex("sessionId_1_userId_1").catch(() => {});
      }
      await pokerSessions.createIndex({ projectId: 1, status: 1 }).catch(() => {});
      await pokerVotes.createIndex({ sessionId: 1, storyId: 1 }).catch(() => {});
      await pokerVotes.createIndex(
        { sessionId: 1, userId: 1, storyId: 1 },
        { unique: true }
      ).catch(() => {});
    } catch {
      // ignora falhas de índice
    }
    indexesEnsured = true;
  }
  return { db, projects, sprints, stories, pokerSessions, pokerVotes, boards: db.collection("boards") };
}

export function toId(v: any): string {
  // store as string ObjectId (adapter returns string ids in token.sub)
  return String(v);
}
