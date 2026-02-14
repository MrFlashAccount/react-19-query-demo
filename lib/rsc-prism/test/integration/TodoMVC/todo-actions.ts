import {
  addTodoItem,
  clearCompletedTodos,
  deleteTodoItem,
  readMutationResult,
  renameTodoItem,
  toggleAllTodos,
  toggleTodoItem,
} from "./todo-model";

export function addTodo(title: string) {
  "use worker";
  addTodoItem(title);
  return readMutationResult();
}

export function toggleTodo(id: string) {
  "use worker";
  toggleTodoItem(id);
  return readMutationResult();
}

export function renameTodo(id: string, title: string) {
  "use worker";
  renameTodoItem(id, title);
  return readMutationResult();
}

export function deleteTodo(id: string) {
  "use worker";
  deleteTodoItem(id);
  return readMutationResult();
}

export function clearCompleted() {
  "use worker";
  clearCompletedTodos();
  return readMutationResult();
}

export function toggleAll() {
  "use worker";
  toggleAllTodos();
  return readMutationResult();
}
