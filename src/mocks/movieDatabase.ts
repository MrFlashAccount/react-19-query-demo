import type { Movie } from "../types/movie";

/**
 * Mock movie database for demo purposes
 */
export const MOVIE_DATABASE: Movie[] = [
  {
    id: 1,
    title: "The Shawshank Redemption",
    year: 1994,
    director: "Frank Darabont",
    genre: "Drama",
    rating: 9.3,
    image:
      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&h=600&fit=crop",
    tags: ["Prison", "Hope", "Friendship", "Classic"],
  },
  {
    id: 2,
    title: "The Godfather",
    year: 1972,
    director: "Francis Ford Coppola",
    genre: "Crime",
    rating: 9.2,
    image:
      "https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400&h=600&fit=crop",
    tags: ["Mafia", "Family", "Classic", "Epic"],
  },
  {
    id: 3,
    title: "The Dark Knight",
    year: 2008,
    director: "Christopher Nolan",
    genre: "Action",
    rating: 9.0,
    image:
      "https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop",
    tags: ["Superhero", "Thriller", "Batman", "Iconic"],
  },
  {
    id: 4,
    title: "Pulp Fiction",
    year: 1994,
    director: "Quentin Tarantino",
    genre: "Crime",
    rating: 8.9,
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=600&fit=crop",
    tags: ["Cult Classic", "Nonlinear", "Violence", "Stylish"],
  },
  {
    id: 5,
    title: "Forrest Gump",
    year: 1994,
    director: "Robert Zemeckis",
    genre: "Drama",
    rating: 8.8,
    image:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop",
    tags: ["Inspirational", "Romance", "Historical", "Heartwarming"],
  },
  {
    id: 6,
    title: "Inception",
    year: 2010,
    director: "Christopher Nolan",
    genre: "Sci-Fi",
    rating: 8.8,
    image:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=600&fit=crop",
    tags: ["Dreams", "Mind-bending", "Heist", "Complex"],
  },
  {
    id: 7,
    title: "The Matrix",
    year: 1999,
    director: "Wachowski Brothers",
    genre: "Sci-Fi",
    rating: 8.7,
    image:
      "https://images.unsplash.com/photo-1535016120720-40c646be5580?w=400&h=600&fit=crop",
    tags: ["Cyberpunk", "Philosophy", "Action", "Revolutionary"],
  },
  {
    id: 8,
    title: "Goodfellas",
    year: 1990,
    director: "Martin Scorsese",
    genre: "Crime",
    rating: 8.7,
    image:
      "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&h=600&fit=crop",
    tags: ["Mafia", "Biography", "Gritty", "Masterpiece"],
  },
  {
    id: 9,
    title: "Interstellar",
    year: 2014,
    director: "Christopher Nolan",
    genre: "Sci-Fi",
    rating: 8.6,
    image:
      "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=600&fit=crop",
    tags: ["Space", "Time Travel", "Emotional", "Epic"],
  },
  {
    id: 10,
    title: "The Silence of the Lambs",
    year: 1991,
    director: "Jonathan Demme",
    genre: "Thriller",
    rating: 8.6,
    image:
      "https://images.unsplash.com/photo-1516715094483-75da06924e3b?w=400&h=600&fit=crop",
    tags: ["Psychological", "Serial Killer", "Suspense", "Disturbing"],
  },
  {
    id: 11,
    title: "Fight Club",
    year: 1999,
    director: "David Fincher",
    genre: "Drama",
    rating: 8.8,
    image:
      "https://images.unsplash.com/photo-1571847140471-1d7766e825ea?w=400&h=600&fit=crop",
    tags: ["Twist", "Underground", "Philosophy", "Dark"],
  },
  {
    id: 12,
    title: "The Lord of the Rings",
    year: 2001,
    director: "Peter Jackson",
    genre: "Fantasy",
    rating: 8.9,
    image:
      "https://images.unsplash.com/photo-1518895312237-a9e23508077d?w=400&h=600&fit=crop",
    tags: ["Epic", "Adventure", "Fantasy", "Trilogy"],
  },
  {
    id: 13,
    title: "Parasite",
    year: 2019,
    director: "Bong Joon-ho",
    genre: "Thriller",
    rating: 8.5,
    image:
      "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400&h=600&fit=crop",
    tags: ["Social Commentary", "Dark Comedy", "Twist", "Oscar Winner"],
  },
  {
    id: 14,
    title: "The Prestige",
    year: 2006,
    director: "Christopher Nolan",
    genre: "Mystery",
    rating: 8.5,
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=600&fit=crop",
    tags: ["Magic", "Rivalry", "Twist", "Victorian"],
  },
  {
    id: 15,
    title: "Gladiator",
    year: 2000,
    director: "Ridley Scott",
    genre: "Action",
    rating: 8.5,
    image:
      "https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=400&h=600&fit=crop",
    tags: ["Rome", "Revenge", "Epic", "Historical"],
  },
  {
    id: 16,
    title: "The Departed",
    year: 2006,
    director: "Martin Scorsese",
    genre: "Crime",
    rating: 8.5,
    image:
      "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=600&fit=crop",
    tags: ["Undercover", "Boston", "Thriller", "Tense"],
  },
  {
    id: 17,
    title: "Whiplash",
    year: 2014,
    director: "Damien Chazelle",
    genre: "Drama",
    rating: 8.5,
    image:
      "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=600&fit=crop",
    tags: ["Music", "Intense", "Drumming", "Perfectionism"],
  },
  {
    id: 18,
    title: "The Pianist",
    year: 2002,
    director: "Roman Polanski",
    genre: "Drama",
    rating: 8.5,
    image:
      "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&h=600&fit=crop",
    tags: ["WWII", "Holocaust", "Survival", "Biography"],
  },
  {
    id: 19,
    title: "Django Unchained",
    year: 2012,
    director: "Quentin Tarantino",
    genre: "Western",
    rating: 8.4,
    image:
      "https://images.unsplash.com/photo-1533613220915-609f661a6fe1?w=400&h=600&fit=crop",
    tags: ["Western", "Revenge", "Slavery", "Action"],
  },
  {
    id: 20,
    title: "WALL-E",
    year: 2008,
    director: "Andrew Stanton",
    genre: "Animation",
    rating: 8.4,
    image:
      "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=400&h=600&fit=crop",
    tags: ["Pixar", "Romance", "Environment", "Heartwarming"],
  },
];
