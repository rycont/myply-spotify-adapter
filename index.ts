import { config } from "https://deno.land/x/dotenv@v3.0.0/mod.ts";
import {
  Adaptor,
  Redirect,
  Song,
} from "https://raw.githubusercontent.com/rycont/myply-common/main/index.ts";
import "https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/master/types/spotify-api/index.d.ts";
import { PlaylistObjectFull } from "./types.ts";

config({
  export: true,
});

const endpoints = {
  getTokenFromCode: `https://accounts.spotify.com/api/token`,
  trackSearch: (query: string) =>
    `https://api.spotify.com/v1/search?q=${query}&type=track`,
  getPlaylistContent: (id: string) =>
    `https://api.spotify.com/v1/playlists/${id}`,
};

export const getMasterAccountToken = async () => {
  const headers = new Headers({
    "Authorization": "Basic " + btoa(
      Deno.env.get("CLIENT_ID") + ":" + Deno.env.get("CLIENT_SECRET"),
    ),
  });

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: Deno.env.get("MASTER_ACCOUNT_REFRESH_TOKEN") || "",
  });

  const tokenInfo = await (await fetch(endpoints.getTokenFromCode, {
    method: "POST",
    headers: headers,
    body: body,
  })).json();

  return { token: tokenInfo.access_token };
};

const nonLiteralCharacters = /[^가-힣-ㄱ-ㅎA-z0-9 ]/;

export const AppleMusic = {
  async getTempToken(): Promise<string> {
    const fetched = await (await fetch("https://music.apple.com/kr/search"))
      .text();
    const rawEnvironment = fetched.split(
      `name="desktop-music-app/config/environment"`,
    )[1].split(
      '">',
    )[0].slice(10);
    const env = JSON.parse(decodeURIComponent(rawEnvironment));
    return env.MEDIA_API.token;
  },

  async findSongInfo(song: Omit<Song, "id">): Promise<Omit<Song, "id"> | null> {
    const token = await AppleMusic.getTempToken();

    const headers = new Headers({
      Authorization: "Bearer " + token,
    });

    const res = await (await fetch(
      `https://amp-api.music.apple.com/v1/catalog/us/search?term=${song.artist} ${song.title}&l=ko-kr&types=songs`,
      { headers },
    )).json();
    if (!res.results.songs) {
      if (!song.artist.match(nonLiteralCharacters)) return null;
      console.log(
        song.title.replace(/\(.*?\)/, "").replace(nonLiteralCharacters, ""),
      );
      return await AppleMusic.findSongInfo({
        artist: song.artist.replace(nonLiteralCharacters, ""),
        title: song.title.replace(/\(.*?\)/, "").replace(
          nonLiteralCharacters,
          "",
        ),
      });
    }
    const koreanInfoSong = res.results.songs.data[0];
    return {
      artist: koreanInfoSong.attributes.artistName,
      title: koreanInfoSong.attributes.name,
    };
  },
};

export const SpotifyAdaptor: Adaptor = {
  async findSongId(song) {
    console.time("start");
    const { token: masterToken } = await getMasterAccountToken();
    const headers = new Headers({
      Authorization: "Bearer " + masterToken,
    });

    const res = await (await fetch(
      endpoints.trackSearch(song.artist + " " + song.artist),
      {
        headers,
      },
    )).json();

    return res.tracks.items[0].uri;
  },
  async generateURL(playlist) {
    const masterToken = await getMasterAccountToken();

    const headers = new Headers({
      Authorization: "Bearer " + masterToken,
      "Content-Type": "application/json",
    });

    const body = JSON.stringify({
      name: playlist.title,
      description: playlist.description,
      public: true,
      collaborative: false,
    });

    const { id: createdPlaylist, href: createdPlaylistUri } =
      await (await fetch(
        `https://api.spotify.com/v1/users/${
          Deno.env.get("MASTER_ACCOUNT_USER_ID")
        }/playlists`,
        {
          method: "POST",
          headers,
          body,
        },
      )).json();

    const playlistBody = JSON.stringify({
      uris: playlist.tracks.map((e) => e.id.spotify),
    });

    await fetch(
      `https://api.spotify.com/v1/playlists/${createdPlaylist}/tracks`,
      {
        headers,
        body: playlistBody,
      },
    );

    return createdPlaylistUri;
  },
  async getPlaylistContent(playlistUri) {
    const masterToken = await getMasterAccountToken();
    const headers = new Headers({
      Authorization: "Bearer " + masterToken,
    });

    const playlistId =
      playlistUri.split("/playlist/")[1].split("/")[0].split("?")[0];

    const playlist: PlaylistObjectFull =
      await (await fetch(endpoints.getPlaylistContent(playlistId), {
        headers,
      })).json();

    const koreanReplaced = await Promise.all(playlist.tracks.items.map(async ({ track }) => ({
      ...(await AppleMusic.findSongInfo({
        artist: track.artists.map(e => e.name).join(' '),
        title: track.name
      }) || {}),
      id: {
        spotify: track.uri,
      } as Record<string, string>,
    })));

    const filtered = koreanReplaced.filter((e): e is Song => e.title !== undefined)
    return filtered
  },
};
