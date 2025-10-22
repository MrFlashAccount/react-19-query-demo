/**
 * Movie entity interface
 */
export interface Movie {
  id: number;
  title: string;
  year: number;
  director: string;
  genre: string;
  rating: number;
  image: string;
  tags: string[];
}
