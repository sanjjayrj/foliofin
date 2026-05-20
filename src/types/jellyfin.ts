export interface JellyfinUser {
  Id: string;
  Name: string;
  ServerId: string;
}

export interface JellyfinAuthResponse {
  User: JellyfinUser;
  AccessToken: string;
  ServerId: string;
}

export interface JellyfinUserData {
  PlaybackPositionTicks: number;
  PlayCount: number;
  IsFavorite: boolean;
  LastPlayedDate?: string;
  Played: boolean;
  Key: string;
}

export interface JellyfinMediaSource {
  Id: string;
  Path: string;
  Container: string;
  Size?: number;
  Name?: string;
}

export interface JellyfinPerson {
  Name: string;
  Type: string;
  Id?: string;
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  People?: JellyfinPerson[];
  ProductionYear?: number;
  ImageTags?: { Primary?: string; Backdrop?: string };
  BackdropImageTags?: string[];
  HasPrimaryImage: boolean;
  MediaSources?: JellyfinMediaSource[];
  UserData?: JellyfinUserData;
  RunTimeTicks?: number;
  Genres?: string[];
  Tags?: string[];
  SeriesName?: string;
  SeriesId?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  ProviderIds?: Record<string, string>;
  Path?: string;
}

export interface JellyfinLibrary {
  ItemId: string;
  Name: string;
  CollectionType?: string;
}

export interface JellyfinItemsResponse {
  Items: JellyfinItem[];
  TotalRecordCount: number;
  StartIndex: number;
}

export type BookFormat = 'epub' | 'pdf' | 'cbz' | 'cbr' | 'mobi' | 'unknown';

export interface BookProgress {
  itemId: string;
  cfi?: string;
  page?: number;
  percentage: number;
  updatedAt: number;
}

export type ReaderTheme = 'dark' | 'light' | 'sepia';
export type ReaderFont = 'serif' | 'sans' | 'mono';

export interface TocItem {
  id: string;
  href: string;
  label: string;
  subitems?: TocItem[];
}

export interface ReaderSettings {
  theme: ReaderTheme;
  fontSize: number;
  font: ReaderFont;
  lineHeight: number;
  margins: number;
}

export interface AppConfig {
  serverUrl: string;
  token: string;
  userId: string;
  userName: string;
  serverId: string;
}
