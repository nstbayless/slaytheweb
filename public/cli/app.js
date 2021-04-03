// Game logic
import createNewGame from '../game/index.js'
import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode, isRoomCompleted} from '../game/utils.js'
import {createCard, getCardRewards} from './../game/cards.js'
import { dungeon_component } from './dungeon.js'
import {TUI}  from './tui.js'
import {$d, $middle_element, _, boxline, $pm, async_sleep} from './util.js'

export default class App {
    constructor(props) {
        const game = createNewGame()
        this.game = game
        this.quit = false
        this.tui = new TUI()
        this.tui.content_margin_top = 2
    }

    async loop() {
        let move = await this.tui.add_component(dungeon_component(this.tui, this.game))
        this.game.enqueue({type: 'move', move})
        while (true)
        {
            let action = await this.dequeue()
            await async_sleep(0)
            this.tui.end()
            console.log(action)
            process.exit(0)
        }
    }

    // updates the state and returns the associated action
    async dequeue() {
        while (true)
        {
            let v = this.game.dequeue()
            if (v)
            {
                return this.get_past_action();
            }
            else
            {
                // nothing in the queue, so wait until something is enqueued.
                await $pm({listen_once :this.game})()
            }
        }
    }

    // most recently dequeued action
    get_past_action() {
        return this.game.past.peek()
    }
}

let app = new App()

try
{
    app.loop()
}
catch (e)
{
    app.tui.end()
    console.error(e, e.stack);
    process.exit(1)
}