import { AppleMusic, SpotifyAdaptor } from "./index.ts";

SpotifyAdaptor?.findSongId?.({
    artist: "10CM",
    title: "서울의 잠 못 이루는 밤 (Feat. 이수현)",
    id: {}
}).then(e => {
    console.log(e)
    console.timeEnd('start')
})

AppleMusic.findSongInfo({
    artist: "10cm, 이수현",
    title: "Sleepless in Seoul (Feat. LEE SUHYEON)"
}).then(console.log)
