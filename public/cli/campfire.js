import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode, isRoomCompleted, getMonsterById, getMonsterIntent, getAliveMonsters} from '../game/utils.js'
import {$d, $middle_element, _, boxline, blend_colors, wordWrapLines, $remove, exit_with_message} from './util.js'
import { TUI } from './tui.js'
import { globals, g } from './constants.js'
import { RegionComponent, SELECTABLE_AND_DEFAULT, Region } from './regioncomponent.js'

export class CampfireComponent extends RegionComponent
{
    constructor(game)
    {
        super(game)
        this.name = "encounter"
        this.info_tab_width = g.MIN_INFO_PANE_WIDTH
        this.display_info = null
    }

    refresh_regions(force=false)
    {
        this.remove_regions("options")

        let rest_hp = _.clamp(Math.floor(this.game.state.player.maxHealth * 0.3 + this.game.state.player.currentHealth), 0, this.game.state.player.maxHealth)
        let root = this
        let rest_hp_gain = this.game.state.player.maxHealth - rest_hp
        let options = [
            {
                text: `Rest (regain ${rest_hp_gain} HP)`,
                cards: [true], // dummy, to allow selectability
                activate: async function(context)
                {
                    root.pop_context({
                        type: "heal", 
                        amount: rest_hp_gain
                    })
                }
            },
            {
                text: `Smith (upgrade a card)`,
                cards: this.game.state.deck.filter((card) => (!card.upgraded || card.can_upgrade) && !card.cannot_upgrade),
                activate: async function(context)
                {
                    let card = await root.push_context({
                        type: "select-card",
                        header: "Select a card to upgrade",
                        cards: this.cards,
                        can_cancel: true
                    })
                    if (!card) return null
                    root.pop_context({
                        type: "upgrade", 
                        card: card
                    })
                }
            },
            {
                text: `Meditate (remove a card)`,
                cards: this.game.state.deck.filter((card) => !card.unremovable),
                activate: async function(context)
                {
                    let card = await root.push_context({
                        type: "select-card",
                        header: "Select a card to remove",
                        cards: this.cards,
                        can_cancel: true
                    })
                    if (!card) return
                    root.pop_context({
                        type: "remove", 
                        card: card
                    })
                }
            }
        ]

        if (force)
        {
            let y = 4
            for (let option of options)
            {
                this.regions.push(new Region({
                    owner: "options",
                    root: this,
                    x: 8,
                    y: y++,
                    width: option.text.length + 2,
                    height: 1,
                    option: option,
                    selectable: function(context) {
                         return context.type == "top-level" && this.option.cards.length > 0
                    },
                    activate: option.activate,
                    render: function(program)
                    {
                        program.move(this.x, this.y)
                        if (this.root.get_selected_region() === this) {
                            program.bg(this.root.get_context().hover_color)
                        } else if (this.option.cards.length == 0) {
                            this.program.fg("gray")
                        }
                        program.write(this.option.text)
                        program.resetcol()
                    }
                }))
            }
        }
    }

    async exec() {            
        // wait for the player to select a turn-action to do.
        let result = await this.push_context({
            type: 'top-level'
        })

        // temporary ugly hack, because there is no action for resolving a 
        // campfire yet...
        let exit_campfire = function(state) {
            getCurrRoom(state).choice = 'rest'
        }
        
        if (result.type == "heal") {
            exit_campfire(this.game.state)
            return {type: 'addHealth', target: 'player', amount: result.amount}
        } else if (result.type == "upgrade") {
            exit_campfire(this.game.state)
            return {type: 'upgradeCard', card: result.card}
        } else if (result.type == "remove") {
            exit_campfire(this.game.state)
            return {type: 'removeCard', card: result.card}
        }

        // no action.
        return null
    }
}