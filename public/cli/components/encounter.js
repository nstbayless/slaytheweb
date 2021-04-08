import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode, isRoomCompleted, getMonsterById, getMonsterIntent, getAliveMonsters, clamp} from '../../game/utils.js'
import {$d, $middle_element, _, boxline, blend_colors, wordWrapLines, $remove, exit_with_message} from '../util.js'
import { TUI } from '../tui.js'
import { globals, g } from '../constants.js'
import { RegionComponent, SELECTABLE_AND_DEFAULT, Region } from './regioncomponent.js'
import powers from '../../game/powers.js'



function get_target_string(state, target)
{
    if (target === state.player) return "player"
    if (target === "all enemies") return "all enemies"
    let monsters = getCurrRoom(state).monsters
    let idx = monsters.indexOf(target)
    if (idx < 0) throw "monster not found"
    return `enemy${idx}`
}

function get_intent_descriptor(intent)
{
    if (intent.damage)
    {
        let sym = "👊"
        // 🔪
        if (intent.damage >= 5) sym = '🗡'
        if (intent.damage >= 20) sym = '⚔'
        return {
            brief: `${sym} ${intent.damage}`,
            color: "red",
            info: {
                header: "Attack",
                contents: "%{name} will attack for %{damage} damage"
            }
        }
    }

    if (intent.block)
    {
        return {
            brief: `⛉ ${intent.block}`,
            color: g.colors.block,
            info: {
                header: "Defend",
                contents: "%{name} will block for %{damage} points"
            }
        }
    }

    // unknown
    return {
        brief: "?",
        color: "#a08000",
        info: {
            header: "Unknown",
            contents: "%{name}'s intention is unknown"
        }
    }
}

// finds all targets matching the given description.
// description: 'enemy', 'player', 'all enemies', etc.
function collect_targets(state, targets_desc)
{
    let monsters = getAliveMonsters(state)
    let player = state.player
    if (targets_desc == 'all enemies')
    {
        if (monsters.length == 0) return []
        return ['all enemies']
    }
    if (targets_desc == 'enemy') return monsters
    if (targets_desc == 'player') return [player]
    return []
}

function draw_hp_bar_and_block(program, props)
{
    if (props.block && props.block != 0)
    {
        // alts: 🛡⛉
        let str = "⛊" + Math.floor(props.block) + " "
        if (program.move(
            (props.blockAlign == "left")
                ? props.x - str.length
                : props.x + props.width + 1,
            props.y))
        {
            program.write(str)
        }
    }
    program.move(props.x, props.y)
    draw_hp_bar(program, props.hp, props.maxhp, props.width, (props.block > 0) ? g.colors.block : g.colors.hp)
}

// draws powers (status effects)
function draw_status(program, props)
{
    let x = props.x
    let y = props.y
    let w = props.w
    let h = props.h

    // accumulate properties about powers then render
    // (in two passes)
    let accs = {}
    let rows = {}
    for (let pass = 0; pass <= 1; ++pass)
    {
        let column = 0
        let row_idx = 0
        for (let key in props.powers)
        {
            let amount = props.powers[key]
            if (amount == 0) continue
            let power = powers[key]
            if (!power) continue
            let sym = $d(power.sym, "⚹")
            let acc = $d(accs[power], {})
            accs[power] = acc
            
            let len = sym.length
            if (amount != 1)
            {
                len += ("" + amount).length
            }

            if (pass == 0)
            {
                // wrap to next line if not enough space
                if (len + column > w && row_idx < h - 1)
                {
                    column = 0
                    row_idx++
                } else if (len + column >= w && row_idx == h - 1)
                {
                    let row = $d(rows[row_idx], {len:0})
                    rows[row_idx] = row
                    acc.ellipses = true
                    row.length++
                    break
                }

                let row = $d(rows[row_idx], {len:0})
                rows[row_idx] = row
                acc.column = column
                acc.row = row_idx
                row.len += len
                column += len
            }
            else
            {
                let _x = x + acc.column + Math.floor((w - rows[acc.row].len) / 2)
                let _y = y + acc.row
                program.move(_x, _y)
                if (acc.ellipses)
                {
                    program.write("⋯")
                    break
                }
                else
                {
                    program.fg($d(power.color, "#FF00FF"))
                    program.write(sym)
                    program.resetfg()
                    if (amount != 1 && amount != 0)
                    {
                        program.write("" + amount)
                    }
                }
            }
        }
    }
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
        let p = clamp(hp_width - i, 0, 1)
        let colstr = blend_colors(color, "#000000", 1 - p)
        program.bg(colstr)
        program.write(text.substr(i, 1))
    }

    program.resetcol()

    program.write("]")
}

