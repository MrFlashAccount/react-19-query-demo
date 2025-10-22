# Query Provider - Usage Guide

Легковесная библиотека для кеширования промисов с автоматической сборкой мусора (garbage collection), основанная на подписках.

## Основные возможности

- ✅ **Кеширование промисов** по ключу
- ✅ **Автоматическая сборка мусора** (GC) после истечения времени
- ✅ **GC только когда нет активных подписок** - промис не удаляется, если компонент использует его
- ✅ **Автоматическое управление подписками** через `useQuery`
- ✅ **Расшаривание кеша** между несколькими компонентами
- ✅ **TypeScript** поддержка из коробки

## Установка

Компоненты находятся в `src/QueryProvider.tsx`. Используйте:

```typescript
import { QueryProvider, useQuery } from "./QueryProvider";
```

## Быстрый старт

### 1. Оберните приложение в QueryProvider

```tsx
import { QueryProvider } from "./QueryProvider";

function App() {
  return (
    <QueryProvider>
      <YourApp />
    </QueryProvider>
  );
}
```

### 2. Используйте useQuery для кеширования данных

```tsx
import { useQuery } from "./QueryProvider";
import { use, Suspense } from "react";

function UserProfile({ userId }: { userId: string }) {
  const promise = useQuery({
    key: ["user", userId],
    queryFn: () => fetchUser(userId),
    gcTime: 10000, // Кеш будет удален через 10 секунд после unmount
  });

  const user = use(promise);

  return <div>{user.name}</div>;
}

// Используйте с Suspense
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserProfile userId="123" />
    </Suspense>
  );
}
```

## API

### QueryProvider

Компонент-провайдер для управления кешем промисов.

```tsx
<QueryProvider>{children}</QueryProvider>
```

### useQuery

Хук для получения и кеширования данных.

```typescript
const promise = useQuery(options);
```

#### Options

```typescript
interface UseQueryOptions<Key, PromiseValue> {
  // Ключ кеша - массив любых значений
  key: Key;

  // Функция для получения данных
  queryFn: (key: Key) => Promise<PromiseValue>;

  // Время до удаления кеша (мс) после unmount. По умолчанию: Infinity
  gcTime?: number;
}
```

#### Возвращаемое значение

Возвращает `Promise<PromiseValue>`, который можно использовать с React `use()` хуком.

## Примеры использования

### Базовое использование

```tsx
function TodoList() {
  const promise = useQuery({
    key: ["todos"],
    queryFn: () => fetch("/api/todos").then((r) => r.json()),
    gcTime: 60000, // 1 минута
  });

  const todos = use(promise);

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

### Динамические ключи

```tsx
function UserPosts({ userId }: { userId: string }) {
  const promise = useQuery({
    key: ["posts", userId],
    queryFn: () => fetch(`/api/users/${userId}/posts`).then((r) => r.json()),
    gcTime: 30000,
  });

  const posts = use(promise);

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>{post.title}</article>
      ))}
    </div>
  );
}
```

### Сложные ключи с объектами

```tsx
function SearchResults({
  query,
  filters,
}: {
  query: string;
  filters: { category: string; minPrice: number };
}) {
  const promise = useQuery({
    key: ["search", query, filters],
    queryFn: () => searchProducts(query, filters),
    gcTime: 15000,
  });

  const results = use(promise);

  return <ProductGrid products={results} />;
}
```

### Без GC (бесконечное кеширование)

```tsx
function AppConfig() {
  const promise = useQuery({
    key: ["config"],
    queryFn: () => fetch("/api/config").then((r) => r.json()),
    // Нет gcTime - кеш никогда не удаляется
  });

  const config = use(promise);

  return <ConfigDisplay config={config} />;
}
```

### Немедленное удаление после unmount

```tsx
function SensitiveData() {
  const promise = useQuery({
    key: ["sensitive"],
    queryFn: () => fetchSensitiveData(),
    gcTime: 0, // Удалить немедленно после unmount
  });

  const data = use(promise);

  return <SecureDisplay data={data} />;
}
```

### Расшаривание кеша между компонентами

```tsx
// Оба компонента используют один и тот же кеш
function UserAvatar({ userId }: { userId: string }) {
  const promise = useQuery({
    key: ["user", userId], // Одинаковый ключ
    queryFn: () => fetchUser(userId),
    gcTime: 10000,
  });

  const user = use(promise);
  return <img src={user.avatar} />;
}

