export type TodoFilter = "all" | "active" | "completed";

export interface TodoRecord {
  id: string;
  title: string;
  completed: boolean;
}
