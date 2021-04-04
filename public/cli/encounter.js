import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode, isRoomCompleted} from '../game/utils.js'
import {$d, $middle_element, _, boxline, blend_colors, wordWrapLines} from './util.js'
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
        this.get_info = () => null
        _.extend(this, props)
    }
}

function draw_hp_bar_and_block(program, props)
{
    if (props.block && props.block != 0)
    {
        // alts: 🛡⛉
        let str = "⛊" + Math.floor(props.block) + " "
        if (program.move(props.x - str.length, props.y))
        {
            program.write(str)
        }
    }
    program.move(props.x, props.y)
    draw_hp_bar(program, props.hp, props.maxhp, props.width, (props.block > 0) ? g.colors.block : g.colors.hp)
}

function draw_hp_bar(program, hp, maxhp, width, color)
{
    program.write("[")
    const bar_width = width - 2

    let text = _.pad(`${Math.floor(hp)}/${Math.floor(maxhp)}`, bar_width)
    let hp_width = (hp) / maxhp * bar_width
    let hpcol = 0xA0

    for (let i = 0; i < bar_width; ++i)
    {
        let p = _.clamp(hp_width - i, 0, 1)
        let colstr = blend_colors(color, "#000000", 1 - p)
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
        display_info: null,
        // refreshes UI state which depends on the game state.
        // (this does not include e.g. cursor position)
        refresh_state: function(force=false) {
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
                        program.move(x + Math.floor(g.MIN_ENEMY_ZONE_WIDTH / 2 - name.length/2), y)
                        if (this.root.selected_region === this)
                        {
                            program.bg(g.colors.hover)
                        }
                        program.write(name)
                        program.resetcol()
                        let hpbarwidth = g.MAX_CREATURE_NAME_LENGTH
                        y += 1;
                        draw_hp_bar_and_block(program, {
                            hp: monster.currentHealth,
                            maxhp:monster.maxHealth,
                            block: monster.block,
                            width:hpbarwidth,
                            x: x + Math.floor(g.MIN_ENEMY_ZONE_WIDTH / 2 - hpbarwidth / 2),
                            y: y
                        })
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
                        get_info: function() {
                            return {
                                header: `(${card.energy}) ${card.name}`,
                                subheader: `(${card.type})`,
                                contents: card.description
                            }
                        },
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
            this.refresh_state(this.refresh_dimensions())
        },
        refresh_dimensions() {
            // update screen dimensions and force a full refresh
            // if needed.
            const next_w = Math.max(this.tui.program.cols, g.MIN_CLI_WIDTH)
            const next_h = Math.max(this.tui.program.rows, g.MIN_CLI_HEIGHT)
            if (next_w != this.w || next_h != this.h)
            {
                this.w = next_w
                this.h = next_h
                return true
            }
            return false
        },
        onKeypress: function(event) {

            // TODO: consider not allowing keypresses if state queue is not empty.

            let delta_x = 0, delta_y = 0
            if (event.full == "up") delta_y--
            if (event.full == "down") delta_y++
            if (event.full == "left") delta_x--
            if (event.full == "right") delta_x++

            // adjust selection
            if (delta_x != 0 || delta_y != 0)
            {
                let new_selection = this.selected_region
                if (this.regions.includes(this.selected_region))
                {
                    new_selection = this.get_new_selection(delta_x, delta_y)
                }
                else
                {
                    // default selection
                    let selectable_regions = this.regions.filter((region) => region.selectable)
                    if (selectable_regions.length > 0)
                    {
                        new_selection = selectable_regions[0]
                    }
                }

                if (new_selection && new_selection != this.selected_region)
                {
                    this.selected_region = new_selection
                }
            }
            // steal keypress
            return true
        },
        get_new_selection: function (delta_x, delta_y)
        {
            let src = this.selected_region

            let heuristic = (dst) => {
                let a = (dst.y - src.y) * delta_y + (dst.x - src.x) * delta_x
                let b = (dst.y - src.y) * delta_x + (dst.x - src.x) * delta_y
                if (a == 0 && b == 0) return -1
                return a / (a * a + b * b)
            }

            let _selectables = this.regions.filter((r) => r.selectable && heuristic(r) > 0)

            if (_selectables.length > 0)
            {
                _selectables.sort((a, b) => heuristic(b) - heuristic(a))
                return _selectables[0]
            }
            else
            {
                // no good new selection
                return undefined
            }
        },
        render: function(program) {
            // force iff the screen dimensions have changed
            let full_refresh = this.refresh_dimensions()
            this.refresh_state(full_refresh)

            // remove current selection if region no longe exists
            if (!this.regions.includes(this.selected_region))
            {
                this.selected_region = null
            }

            this.refresh_info_panel(full_refresh)

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
        },
        refresh_info_panel: function(force=false) {
            let info = this.selected_region ? this.selected_region.get_info() : null
            if (info != this.display_info || this.display_info == null || force)
            {
                this.display_info = info

                // remove all "info"-region objects
                this.regions = this.regions.filter((region) => region.owner !== "info")

                // display this info
                this.regions.push(new Region({
                    selectable: false,
                    owner: "info",
                    root: this,
                    info: this.display_info,
                    x: this.w - this.info_tab_width,
                    y: 0,
                    h: this.h,
                    w: this.info_tab_width,
                    render: function(program) {
                        // divider line
                        for (let y = this.y; y < this.h + this.y; ++y)
                        {
                            program.move(this.x, y)
                            program.write("║")
                        }

                        let y = this.y
                        let x = this.x + 2
                        let xwidth = this.w - 2
                        let infos = this.info ? [this.info] : []

                        // TODO: recursively expand info defined terms

                        function write_text(text)
                        {
                            let lines = wordWrapLines(text, xwidth)
                            for (let line of lines)
                            {
                                program.move(x, y++)
                                program.write(line)
                            }
                        }

                        // display all infos
                        for (let info of infos)
                        {
                            program.sgr('bold')
                            write_text($d(info.header, "[missing header]"))
                            program.sgr('normal')
                            if (info.subheader)
                            {
                                program.fg("gray")
                                write_text(info.subheader)
                                program.resetcol()
                            }
                            
                            y++ // skip line

                            if (info.contents !== undefined)
                            {
                                write_text(info.contents)
                            }
                        }
                    }
                }))
            }
        }
    }
}