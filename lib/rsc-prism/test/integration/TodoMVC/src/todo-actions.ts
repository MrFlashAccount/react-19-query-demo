import {
  addTodoItem,
  clearCompletedTodos,
  deleteTodoItem,
  renameTodoItem,
  toggleAllTodos,
  toggleTodoItem,
} from "./todo-model";

export async function addTodo(title: string) {
  "use worker";
  await addTodoItem(title);
}

export async function toggleTodo(id: string) {
  "use worker";
  await toggleTodoItem(id);
}

export async function renameTodo(id: string, title: string) {
  "use worker";
  await renameTodoItem(id, title);
}

export async function deleteTodo(id: string) {
  "use worker";
  await deleteTodoItem(id);
}

export async function clearCompleted() {
  "use worker";
  await clearCompletedTodos();
}

export async function toggleAll() {
  "use worker";
  await toggleAllTodos();
}