export class EncounterComponent extends RegionComponent
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
        if (this.hand !== this.game.state.hand || force)
        {
            this.hand = this.game.state.hand
            this.refresh_hand_regions(force)
        }

        let monsters = getAliveMonsters(this.game.state)
        if (this.monsters !== monsters || force)
        {
            this.monsters = monsters
            this.refresh_monsters_regions(force)
        }

        if (force)
        {
            this.refresh_players_region(force)
            this.refresh_info_panel(force)
        }
    }

    refresh_players_region(force=false)
    {
        // remove all "player"-region objects
        this.remove_regions("players")

        const 
            left = 0,
            right = g.MIN_PLAYER_ZONE_WIDTH,
            top = g.TOOLBAR_HEIGHT,
            bottom = $d(this.hand_top_y, this.h)
        
        // center vertically
        const rows_needed = 5
        let y = top + Math.floor((bottom - top) / 2 - rows_needed / 2)

        this.regions.push(new Region({
            owner: "players",
            root: this,
            x: left,
            y: y,
            width: right - left,
            height: rows_needed,
            selectable: function (context) {
                let type = context.type

                // players are hoverable when in turn top-level
                if (type == "turn-action") return true

                // players are hoverable if the context is to select a target,
                // and the player is one of those targets.
                if (type == "select-target") return context.possible_targets.includes(this.root.game.state.player)

                // otherwise, not hoverable
                return false
            },
            activate: function(context) {
                if (context.type == "select-target")
                {
                    // activating a player while selecting a target
                    // means selecting that player as the target.
                    this.root.pop_context(this.root.game.state.player)
                }
            },
            render: function(program)
            {
                let x = this.x, y = this.y
                let player = this.root.game.state.player
                let name = $d(player.name, `player`)

                // write name
                program.move(x + Math.floor(this.width / 2 - name.length/2), y)
                if (this.root.get_selected_region() === this)
                {
                    program.bg(this.root.get_context().hover_color)
                }
                program.write(name)
                program.resetcol()
                let hpbarwidth = g.MAX_CREATURE_NAME_LENGTH
                y += 1;
                draw_hp_bar_and_block(program, {
                    hp: player.currentHealth,
                    maxhp:player.maxHealth,
                    block: player.block,
                    width: hpbarwidth,
                    blockAlign: "right",
                    x: x + Math.floor(this.width / 2 - hpbarwidth / 2),
                    y: y
                })
                y += 1
                draw_status(program, {
                    powers: player.powers,
                    x: x,
                    w: this.width,
                    y: y,
                    h: 3
                })
            }
        })
        )
    }

    refresh_monsters_regions(force=false)
    {
        // remove all "monster"-region objects
        this.remove_regions("monsters")

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
                owner: "monsters",
                root: this,
                monster_id: monster.id,
                i: i++,
                x: left,
                y: y,
                width: right - left,
                height: lines_per_monster,
                selectable: function (context)
                {
                    let type = context.type

                    // monsters are hoverable when in turn top-level
                    if (type == "turn-action") return true

                    // monsters are hoverable if the context is to select a target,
                    // and the monster is one of those targets.
                    if (type == "select-target") return context.possible_targets.includes(getMonsterById(this.root.game.state, this.monster_id))

                    // otherwise, not hoverable
                    return false
                },
                get_info: function() {
                    let monster = getMonsterById(this.root.game.state, this.monster_id)
                    return get_intent_descriptor(getMonsterIntent(monster)).info
                },
                activate: function(context) {
                    if (context.type == "select-target")
                    {
                        // activating a monster while selecting a target
                        // means selecting that monster as the target.
                        this.root.pop_context(getMonsterById(this.root.game.state, this.monster_id))
                    }
                },
                render: function(program)
                {
                    let x = this.x, y = this.y
                    let monster = getMonsterById(this.root.game.state, this.monster_id)
                    if (!monster) return
                    let name = $d(monster.name, `monster ${this.i}`)

                    let intent_desc = get_intent_descriptor(getMonsterIntent(monster))

                    // write name
                    let name_x = x + Math.floor(this.width / 2 - name.length/2)
                    program.move(name_x, y)
                    if (this.root.get_selected_region() === this)
                    {
                        program.bg(this.root.get_context().hover_color)
                    }
                    program.write(name)
                    program.resetcol()

                    // write intent
                    program.move(name_x - intent_desc.brief.length - 1, y)
                    program.fg($d(intent_desc.color, "#d0d0d0"))
                    program.write(intent_desc.brief)
                    program.resetcol()

                    let hpbarwidth = g.MAX_CREATURE_NAME_LENGTH
                    y += 1;
                    draw_hp_bar_and_block(program, {
                        hp: monster.currentHealth,
                        maxhp:monster.maxHealth,
                        block: monster.block,
                        width:hpbarwidth,
                        blockAlign: "left",
                        x: x + Math.floor(this.width / 2 - hpbarwidth / 2),
                        y: y
                    })
                    draw_status(program, {
                        powers: monster.powers,
                        x: x,
                        w: this.width,
                        y: y,
                        h: 1
                    })
                }
            }))

            y += lines_per_monster
        }
    }

    refresh_hand_regions(force=false)
    {
        // remove all "hand"-region objects
        this.remove_regions('hand')

        const width_available = this.w - this.info_tab_width - 1
        const cards_per_row = Math.ceil(width_available / g.CARD_SLOT_WIDTH)
        const rows_needed = Math.max(4, Math.ceil(this.hand.length / cards_per_row))
        const top = this.h - rows_needed - 1
        this.hand_top_y = top

        // recreate them -------------------------
        // bar along top
        this.regions.push(
            new Region({
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
                owner: "hand",
                root: this,
                x: 0,
                // :^)
                y: top + 1 + Math.floor(rows_needed / 2 - 2),
                w: 4,
                h: 4,
                render: function(program) {
                    const energy = this.root.game.state.player.currentEnergy
                    const max_energy = this.root.game.state.player.maxEnergy
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

        // end turn region
        this.regions.push(
            new Region({
                owner: "hand",
                root: this,
                x: width_available - 1,
                y: this.h - 4,
                w: 1,
                h: 4,
                selectable: (context) => context.type == "turn-action",
                render: function(program)
                {
                    let x = this.x, y = this.y
                    program.sgr("bold")
                    if (this.root.get_selected_region() == this)
                    {
                        program.fg("white")
                        program.bg(this.root.get_context().hover_color)
                    }
                    else
                    {
                        program.bg("#0000c0")
                        program.fg("#c0c0c0")
                    }
                    for (let c of ["E", "N", "D", "↺"])
                    {
                        program.move(x, y++)
                        program.write(c)
                    }
                    program.resetcol()
                    program.sgr("normal")
                },
                activate: function(context)
                {
                    this.root.pop_context({
                        type: "end-turn"
                    })
                }
            })
        )

        // cards
        let left = 5
        let x = left
        let y = top + 1
        let i = 0
        for (let card of this.hand)
        {
            this.regions.push(
                new Region({
                    owner: "hand",
                    root: this,
                    card: card,
                    x: x,
                    y: y,
                    h: 1,
                    i: i++,
                    w: g.CARD_SLOT_WIDTH,
                    selectable: function(context)
                    {
                        if (context.type == "turn-action")
                        {
                            return (this.i == 0) ? SELECTABLE_AND_DEFAULT : true
                        }
                    },
                    get_info: function() {
                        return {
                            header: `(${card.energy}) ${card.name}`,
                            subheader: `(${card.type})`,
                            contents: card.description
                        }
                    },
                    render: function(program)
                    {
                        const player_energy = this.root.game.state.player.currentEnergy
                        const card = this.card

                        // set bg if selected
                        if (this == this.root.get_selected_region())
                        {
                            program.bg(this.root.get_context().hover_color)
                        }

                        // write text
                        program.move(this.x, this.y)

                        // write card energy
                        if (player_energy >= card.energy)
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
                    },
                    activate: async function(context) {
                        if (context.type == "turn-action" && this.root.game.state.player.currentEnergy >= card.energy)
                        {
                            let target = await this.root.select_target(card.target)
                            if (target)
                            {
                                this.root.pop_context({
                                    type: 'play-card',
                                    card: this.card,
                                    target: target
                                })
                            }
                        }
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
    }
    
    // main event loop -- returns an action to enqueue
    async exec() {            
        // wait for the player to select a turn-action to do.
        let turn_action = await this.push_context({
            type: 'turn-action'
        })

        if (turn_action.type == "play-card") {
            // enqueue an action.
            return {
                type: "playCard",
                card: turn_action.card,
                target: get_target_string(this.game.state, turn_action.target)
            }
        } else if (turn_action.type == "end-turn") {
            return {
                type: "endTurn"
            }
        }

        // no action.
        return null
    }
   
    // asks the player to select a target, or returns null if not selected.
    async select_target(descriptor) {
        let possible_targets = collect_targets(this.game.state, descriptor)

        // TODO: selection for these?
        if (descriptor == "player") return this.game.state.player
        if (descriptor == "all enemies") return "all enemies"

        return await this.push_context({
            type: 'select-target',
            can_cancel: true,
            possible_targets: possible_targets
        })
    }
    refresh_info_panel(force=false) {
        let info = this.get_selected_region() ? this.get_selected_region().get_info() : null
        if (info != this.display_info || this.display_info == null || force)
        {
            this.display_info = info

            // remove all "info"-region objects
            this.remove_regions("info")

            // display this info
            this.regions.push(new Region({
                owner: "info",
                root: this,
                info: this.display_info,
                x: this.w - this.info_tab_width - 1,
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