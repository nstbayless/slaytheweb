// Game logic
import createNewGame from '../game/index.js'
import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode, isRoomCompleted} from '../game/utils.js'
import {createCard, getCardRewards} from './../game/cards.js'
import { dungeon_component } from './dungeon.js'
import {TUI, Component}  from './tui.js'
import {$d, $middle_element, _, boxline, $pm, async_sleep, exit_with_message} from './util.js'
import { EncounterComponent } from './encounter.js'
import { CampfireComponent } from './campfire.js'

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
        while (true)
        {
            let action = null

            // ensures we are at the top of the event loop (prevents any accidental stack overflows)
            await async_sleep(0)

            // replace base component
            this.set_base_component()

            // enqueue action from base component
            if (this.base_component)
            {
                let next_action = await this.base_component.exec()

                if (next_action !== null)
                {
                    this.game.enqueue(next_action)
                }

                if (!this.game.future.empty())
                {
                    action = this.game.dequeue()
                }
            }
            else
            {
                throw "no base component could be constructed for the current state."
            }

            // we now have an action -- do something with it..?

            // render to reflect the updated state
            this.tui.mark_dirty()
        }
    }

    // sets base screen (combat, merchant, etc.)
    async set_base_component() {
        
        let new_component = this.create_base_component(this.base_component)
        if (new_component != this.base_component)
        {
            this.tui.remove_component(this.base_component)
            this.base_component = (new_component instanceof Component) ? new_component : new Component(new_component)
            this.tui.add_component(this.base_component)
        }
    }

    // this depends on the current room type (combat, merchant, etc.)
    create_base_component(previous) {
        let current_room_type = getCurrRoom(this.game.state).type
        if (isCurrentRoomCompleted(this.game.state))
        {
            if (previous && previous.name == "dungeon") return previous
            return dungeon_component(this.game)
        }
        if (current_room_type == "monster")
        {
            if (previous && previous.name == "encounter") return previous
            return new EncounterComponent(this.game)
        }
        else if (current_room_type == "campfire")
        {
            if (previous && previous.name == "campfire") return previous
            return new CampfireComponent(this.game)
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