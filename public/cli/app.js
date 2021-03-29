// Game logic
import createNewGame from '../game/index.js'
import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode} from '../game/utils.js'
import {createCard, getCardRewards} from './../game/cards.js'
import {TUI}  from './tui.js'

export default class App {
    constructor(props) {
        const game = createNewGame()
        this.game = game
        this.quit = false
        this.tui = new TUI()
    }

    async loop() {
        await this.tui.prompt({
            title: "test",
            content: "hello, world!"
        });
    }
}

let app = new App()

app.loop()