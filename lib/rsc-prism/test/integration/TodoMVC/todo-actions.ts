import {
  addTodoItem,
  clearCompletedTodos,
  deleteTodoItem,
  readMutationResult,
  renameTodoItem,
  toggleAllTodos,
  toggleTodoItem,
} from "./todo-model";

export async function addTodo(title: string) {
  "use worker";
  await addTodoItem(title);
  return readMutationResult();
}

export async function toggleTodo(id: string) {
  "use worker";
  await toggleTodoItem(id);
  return readMutationResult();
}

export async function renameTodo(id: string, title: string) {
  "use worker";
  await renameTodoItem(id, title);
  return readMutationResult();
}

export async function deleteTodo(id: string) {
  "use worker";
  await deleteTodoItem(id);
  return readMutationResult();
}

export async function clearCompleted() {
  "use worker";
  await clearCompletedTodos();
  return readMutationResult();
}

export async function toggleAll() {
  "use worker";
  await toggleAllTodos();
  return readMutationResult();
}
