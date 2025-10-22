# Query Provider с умной сборкой мусора

Легковесная библиотека для кеширования промисов с автоматической сборкой мусора (GC), основанной на подписках компонентов.

## 🎯 Ключевые особенности

- ✅ **Кеширование промисов** по ключу
- ✅ **Умная GC** - удаление кеша только когда нет активных подписок
- ✅ **Автоматическое управление подписками** через `useQuery`
- ✅ **Расшаривание кеша** между компонентами
- ✅ **TypeScript** поддержка из коробки
- ✅ **20 comprehensive тестов** с полным покрытием
- ✅ **Легковесность** - ~200 строк кода

## 🚀 Быстрый старт

### Установка

```bash
npm install
```

### Использование

```tsx
import { QueryProvider, useQuery } from "./QueryProvider";
import { use, Suspense } from "react";

function App() {
  return (
    <QueryProvider>
      <Suspense fallback="Loading...">
        <UserProfile userId="123" />
      </Suspense>
    </QueryProvider>
  );
}

function UserProfile({ userId }) {
  const promise = useQuery({
    key: ["user", userId],
    queryFn: () => fetch(`/api/users/${userId}`).then((r) => r.json()),
    gcTime: 5000, // Кеш удаляется через 5 сек после unmount
  });

  const user = use(promise);
  return <div>{user.name}</div>;
}
```

## 📖 Документация

- **[USAGE.md](./USAGE.md)** - Подробное руководство пользователя с примерами
- **[CHANGES.md](./CHANGES.md)** - Список всех изменений и миграция
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Технический обзор
- **[TEST_README.md](./TEST_README.md)** - Документация по тестам

## 🧪 Тестирование

Запуск тестов:

```bash
npm run test          # Запустить все тесты
npm run test:ui       # Запустить тесты с UI
```

**20 тестов** покрывают:

- ✅ Базовое кеширование (4 теста)
- ✅ Отслеживание подписок (3 теста)
- ✅ GC без активных подписок (3 теста)
- ✅ GC с активными подписками (3 теста)
- ✅ Интеграция useQuery (4 теста)
- ✅ Граничные случаи (3 теста)

## 🎨 API

### QueryProvider

```tsx
<QueryProvider>{children}</QueryProvider>
```

### useQuery

```typescript
const promise = useQuery({
  key: Array<unknown>, // Ключ кеша
  queryFn: (key) => Promise, // Функция получения данных
  gcTime: number, // Время до удаления (мс)
});
```

## 💡 Как работает GC

### Ключевой принцип

**GC таймер запускается ТОЛЬКО когда нет активных подписок!**

```
Component Mount
↓
Subscribe (subscriptions = 1)
↓
GC Timer CANCELLED ❌
↓
Component Unmount
↓
Unsubscribe (subscriptions = 0)
↓
GC Timer STARTED ✅
↓
After gcTime
↓
Cache Deleted 🗑️
```

### Пример

```tsx
// Компонент A монтируется
<UserProfile userId="123" />
// → subscriptions = 1
// → GC таймер НЕ запущен ❌

// Компонент B тоже использует те же данные
<UserName userId="123" />
// → subscriptions = 2
// → GC таймер НЕ запущен ❌

// Компонент A размонтируется
// → subscriptions = 1
// → GC таймер НЕ запущен ❌

// Компонент B размонтируется
// → subscriptions = 0
// → GC таймер ЗАПУЩЕН ✅

// Через gcTime миллисекунд
// → Кеш удален 🗑️
```

## 📦 Структура проекта

```
src/
├── QueryProvider.tsx      # Основная реализация ⭐
├── App.tsx                # Пример использования
├── App.test.tsx           # 20 тестов ✅
└── test/
    └── setup.ts           # Setup для тестов

vitest.config.ts           # Конфигурация Vitest
package.json               # Зависимости + скрипты
```

## 🎯 Примеры использования

### Расшаривание кеша

```tsx
// fetchUser вызовется только ОДИН раз!
function UserCard({ userId }) {
  return (
    <>
      <Avatar userId={userId} />
      <Name userId={userId} />
    </>
  );
}

function Avatar({ userId }) {
  const promise = useQuery({
    key: ["user", userId], // ← Одинаковый ключ
    queryFn: () => fetchUser(userId),
    gcTime: 5000,
  });
  const user = use(promise);
  return <img src={user.avatar} />;
}

function Name({ userId }) {
  const promise = useQuery({
    key: ["user", userId], // ← Одинаковый ключ
    queryFn: () => fetchUser(userId),
    gcTime: 5000,
  });
  const user = use(promise);
  return <span>{user.name}</span>;
}
```

### Разные стратегии кеширования

```tsx
// 🔄 Кратковременный (1 сек)
const live = useQuery({
  key: ["live"],
  queryFn: fetchLive,
  gcTime: 1000,
});

// ⏱️ Средний (30 сек)
const user = useQuery({
  key: ["user", id],
  queryFn: () => fetchUser(id),
  gcTime: 30000,
});

// ♾️ Бесконечный
const config = useQuery({
  key: ["config"],
  queryFn: fetchConfig,
  // gcTime не указан = бесконечный кеш
});

// ⚡ Немедленное удаление
const sensitive = useQuery({
  key: ["sensitive"],
  queryFn: fetchSensitive,
  gcTime: 0,
});
```

## 🆚 Сравнение

|                       | QueryProvider | TanStack Query |
| --------------------- | ------------- | -------------- |
| Размер                | ~200 строк    | ~50KB          |
| Кеширование           | ✅            | ✅             |
| GC на основе подписок | ✅            | ❌             |
| Автоматический рефетч | ❌            | ✅             |
| Мутации               | ❌            | ✅             |
| DevTools              | ❌            | ✅             |
| React 19 `use()`      | ✅            | ❌             |

## 🚦 Когда использовать?

### Используйте QueryProvider если:

- ✅ Простое приложение или прототип
- ✅ Нужен только базовый кеш промисов
- ✅ Размер бандла критичен
- ✅ Используете React 19+

### Используйте TanStack Query если:

- ✅ Сложное приложение
- ✅ Нужны автоматические рефетчи
- ✅ Нужны мутации и оптимистичные обновления
- ✅ Нужны DevTools

## 📝 Что было реализовано

1. ✅ Рефакторинг `addPromise` на объектные параметры
2. ✅ Рефакторинг `useQuery` на объектные параметры
3. ✅ Добавлена опция `gcTime`
4. ✅ Реализовано отслеживание подписок
5. ✅ GC запускается только без активных подписок
6. ✅ Автоматическая подписка/отписка в `useQuery`
7. ✅ 20 comprehensive тестов
8. ✅ Полная документация

## 🔧 Скрипты

```bash
npm run dev        # Запуск в dev режиме
npm run build      # Сборка для production
npm run test       # Запуск тестов
npm run test:ui    # Запуск тестов с UI
npm run lint       # Проверка кода
```

## 📚 Дополнительные ресурсы

- [Подробное руководство](./USAGE.md)
- [Технический обзор](./IMPLEMENTATION_SUMMARY.md)
- [Список изменений](./CHANGES.md)
- [Документация по тестам](./TEST_README.md)

## 📄 Лицензия

MIT

---

**Сделано с ❤️ для React 19+**
