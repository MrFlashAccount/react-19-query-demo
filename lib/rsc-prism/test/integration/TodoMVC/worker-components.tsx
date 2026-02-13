"use worker";

import { TodoComposer, TodoItemRow, TodoFooterControls } from "./client-components";
import type { TodoFilter, TodoRecord } from "./types";

export interface TodoWorkerViewProps {
  filter: TodoFilter;
  visibleTodos: TodoRecord[];
  totalCount: number;
  activeCount: number;
  completedCount: number;
  allCompleted: boolean;
}

export function TodoWorkerView({
  filter,
  visibleTodos,
  totalCount,
  activeCount,
  completedCount,
  allCompleted,
}: TodoWorkerViewProps) {
  return (
    <section className="todo-shell">
      <section className="todoapp">
        <h1 className="todo-title">todos</h1>

        <TodoComposer totalCount={totalCount} allCompleted={allCompleted} />

        <section className="todo-main">
          {visibleTodos.length === 0 ? (
            <p className="todo-empty">No todos for this filter.</p>
          ) : (
            <ul className="todo-list">
              {visibleTodos.map((todo) => (
                <TodoItemRow key={todo.id} todo={todo} />
              ))}
            </ul>
          )}
        </section>

        <TodoFooterControls
          totalCount={totalCount}
          activeCount={activeCount}
          completedCount={completedCount}
          filter={filter}
        />
      </section>
    </section>
  );
}
