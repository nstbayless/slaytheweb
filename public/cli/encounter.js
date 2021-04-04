import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode, isRoomCompleted} from '../game/utils.js'
import {$d, $middle_element, _, boxline} from './util.js'
import { TUI } from './tui.js'
import { globals, g } from './constants.js'

class Region {
    constructor(props) {
        this.owner = null
        this.x = undefined
        this.y = undefined
        this.w = undefined
        this.h = undefined
        this.selectable = true
        this.render = (program) => {}
        _.extend(this, props)
    }
}

function draw_hp_bar(program, hp, maxhp, width=g.MAX_CREATURE_NAME_LENGTH)
{
    program.write("[")
    const bar_width = width - 2

    let text = _.pad(`${Math.floor(hp)}/${Math.floor(maxhp)}`, bar_width)
    let hp_width = (hp - 3.4) / maxhp * bar_width
    let hpcol = 0xA0

    for (let i = 0; i < bar_width; ++i)
    {
        let p = _.clamp(hp_width - i, 0, 1)
        let col = Math.floor(hpcol * p)
        let colstr = `#${_.padStart(col.toString(16), 2, '0')}0000`
        program.bg(colstr)
        program.write(text.substr(i, 1))
    }

    program.resetcol()

    program.write("]")
}

export function encounter_component(game) {
    return {
        depth: [TUI.BASE_DEPTH],
        game: game,
        state: null,
        hand: null,
        monsters: null,
        regions: [],
        info_tab_width: g.MIN_INFO_PANE_WIDTH,
        // width and height
        w: undefined,
        h: undefined,
        selected_region: null,
        // refreshes UI state which depends on the game state.
        // (this does not include e.g. cursor position)
        refresh_state: function() {
            // update screen dimensions and force a full refresh
            // if needed.
            const next_w = Math.max(this.tui.program.cols, g.MIN_CLI_WIDTH)
            const next_h = Math.max(this.tui.program.rows, g.MIN_CLI_HEIGHT)
            let force = false
            if (next_w != this.w || next_h != this.h)
            {
                this.w = next_w
                this.h = next_h
                force = true
            }

            // refresh regions
            if (this.state !== this.game.state || force)
            {
                this.state = this.game.state
                this.refresh_regions(force)
                return true
            }
            return false
        },
        // recreate all regions from scratch
        refresh_regions(force=false)
        {
            if (this.hand !== this.state.hand || force)
            {
                this.hand = this.state.hand
                this.refresh_hand(force)
            }

            let monsters = getCurrRoom(this.state).monsters
            if (this.monsters !== monsters)
            {
                this.monsters = monsters
                this.refresh_monsters(force)
            }
        },
        refresh_monsters(force=false)
        {
            // remove all "monster"-region objects
            this.regions = this.regions.filter((region) => region.owner !== "monster")

            // convenience
            const right = this.w - this.info_tab_width - 1
            const left = right - g.MIN_ENEMY_ZONE_WIDTH
            const top = g.TOOLBAR_HEIGHT
            const bottom = $d(this.hand_top_y, this.h)
            const monsters = this.monsters
            
            // TODO: more lines?
            const lines_per_monster = 3
            const rows_needed = lines_per_monster * monsters.length

            // center vertically
            let y = top + Math.floor((bottom - top) / 2 - rows_needed / 2)

            // add a region per monster
            let i = 0
            for (let monster of monsters)
            {
                this.regions.push(new Region({
                    selectable: true,
                    owner: "monsters",
                    root: this,
                    monster: monster,
                    i: i++,
                    x: left,
                    y: y,
                    width: right - top,
                    height: lines_per_monster,
                    render: function(program)
                    {
                        let x = this.x, y = this.y
                        let name = $d(this.monster.name, `monster ${this.i}`)

                        // write name
                        program.move(x, y)
                        program.write(_.pad(name, g.MIN_ENEMY_ZONE_WIDTH))
                        let hpbarwidth = g.MAX_CREATURE_NAME_LENGTH
                        program.move(x + Math.floor(g.MIN_ENEMY_ZONE_WIDTH / 2 - hpbarwidth/2), ++y) // center in x
                        draw_hp_bar(program, monster.currentHealth, monster.maxHealth, hpbarwidth)
                        program.move(x, ++y)
                        program.write("(status...)")
                    }
                }))

                y += lines_per_monster
            }
        },
        refresh_hand(force=false)
        {
            // remove all "hand"-region objects
            this.regions = this.regions.filter((region) => region.owner !== "hand")

            const width_available = this.w - this.info_tab_width - 1
            const cards_per_row = Math.ceil(width_available / g.CARD_SLOT_WIDTH)
            const rows_needed = Math.max(4, Math.ceil(this.hand.length / cards_per_row))
            const top = this.h - rows_needed - 1
            this.hand_top_y = top

            // recreate them -------------------------
            // bar along top
            this.regions.push(
                new Region({
                    selectable: false,
                    owner: "hand",
                    x: 0,
                    y: top,
                    w: width_available,
                    h: 1,
                    render: function(program) {
                        program.move(this.x, this.y)
                        program.fg("#a0a0a0")
                        
                        program.write("═".repeat(this.w))
                    }
                })
            )

            // energy region:
            this.regions.push(
                new Region({
                    selectable: false,
                    owner: "hand",
                    root: this,
                    x: 0,
                    // :^)
                    y: top + 1 + Math.floor(rows_needed / 2 - 2),
                    w: 4,
                    h: 4,
                    render: function(program) {
                        const energy = this.root.state.player.currentEnergy
                        const max_energy = this.root.state.player.maxEnergy
                        let y = this.y
                        let x = this.x
                        for (let i = 0; i < this.h; ++i)
                        {
                            program.move(x + this.w - 1, i + y)
                            program.write("║")
                        }
                        if (energy == 0)
                        {
                            program.fg(g.colors.energy_depleted)
                        }
                        else
                        {
                            program.fg(g.colors.energy)
                        }
                        program.move(x, y)
                        program.write("MP:")
                        program.move(x, ++y)
                        program.write(_.padStart(String(energy), this.w - 1))
                        program.move(x, ++y)
                        program.write(_.padStart("/", this.w - 1))
                        program.move(x, ++y)
                        program.write(_.padStart(String(max_energy), this.w - 1))
                        
                        program.resetcol()
                    }
                })
            )

            // cards
            let left = 5
            let x = left
            let y = top + 1
            for (let card of this.hand)
            {
                this.regions.push(
                    new Region({
                        selectable: true,
                        owner: "hand",
                        root: this,
                        card: card,
                        x: x,
                        y: y,
                        h: 1,
                        w: g.CARD_SLOT_WIDTH,
                        render: function(program)
                        {
                            const player_energy = this.root.state.player.currentEnergy
                            const card = this.card

                            // set bg if selected
                            if (this == this.root.selected_region)
                            {
                                program.bg(g.colors.hover)
                            }

                            // write text
                            program.move(this.x, this.y)

                            // write card energy
                            if (player_energy < card.energy)
                            {
                                program.fg(g.colors.energy)
                            }
                            else
                            {
                                program.fg(g.colors.energy_depleted)
                            }
                            program.write(`(${card.energy}) `)

                            // text
                            program.resetfg()
                            /*let upgrade_str = ""
                            if (card.upgraded)
                            {
                                upgrade_str = "+"
                                if (card.upgraded > 1)
                                {
                                    upgrade_str += card.upgrade_str
                                }
                            }*/
                            let name_str = card.name
                            if (name_str.length > g.MAX_CARD_NAME_LENGTH + 1)
                            {
                                name_str = name_str.substr(0, g.MAX_CARD_NAME_LENGTH - 2) + "..."
                            }
                            program.write(name_str)

                            program.resetcol()
                        }
                    })
                )
                
                // advance position
                x += g.CARD_SLOT_WIDTH + 1
                if (x + g.CARD_SLOT_WIDTH >= width_available + 1)
                {
                    y++
                    x = left
                }
            }
        },
        onAdd: function() {
            this.refresh_state()
        },
        onKeypress: function(event) {
            // steal keypress
            return true
        },
        render: function(program) {
            // force iff the screen dimensions have changed
            this.refresh_state()

            // render each regions
            for (let region of this.regions)
            {
                // don't render if off the side
                if (region.w + region.x > program.cols)
                {
                    continue
                }
                if (region.h + region.y > program.rows)
                {
                    continue
                }
                region.render(program)
            }
        }
    }
}