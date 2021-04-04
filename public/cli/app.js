// Game logic
import createNewGame from '../game/index.js'
import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode, isRoomCompleted} from '../game/utils.js'
import {createCard, getCardRewards} from './../game/cards.js'
import { dungeon_component } from './dungeon.js'
import {TUI}  from './tui.js'
import {$d, $middle_element, _, boxline, $pm, async_sleep} from './util.js'
import { encounter_component } from './encounter.js'

export default class App {
    constructor(props) {
        const game = createNewGame()
        this.game = game
        this.quit = false
        this.tui = new TUI()
        this.tui.content_margin_top = 2
        this.base_component = null
    }

    async loop() {
        let move = await this.tui.add_component(dungeon_component(this.game))
        this.game.enqueue({type: 'move', move})
        while (true)
        {
            // apply the next action on the queue.
            let action = await this.dequeue()

            // ensures we are at the top of the event loop (prevents any accidental stack overflows)
            await async_sleep(0)

            // set the correct base component UI
            // (TODO: dungeon map should be considered one of these as well.)
            this.set_base_component()
        }
    }

    // sets base screen (combat, merchant, etc.)
    async set_base_component() {
        if (this.base_component)
        {
            this.tui.detach(this.base_component)
        }
        this.base_component = this.create_base_component()
        this.tui.add_component(this.base_component)
    }

    // this depends on the current room type (combat, merchant, etc.)
    create_base_component() {
        let current_room_type = getCurrRoom(this.game.state).type
        if (current_room_type == "monster")
        {
            return encounter_component(this.game)
        }
        else
        {
            this.tui.end()
            console.log(`unknown room type: ${current_room_type}`)
            exit(0)
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

console.log("starting...")

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