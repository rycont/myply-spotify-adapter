import dotenv from "dotenv"
import { AppleMusic, SpotifyAdaptor } from "."

dotenv.config()

SpotifyAdaptor?.findSongId?.({
    artist: "10CM",
    name: "서울의 잠 못 이루는 밤 (Feat. 이수현)",
    channelIds: {},
}).then((e) => {
    console.log(e)
    console.timeEnd("start")
})

AppleMusic.findSongInfo({
    artist: "10cm, 이수현",
    name: "Sleepless in Seoul (Feat. LEE SUHYEON)",
    channelIds: {},
}).then(console.log)
