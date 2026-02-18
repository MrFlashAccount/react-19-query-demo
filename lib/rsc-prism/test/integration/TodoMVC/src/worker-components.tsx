"use worker";

import {
  TodoComposer,
  TodoItemRow as TodoItemRowClient,
  TodoFooterControls,
} from "./client-components";
import { buildTodoWorkerViewData } from "./todo-model";
import type { TodoFilter, TodoRecord } from "./types";

export interface TodoViewProps {
  filter: TodoFilter;
}

export async function TodoView({ filter }: TodoViewProps) {
  const { visibleTodos, totalCount, activeCount, completedCount, allCompleted } =
    await buildTodoWorkerViewData(filter);

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

async function TodoItemRow({ todo }: { todo: TodoRecord }) {
  return (
    <li className={`todo-row ${todo.completed ? "todo-row--completed" : ""}`}>
      <div className="todo-view">
        <TodoItemRowClient todo={todo} />
      </div>
    </li>
  );
}
