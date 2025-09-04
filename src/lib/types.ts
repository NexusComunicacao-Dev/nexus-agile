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
