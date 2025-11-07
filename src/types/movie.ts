/**
 * Movie entity interface based on IMDb data structure
 */
export interface RawMovie {
  id: string;
  titleText: {
    text: string;
  };
  originalTitleText: {
    text: string;
  };
  titleType: {
    text: string;
  };
  releaseYear?: {
    year?: number;
  };
  releaseDate?: {
    day: number;
    month: number;
    year: number;
  };
  runtime?: {
    seconds: number;
  };
  ratingsSummary: {
    aggregateRating?: number;
    voteCount?: number;
  };
  genres: {
    genres: Array<{
      text: string;
      id: string;
    }>;
  };
  plot?: {
    plotText: {
      plainText: string;
    };
  };
  primaryImage?: {
    url: string;
    width: number;
    height: number;
  };
  metacritic?: {
    metascore: {
      score: number;
    };
  };
  principalCredits?: Array<{
    category: {
      text: string;
      id: string;
    };
    credits: Array<{
      name: {
        id: string;
        nameText: {
          text: string;
        };
        primaryImage?: {
          url: string;
        };
      };
    }>;
  }>;
}

export interface Movie {
  id: string;
  titleText: string;
  releaseYear: number;
  rating: number;
  genres: string[];
  plot: string;
  directors: string[];
  image: string;
}
