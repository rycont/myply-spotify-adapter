import { Song, Adaptor } from "myply-common"
import axios from "axios"
import { PlaylistObjectFull } from "./types";

const endpoints = {
  getTokenFromCode: `https://accounts.spotify.com/api/token`,
  trackSearch: (query: string) =>
    `https://api.spotify.com/v1/search?q=${query}&type=track`,
  getPlaylistContent: (id: string) =>
    `https://api.spotify.com/v1/playlists/${id}`,
};

export const getMasterAccountToken = async () => {
  const tokenInfo = await axios(endpoints.getTokenFromCode, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(
        process.env.CLIENT_ID + ":" + process.env.CLIENT_SECRET
      )
    },
    params: {
      grant_type: "refresh_token",
      refresh_token: process.env.MASTER_ACCOUNT_REFRESH_TOKEN || "",
    }
  })

  return { token: tokenInfo.data.access_token };
};

const nonLiteralCharacters = /[^가-힣-ㄱ-ㅎA-z0-9 ]/;

export const AppleMusic = {
  async getTempToken(): Promise<string> {
    const fetched = (await axios("https://music.apple.com/kr/search")).data
    const rawEnvironment = fetched.split(
      `name="desktop-music-app/config/environment"`,
    )[1].split(
      '">',
    )[0].slice(10);
    const env = JSON.parse(decodeURIComponent(rawEnvironment));
    return env.MEDIA_API.token;
  },

  async findSongInfo(song: Song): Promise<Song | null> {
    const token = await AppleMusic.getTempToken();

    const res = (await axios(
      `https://amp-api.music.apple.com/v1/catalog/kr/search?term=${encodeURIComponent(song.artist + " " + song.title)}&l=ko-kr&types=songs`,
      {
        headers: {
          Authorization: "Bearer " + token,
        }
      },
    )).data

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
        channelIds: {}
      });
    }
    const koreanInfoSong = res.results.songs.data[0];
    return {
      artist: koreanInfoSong.attributes.artistName,
      title: koreanInfoSong.attributes.name,
      channelIds: {
        ...song.channelIds,
        apple: koreanInfoSong.id,
      }
    };
  },
};

async function findSongId(song) {
  console.time("start");
  const { token: masterToken } = await getMasterAccountToken();

  const res = (await axios(
    endpoints.trackSearch(song.artist + " " + song.artist),
    {
      headers: {
        Authorization: "Bearer " + masterToken,
      }
    }
  )).data

  return res.tracks.items[0].uri;
}
async function generateURL(playlist) {
  const masterToken = await getMasterAccountToken();

  const { id: createdPlaylist, href: createdPlaylistUri } =
    (await axios(
      `https://api.spotify.com/v1/users/${process.env.MASTER_ACCOUNT_USER_ID}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + masterToken,
          "Content-Type": "application/json",
        },
        data: {
          name: playlist.title,
          description: playlist.description,
          public: true,
          collaborative: false,
        }
      },
    )).data

  await axios(
    `https://api.spotify.com/v1/playlists/${createdPlaylist}/tracks`,
    {
      headers: {
        Authorization: "Bearer " + masterToken,
        "Content-Type": "application/json",
      },
      data: {
        uris: playlist.tracks.map((e) => e.channelIds.spotify),
      },
    },
  );

  return createdPlaylistUri;
}
async function getPlaylistContent(playlistUri) {
  const masterToken = await getMasterAccountToken();

  const playlistId =
    playlistUri.split("/playlist/")[1].split("/")[0].split("?")[0];

  const playlist: PlaylistObjectFull =
    (await axios(endpoints.getPlaylistContent(playlistId), {
      headers: {
        Authorization: "Bearer " + masterToken,
      },
    })).data

  const koreanReplaced = await Promise.all(playlist.tracks.items.map(async ({ track }) => ({
    ...(await AppleMusic.findSongInfo({
      artist: track.artists.map(e => e.name).join(' '),
      title: track.name,
      channelIds: {
        spotify: track.id
      }
    }) || {}),
    channelIds: {
      spotify: track.uri,
    } as Record<string, string>,
  })));

  const filtered = koreanReplaced.filter((e): e is Song => e.title !== undefined)
  return filtered
}

export const SpotifyAdaptor: Adaptor = {
  determinator: ["spotify"],
  findSongId,
  generateURL,
  getPlaylistContent
};
