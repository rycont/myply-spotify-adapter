import { Song, Adaptor, Playlist } from "myply-common"
import axios from "axios"
import { PlaylistObjectFull } from "./types"

const endpoints = {
    getTokenFromCode: `https://accounts.spotify.com/api/token`,
    trackSearch: (query: string) =>
        `https://api.spotify.com/v1/search?q=${query}&type=track`,
    getPlaylistContent: (id: string) =>
        `https://api.spotify.com/v1/playlists/${id}`,
}

export const getMasterAccountToken = async () => {
    const tokenInfo = await axios(endpoints.getTokenFromCode, {
        method: "POST",
        headers: {
            Authorization:
                "Basic " +
                btoa(
                    process.env.SPOTIFY_CLIENT_ID +
                        ":" +
                        process.env.SPOTIFY_CLIENT_SECRET
                ),
        },
        params: {
            grant_type: "refresh_token",
            refresh_token:
                process.env.SPOTIFY_MASTER_ACCOUNT_REFRESH_TOKEN || "",
        },
    })

    return { token: tokenInfo.data.access_token as string }
}

const nonLiteralCharacters = /[^가-힣-ㄱ-ㅎA-z0-9 ]/

let appleTokenCache: string | undefined

export const AppleMusic = {
    async getTempToken(): Promise<string> {
        if (appleTokenCache) return appleTokenCache
        const fetched = (await axios("https://music.apple.com/kr/search")).data
        const rawEnvironment = fetched
            .split(`name="desktop-music-app/config/environment"`)[1]
            .split('">')[0]
            .slice(10)
        const env = JSON.parse(decodeURIComponent(rawEnvironment))
        appleTokenCache = env.MEDIA_API.token
        setTimeout(() => (appleTokenCache = undefined), 1000 * 60)

        return appleTokenCache!
    },

    async findSongInfo(song: Song): Promise<Song | null> {
        const token = await AppleMusic.getTempToken()

        console.log("Fetching Apple Search")
        const res = (
            await axios(
                `https://amp-api.music.apple.com/v1/catalog/kr/search?term=${encodeURIComponent(
                    song.artist + " " + song.name
                )}&l=ko-kr&types=songs`,
                {
                    headers: {
                        Authorization: "Bearer " + token,
                    },
                }
            )
        ).data

        if (!res.results.songs) {
            if (!song.artist.match(nonLiteralCharacters)) return null

            return await AppleMusic.findSongInfo({
                artist: song.artist.replace(nonLiteralCharacters, ""),
                name: song.name
                    .replace(/\(.*?\)/, "")
                    .replace(nonLiteralCharacters, ""),
                channelIds: {},
            })
        }
        const koreanInfoSong = res.results.songs.data[0]
        console.log("matched!")
        return {
            artist: koreanInfoSong.attributes.artistName,
            name: koreanInfoSong.attributes.name,
            channelIds: {
                ...song.channelIds,
                apple: koreanInfoSong.id,
            },
        }
    },
}

async function findSongId(song: Song) {
    const { token: masterToken } = await getMasterAccountToken()

    const res = (
        await axios(
            endpoints.trackSearch(
                encodeURIComponent(song.artist + " " + song.name)
            ),
            {
                headers: {
                    Authorization: "Bearer " + masterToken,
                },
            }
        )
    ).data

    return res.tracks.items[0].uri
}
async function generateURL(playlist: Playlist) {
    const { token } = await getMasterAccountToken()

    console.log("Createing Playlist", token)
    try {
        const {
            id: createdPlaylist,
            external_urls: { spotify: createdPlaylistUri },
        } = (
            await axios(
                `https://api.spotify.com/v1/users/${process.env.SPOTIFY_MASTER_ACCOUNT_USER_ID}/playlists`,
                {
                    method: "POST",
                    headers: {
                        Authorization: "Bearer " + token,
                        "Content-Type": "application/json",
                    },
                    data: {
                        name: playlist.name,
                        description: playlist.description,
                        public: true,
                        collaborative: false,
                    },
                }
            )
        ).data

        console.log("Putting Tracks in", createdPlaylist)

        const res = await axios(
            `https://api.spotify.com/v1/playlists/${createdPlaylist}/tracks`,
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                },
                params: {
                    uris: playlist.tracks
                        .map((e) => e.channelIds.spotify)
                        .join(","),
                },
            }
        )

        return createdPlaylistUri
    } catch (e) {
        throw e
    }
}
async function getPlaylistContent(playlistUri: string): Promise<Playlist> {
    const masterToken = await getMasterAccountToken()

    const playlistId = playlistUri
        .split("/playlist/")[1]
        .split("/")[0]
        .split("?")[0]

    try {
        const playlist: PlaylistObjectFull = (
            await axios(endpoints.getPlaylistContent(playlistId), {
                headers: {
                    Authorization: "Bearer " + masterToken.token,
                },
            })
        ).data

        const koreanReplaced = await Promise.all(
            playlist.tracks.items.map(async ({ track }) => ({
                ...((await AppleMusic.findSongInfo({
                    artist: track.artists.map((e) => e.name).join(" "),
                    name: track.name,
                    channelIds: {
                        spotify: track.id,
                    },
                })) || {}),
                channelIds: {
                    spotify: track.uri,
                } as Record<string, string>,
            }))
        )

        const filtered = koreanReplaced.filter(
            (e): e is Song => e.name !== undefined
        )
        return {
            tracks: filtered,
            name: playlist.name,
            preGenerated: {
                spotify: playlistUri,
            },
        }
    } catch (e) {
        console.log(e)
        throw e
    }
}

export const SpotifyAdaptor: Adaptor = {
    determinator: ["spotify"],
    findSongId,
    generateURL,
    getPlaylistContent,
    display: {
        logo: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.9991 0.065918C8.98738 0.065918 0.0602417 8.99282 0.0602417 20.0045C0.0602417 31.0166 8.98738 39.9428 19.9991 39.9428C31.0119 39.9428 39.9381 31.0166 39.9381 20.0045C39.9381 8.99354 31.0119 0.0668703 19.9988 0.0668703L19.9991 0.065918ZM29.1429 28.8231C28.7857 29.4088 28.019 29.5945 27.4333 29.235C22.7519 26.3754 16.8586 25.7278 9.9181 27.3135C9.24929 27.4659 8.58262 27.0469 8.43024 26.3778C8.27715 25.7088 8.69453 25.0421 9.365 24.8897C16.9602 23.1538 23.4752 23.9016 28.731 27.1135C29.3167 27.4731 29.5024 28.2373 29.1429 28.8231ZM31.5833 23.3933C31.1333 24.1254 30.1762 24.3564 29.4452 23.9064C24.0857 20.6114 15.916 19.6573 9.57667 21.5816C8.75453 21.83 7.88619 21.3666 7.63667 20.5459C7.38905 19.7238 7.85262 18.8571 8.67334 18.6071C15.9145 16.41 24.9167 17.4743 31.0714 21.2564C31.8024 21.7064 32.0333 22.6635 31.5833 23.3935V23.3933ZM31.7929 17.74C25.3667 13.9231 14.7643 13.5721 8.62881 15.4343C7.64357 15.7331 6.60167 15.1769 6.3031 14.1916C6.00453 13.2059 6.56024 12.1647 7.54619 11.8652C14.5893 9.72711 26.2976 10.1402 33.6962 14.5323C34.5843 15.0583 34.8748 16.2028 34.3486 17.0878C33.8248 17.974 32.6771 18.2662 31.7938 17.74H31.7929Z" fill="white"/>
    </svg>
    `,
        color: "#1ED760",
        name: "스포티파이",
    },
}
