
export type PathCoordinate = {
  latitude: number;
  longitude: number;
  altitude: number;
};

export type Path = PathCoordinate[];

export type Paths = {sections: {mode: string, path: Path}[], all: Path};
