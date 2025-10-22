# Design Update - Grid Layout with Images

## 🎨 Что изменилось

### 1. **Карточки фильмов - Grid Layout**

**До:**

- Широкие карточки в один столбец
- Только текстовая информация
- Один жанр badge

**После:**

- ✅ **Сетка 4 колонки** (responsive: 1/2/3/4 на разных экранах)
- ✅ **Изображения фильмов** (aspect ratio 2:3)
- ✅ **Несколько тегов** (до 3 отображаются)
- ✅ **Компактный дизайн** с вертикальной карточкой
- ✅ **Zoom эффект** на изображении при hover

### 2. **Расширенная база данных**

**До:** 10 фильмов

**После:** 20 фильмов с тегами:

- The Shawshank Redemption
- The Godfather
- The Dark Knight
- Pulp Fiction
- Forrest Gump
- Inception
- The Matrix
- Goodfellas
- Interstellar
- The Silence of the Lambs
- Fight Club ✨ NEW
- The Lord of the Rings ✨ NEW
- Parasite ✨ NEW
- The Prestige ✨ NEW
- Gladiator ✨ NEW
- The Departed ✨ NEW
- Whiplash ✨ NEW
- The Pianist ✨ NEW
- Django Unchained ✨ NEW
- WALL-E ✨ NEW

### 3. **Теги для каждого фильма**

Каждый фильм теперь имеет 4 тега:

```typescript
{
  title: "The Dark Knight",
  tags: ["Superhero", "Thriller", "Batman", "Iconic"]
}
```

Примеры тегов:

- **Жанровые**: Superhero, Mafia, Psychological
- **Настроение**: Dark, Emotional, Intense
- **Особенности**: Twist, Nonlinear, Epic
- **Темы**: Philosophy, Time Travel, Revenge

### 4. **Поиск по тегам**

```typescript
// Теперь ищет в: title, director, genre, AND tags
movie.tags.some((tag) => tag.toLowerCase().includes(searchTerm));
```

Попробуйте:

- `twist` → найдет фильмы с неожиданными поворотами
- `epic` → масштабные фильмы
- `dark` → мрачные фильмы
- `philosophy` → философские фильмы

## 📐 Layout структура

### Grid Layout

```tsx
// Responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
  {movies.map((movie) => (
    <MovieCard key={movie.id} movie={movie} />
  ))}
</div>
```

**Breakpoints:**

- Mobile (< 640px): 1 колонка
- Small (640px+): 2 колонки
- Large (1024px+): 3 колонки
- XLarge (1280px+): 4 колонки

### Card Structure

```
┌─────────────────┐
│                 │
│     IMAGE       │  ← aspect-[2/3], hover:scale-105
│   (2:3 ratio)   │
│                 │  ← Rating badge (top-right)
├─────────────────┤
│ Title           │  ← font-bold, line-clamp-2
│ Year • Director │  ← text-xs with icon
│ [Genre Badge]   │  ← bg-gray-100
│ Tag Tag Tag     │  ← First 3 tags
└─────────────────┘
```

## 🖼️ Изображения

### Источник

- Unsplash API (placeholder images)
- Format: `?w=400&h=600&fit=crop`
- Aspect ratio: 2:3 (movie poster proportions)

### Эффекты

```css
/* Zoom on hover */
.group:hover img {
  transform: scale(1.05);
  transition: transform 300ms;
}
```

## 🏷️ Теги

### Дизайн

```tsx
<span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 rounded border border-gray-200">
  {tag}
</span>
```

### Отображение

- Показываются первые 3 тега: `tags.slice(0, 3)`
- Flex wrap для адаптивности
- Минималистичный стиль с border

## 🎯 Размеры

### Карточки

- **Width**: Auto (grid controlled)
- **Max-width контейнера**: 6xl (1280px)
- **Gap между карточками**: 5 (1.25rem)
- **Padding внутри**: 4 (1rem)

### Input

- **Max-width**: xl (576px)
- **Centered**: mx-auto
- **Контейнер**: max-w-6xl (matching grid width)

## 🎨 Визуальные улучшения

### 1. Aspect Ratio для изображений

```tsx
<div className="relative aspect-[2/3] overflow-hidden">
```

Гарантирует одинаковую пропорцию для всех изображений

### 2. Line Clamp для заголовков

```tsx
<h3 className="line-clamp-2">
```

Обрезает длинные названия до 2 строк

### 3. Overflow для карточки

```tsx
<div className="overflow-hidden rounded-xl">
```

Изображение не выходит за границы при zoom

### 4. Flexbox для контента

```tsx
<div className="flex flex-col">
  {/* content */}
  <div className="mt-auto"> {/* Tags pushed to bottom */}
```

## 📱 Responsive Design

### Mobile (< 640px)

- 1 карточка в ряд
- Полная ширина
- Компактные размеры

### Tablet (640px - 1024px)

- 2-3 карточки в ряд
- Удобный просмотр
- Адаптивные отступы

### Desktop (1024px+)

- 3-4 карточки в ряд
- Максимальное использование экрана
- Профессиональный вид

## 🎭 Hover эффекты

### Карточка

```css
border: 2px gray-100 → black
shadow: none → lg
transition: 200ms
```

### Изображение

```css
scale: 1 → 1.05
transition: 300ms
```

### Заголовок

```css
color: black → gray-900;
```

## 🔍 Улучшенный поиск

### Поля поиска

1. Title - "Dark Knight"
2. Director - "Nolan"
3. Genre - "Sci-Fi"
4. Tags - "epic", "twist", "dark"

### Примеры поиска

```typescript
// По режиссеру
"nolan" → 4 фильма (Dark Knight, Inception, Interstellar, Prestige)

// По тегу
"epic" → 4 фильма (Godfather, Interstellar, LOTR, Gladiator)

// По настроению
"dark" → 2 фильма (Fight Club, Parasite)

// По теме
"revenge" → 2 фильма (Gladiator, Django)
```

## 📊 Производительность

### Images

- Lazy loading (browser native)
- Optimized size (400x600)
- Cached by browser

### Layout

- CSS Grid (GPU accelerated)
- Transform для zoom (GPU)
- Will-change не нужен (оптимизировано)

## 🎬 Кастомизация тегов

Каждый фильм тщательно подобран с тегами:

```typescript
// Пример: The Matrix
tags: [
  "Cyberpunk", // Жанр/стиль
  "Philosophy", // Тема
  "Action", // Особенность
  "Revolutionary", // Значение
];
```

## 💡 Best Practices

### 1. Consistent sizing

- Все изображения одного aspect ratio
- Единые отступы в карточках
- Стандартные gap размеры

### 2. Accessibility

- Alt text для изображений
- Semantic HTML
- Keyboard navigation ready

### 3. Performance

- Optimized images
- CSS Grid (faster than flexbox)
- Minimal re-renders

### 4. UX

- Clear visual hierarchy
- Consistent hover states
- Informative tags

## 🚀 Результат

**До:**

```
[Wide card 1                           ]
[Wide card 2                           ]
[Wide card 3                           ]
```

**После:**

```
[Img] [Img] [Img] [Img]
[Img] [Img] [Img] [Img]
[Img] [Img] [Img] [Img]
```

✅ Более современный вид
✅ Лучше использование пространства
✅ Больше фильмов на экране
✅ Визуально привлекательнее
✅ Профессиональный дизайн

---

**Приложение готово!** Откройте http://localhost:5174
