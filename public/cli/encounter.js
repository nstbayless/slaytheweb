import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode, isRoomCompleted, getMonsterById, getMonsterIntent, getAliveMonsters} from '../game/utils.js'
import {$d, $middle_element, _, boxline, blend_colors, wordWrapLines, $remove, exit_with_message} from './util.js'
import { TUI } from './tui.js'
import { globals, g } from './constants.js'

class Region {
    constructor(props) {
        this.owner = null
        this.x = undefined
        this.y = undefined
        this.w = undefined
        this.h = undefined
        this.selectable = (context) => false
        this.render = (program) => {}
        this.get_info = () => null
        this.activate = async (context) => {}
        _.extend(this, props)
    }
}

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
        name: "encounter",
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
        contexts: [],
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
        // adds an element to the stack of contexts. Returns when it resolves (pop_context)
        // "contexts" are interactions for the player, e.g. "select a card" or "target an enemy"
        // they resolve to null if nothing was selected.
        push_context: function(props)
        {
            props = _.extend({
                    type: undefined,
                    _resolve: undefined,
                    can_cancel: false,
                    hover_color: $d(g.colors.hover[props.type], g.colors.hover.default)
                },
                props
            )
            this.contexts.push(props)
            props.selected_region = this.get_default_selected_region(props)
            return new Promise((resolve, reject) => {
                props._resolve = resolve
            })
        },
        // pops and resolves the current context
        // this may have the immediate side-effect of performing whatever
        // action is tied to the resolution of this context.
        pop_context: function(value=null)
        {
            let context = this.get_context()
            $remove(this.contexts, context)
            context._resolve(value)
        },
        // retrieves topmost context, or {type: null} if no context available.
        get_context: function(){
            if (this.contexts.length == 0) return {type: null}
            let context = this.contexts[this.contexts.length - 1]

            // (paranoia) if context cannot be resolved for some reason,
            // don't allow it to be accessed at all.
            if (context._resolve === undefined) return {type: null}
            return context
        },
        get_selected_region: function()
        {
            let context = this.get_context()
            if (context && context.selected_region) return context.selected_region
            return null
        },
        set_selected_region: function(region)
        {
            let context = this.get_context()
            if (context) context.selected_region = region
        },
        get_default_selected_region: function(context)
        {
            for (let region of this.regions)
            {
                if (region.selectable(context)) return region
            }
            return null
        },
        // recreate all regions from scratch
        refresh_regions(force=false)
        {
            if (this.hand !== this.state.hand || force)
            {
                this.hand = this.state.hand
                this.refresh_hand_regions(force)
            }

            let monsters = getAliveMonsters(this.state)
            if (this.monsters !== monsters || force)
            {
                this.monsters = monsters
                this.refresh_monsters_regions(force)
            }

            if (force)
            {
                this.refresh_players_region(force)
            }
        },
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
            const rows_needed = 3
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
                    program.move(x, ++y)
                    program.write("(status...)")
                }
            })
            )
        },
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
                        program.move(x, ++y)
                        program.write("(status...)")
                    }
                }))

                y += lines_per_monster
            }
        },
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
                        w: g.CARD_SLOT_WIDTH,
                        selectable: (context) => context.type == "turn-action",
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
        },
        onAdd: function() {
            this.refresh_state(this.refresh_dimensions())
        },
        // main event loop -- returns an action to enqueue
        exec: async function() {            
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
            let context = this.get_context()
            let selected_region = this.get_selected_region()

            // TODO: consider not allowing keypresses if state queue is not empty.
            let delta_x = 0, delta_y = 0
            if (event.full == "up") delta_y--
            if (event.full == "down") delta_y++
            if (event.full == "left") delta_x--
            if (event.full == "right") delta_x++

            // adjust selection
            if (delta_x != 0 || delta_y != 0)
            {
                let new_selection = this.get_selected_region()
                if (this.regions.includes(this.get_selected_region()))
                {
                    new_selection = this.get_new_selection(delta_x, delta_y)
                }
                else
                {
                    // default selection
                    let selectable_regions = this.regions.filter((region) => region.selectable(context))
                    if (selectable_regions.length > 0)
                    {
                        new_selection = selectable_regions[0]
                    }
                }

                if (new_selection && new_selection != selected_region)
                {
                    this.set_selected_region(new_selection)
                }
            }

            // activate selection
            if (event.full == "enter" && selected_region)
            {
                selected_region.activate(context)
            }

            if (event.full == "escape" || event.full == "esc")
            {
                if (context.can_cancel) this.pop_context()
            }

            // steal keypress
            return true
        },
        get_new_selection: function (delta_x, delta_y)
        {
            let src = this.get_selected_region()

            let heuristic = (dst) => {
                let a = (dst.y - src.y) * delta_y + (dst.x - src.x) * delta_x
                let b = (dst.y - src.y) * delta_x + (dst.x - src.x) * delta_y
                if (a == 0 && b == 0) return -1
                return a / (a * a + b * b)
            }

            const context = this.get_context()
            let _selectables = this.regions.filter((r) => r.selectable(context) && heuristic(r) > 0)

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
        remove_regions: function(owner)
        {
            this.regions = this.regions.filter((region) => region.owner !== owner)
        },
        // asks the player to select a target, or returns null if not selected.
        select_target: async function(descriptor) {
            let possible_targets = collect_targets(this.game.state, descriptor)

            // TODO: selection for these?
            if (descriptor == "player") return this.game.state.player
            if (descriptor == "all enemies") return "all enemies"

            return await this.push_context({
                type: 'select-target',
                can_cancel: true,
                possible_targets: possible_targets
            })
        },
        render: function(program) {
            // force iff the screen dimensions have changed
            let full_refresh = this.refresh_dimensions()
            this.refresh_state(full_refresh)

            // remove current selection if region no longer exists
            if (!this.regions.includes(this.get_selected_region()))
            {
                this.set_selected_region(null)
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
}