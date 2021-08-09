interface ExternalUrlObject {
  spotify: string;
}

interface ContextObject {
  type: "artist" | "playlist" | "album" | "show" | "episode";
  href: string;
  "external_urls": ExternalUrlObject;
  uri: string;
}
interface ArtistObjectSimplified extends ContextObject {
  name: string;
  id: string;
  type: "artist";
}
interface TrackLinkObject {
  "external_urls": ExternalUrlObject;
  href: string;
  id: string;
  type: "track";
  uri: string;
}
interface RestrictionsObject {
  reason: string;
}
interface ImageObject {
  height?: number | undefined;
  url: string;
  width?: number | undefined;
}
interface AlbumObjectSimplified extends ContextObject {
  "album_group"?: "album" | "single" | "compilation" | "appears_on" | undefined;
  "album_type": "album" | "single" | "compilation";
  artists: ArtistObjectSimplified[];
  "available_markets"?: string[] | undefined;
  id: string;
  images: ImageObject[];
  name: string;
  "release_date": string;
  "release_date_precision": "year" | "month" | "day";
  restrictions?: RestrictionsObject | undefined;
  type: "album";
}
interface ExternalIdObject {
  isrc?: string | undefined;
  ean?: string | undefined;
  upc?: string | undefined;
}
export interface TrackObjectFull {
  artists: ArtistObjectSimplified[];
  "available_markets"?: string[] | undefined;
  "disc_number": number;
  "duration_ms": number;
  explicit: boolean;
  "external_urls": ExternalUrlObject;
  href: string;
  id: string;
  "is_playable"?: boolean | undefined;
  "linked_from"?: TrackLinkObject | undefined;
  restrictions?: RestrictionsObject | undefined;
  name: string;
  "preview_url": string | null;
  "track_number": number;
  type: "track";
  uri: string;
  album: AlbumObjectSimplified;
  "external_ids": ExternalIdObject;
  popularity: number;
  "is_local"?: boolean | undefined;
}
interface FollowersObject {
  href: null;
  total: number;
}
interface UserObjectPublic {
  "display_name"?: string | undefined;
  "external_urls": ExternalUrlObject;
  followers?: FollowersObject | undefined;
  href: string;
  id: string;
  images?: ImageObject[] | undefined;
  type: "user";
  uri: string;
}
interface PlaylistBaseObject extends ContextObject {
  collaborative: boolean;
  description: string | null;
  id: string;
  images: ImageObject[];
  name: string;
  owner: UserObjectPublic;
  public: boolean | null;
  "snapshot_id": string;
  type: "playlist";
}
interface PagingObject<T> {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}
interface PlaylistTrackObject {
  "added_at": string;
  "added_by": UserObjectPublic;
  "is_local": boolean;
  track: TrackObjectFull;
}
export interface PlaylistObjectFull extends PlaylistBaseObject {
  followers: FollowersObject;
  tracks: PagingObject<PlaylistTrackObject>;
}
