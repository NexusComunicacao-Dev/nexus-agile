export type Id = string;

export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "doing" | "done";

export type Project = {
  _id: Id;
  name: string;
  key: string;
  ownerId: Id;
  memberIds: Id[]; // includes ownerId
  createdAt: string;
};

export type Sprint = {
  _id: Id;
  projectId: Id;
  name: string;
  goal?: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "planned";
  createdBy: Id;
  createdAt: string;
  completedAt?: string;
};

export type Story = {
  _id: Id;
  projectId: Id;
  sprintId: Id;
  title: string;
  description?: string;
  assignees: string[];
  priority: Priority;
  points?: number;
  tags?: string[];
  status: Status;
  createdAt: string;
  history?: { status: Status; at: string }[];
};

export type BoardStatus = "backlog" | "todo" | "doing" | "done";
export interface BoardItem {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  status: BoardStatus;
  order: number; // ordenação dentro da coluna
  storyId?: string; // opcional: vínculo a uma story
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type PokerSessionStatus = "active" | "revealed" | "closed";
export interface PokerSession {
  _id: string;
  projectId: string;
  storyId?: string;
  ownerId: string;
  status: PokerSessionStatus;
  deck: (number | "?")[];
  createdAt: string;
  revealedAt?: string;
  consensusPoints?: number;
}
export interface PokerVote {
  _id: string;
  sessionId: string;
  userId: string;
  value: number | "?" | null; // null enquanto não votou
  createdAt: string;
  updatedAt?: string;
}