function UserName({ userId }: { userId: string }) {
  const promise = useQuery({
    key: ["user", userId], // Одинаковый ключ
    queryFn: () => fetchUser(userId),
    gcTime: 10000,
  });

  const user = use(promise);
  return <span>{user.name}</span>;
}

// fetchUser будет вызван только один раз!
function UserCard({ userId }: { userId: string }) {
  return (
    <div>
      <UserAvatar userId={userId} />
      <UserName userId={userId} />
    </div>
  );
}
```

## Поведение GC (Garbage Collection)

### Когда запускается GC таймер?

GC таймер запускается **только** когда:

1. У кеша установлен `gcTime` (не `undefined` и не `Infinity`)
2. Количество активных подписок = 0 (все компоненты размонтированы)

### Когда GC таймер отменяется?

GC таймер отменяется когда:

1. Новый компонент монтируется и подписывается на тот же ключ
2. Добавляется новая подписка

### Жизненный цикл кеша

```
1. Компонент монтируется
   → useQuery вызывается
   → Промис добавляется в кеш
   → Подписка создается (subscriptions = 1)
   → GC таймер НЕ запускается

2. Компонент размонтируется
   → Подписка удаляется (subscriptions = 0)
   → GC таймер ЗАПУСКАЕТСЯ

3. После истечения gcTime
   → Кеш удаляется (если subscriptions все еще = 0)

4. Если новый компонент монтируется до истечения gcTime
   → Подписка создается (subscriptions = 1)
   → GC таймер ОТМЕНЯЕТСЯ
   → Кеш остается
```

## Лучшие практики

### 1. Выбор правильного gcTime

- **Короткий (1-5 сек)**: Для часто меняющихся данных
- **Средний (10-60 сек)**: Для относительно стабильных данных
- **Длинный (5+ мин)** или **Infinity**: Для статических данных или конфигурации

### 2. Дизайн ключей

```typescript
// ✅ Хорошо - специфичный и описательный
key: ["user", userId];
key: ["posts", userId, { status: "published" }];

// ❌ Плохо - слишком общий
key: ["data"];
key: ["api"];
```

### 3. Используйте с Suspense

```tsx
<Suspense fallback={<Loading />}>
  <ComponentWithQuery />
</Suspense>
```

### 4. Error Handling

```tsx
import { ErrorBoundary } from "react-error-boundary";

<ErrorBoundary fallback={<Error />}>
  <Suspense fallback={<Loading />}>
    <ComponentWithQuery />
  </Suspense>
</ErrorBoundary>;
```

## Тестирование

Для запуска тестов:

```bash
npm run test
```

Подробнее см. [TEST_README.md](./TEST_README.md)

## TypeScript

Полная типизация из коробки:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

// Типы автоматически выводятся
const promise = useQuery({
  key: ["user", "123"],
  queryFn: (): Promise<User> => fetchUser("123"),
  gcTime: 10000,
});

// user имеет тип User
const user = use(promise);
```

## Сравнение с другими решениями

### vs TanStack Query (React Query)

**QueryProvider (наш)**:

- ✅ Легковесный (~200 строк кода)
- ✅ Использует React 19 `use()` hook
- ✅ GC на основе подписок
- ✅ Простой API
- ❌ Нет автоматического рефетча
- ❌ Нет оптимистичных обновлений
- ❌ Нет devtools

**TanStack Query**:

- ✅ Полнофункциональная библиотека
- ✅ Автоматический рефетч
- ✅ Оптимистичные обновления
- ✅ DevTools
- ❌ Больший размер
- ❌ Более сложный API

### Когда использовать наш QueryProvider?

- Простые приложения
- Прототипы
- Когда нужен только базовый кеш промисов
- Когда размер бандла критичен
- Когда используете React 19+

### Когда использовать TanStack Query?

- Сложные приложения
- Нужны автоматические рефетчи
- Нужны мутации и оптимистичные обновления
- Нужны DevTools для дебага

## Лицензия

MIT
