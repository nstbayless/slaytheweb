import {getCurrMapNode, isRoomCompleted, clamp} from '../../game/utils.js'
import {$d, $middle_element, _, boxline, keypress_abstract} from '../util.js'
import { TUI } from '../tui.js'

function node_remap(c)
{
    return $d({
        M: "◯",
        E: "⌘",
        $: "⚖",
        C: "△",
        Q: "?",
        start: ":",
        boss: "☠"
    }[c], c)
}

export function dungeon_component(game) {
    return {
        name: "dungeon",
        depth: [TUI.BASE_DEPTH],
        width: 10, // component width
        game: game,
        _resolve: null,
        scroll: 0,
        select: -1,
        onAdd: function() {
            this.default_scroll()
            this.default_select()
        },
        default_scroll: function() {
            let h = this.tui.program.rows
            this.scroll = Math.floor(this.game.state.dungeon.y * 2 - h / 3)
        },
        clamp_scroll: function() {
            let h = this.tui.program.rows
            let graph = this.game.state.dungeon.graph
            if (this.scroll + h >= graph.length * 2) this.scroll = graph.length * 2- h
            if (this.scroll < 0) this.scroll = 0
        },
        get_next_rooms_x: function() {
            let node = getCurrMapNode(this.game.state)
            let graph = this.game.state.dungeon.graph
            if (this.game.state.dungeon.y < graph.length - 1 && node.edges.size > 0)
            {
                let y = this.game.state.dungeon.y + 1
                let out = []
                for (let x = 0; x < graph[y].length; ++x)
                {
                    let next = graph[y][x]
                    if (node.edges.has(next))
                    {
                        out.push(x)
                    }
                }
                return out
            }

            return []
        },
        default_select: function() {
            let next_x = this.get_next_rooms_x()
            // get median
            this.select = $d($middle_element(next_x), -1)
        },
        onKeypress: function(e) {
            let a = keypress_abstract(e)
            let delta_x = a.delta_x
            this.scroll += a.delta_y
            if (a.delta_x != 0)
            {
                this.default_scroll()
                let next_x = this.get_next_rooms_x()
                let i = next_x.indexOf(this.select)
                if (i == -1)
                {
                    this.default_select()
                }
                else
                {
                    this.select = next_x[clamp(i + a.delta_x, 0, next_x.length - 1)]
                }
                return true
            }
            else if (a.delta_y != 0)
            {
                return true
            }
            if (a.confirm)
            {
                let graph = this.game.state.dungeon.graph
                let next_y = this.game.state.dungeon.y + 1
                if (next_y < graph.length && this.select >= 0 && this.select < graph[next_y].length && this._resolve)
                {
                    this._resolve(
                        {
                            type: 'move',
                            move: {
                                "x": this.select,
                                "y": next_y
                            }
                        }
                    )
                    return true
                }
            }
        },
        exec: async function exec() {
            let _this = this
            return await new Promise((resolve, reject) => {
                _this._resolve = resolve
            })
        },
        render: function(program, props) {
            let px = Math.floor(props.w / 2 - this.width / 2)
            let py = this.tui.content_margin_top
            program.move(0, 0)
            program.move(px, py)
            let state = this.game.state
            let graph = state.dungeon.graph
            this.clamp_scroll()
            const scroll = this.scroll
            for (let y = 0; y < graph.length; ++y)
            {
                // buff of ints representing lines to draw. Bitwise-or together:
                // 1: right
                // 2: left
                // 4: up
                // 8: down
                let buff = Array(graph[y].length)
                let debuff = Array(graph[y].length)

                // collect buffer of lines for this row
                for (let x = 0; x < graph[y].length; ++x)
                {
                    const node = graph[y][x]
                    if (node.edges.size == 0 && y < graph.length - 1)
                    {
                        // if this node is spurious, move on
                        // (why does dungeon even generate these..?)
                        continue
                    }
                    if (node && node.type)
                    {
                        let char = node_remap(node.type)
                        if (program.move(px + 2 * x, py + 2 * y - scroll))
                        {
                            if (isRoomCompleted(node.room))
                            {
                                // invert colors
                                program.fg("black")
                                program.bg("#a0a0a0")
                            }
                            else if (y == state.dungeon.y + 1 && x == this.select)
                            {
                                program.bg("#a04040")
                                program.fg("#ffff50")
                            }
                            program.write(char)
                            program.resetcol()
                        }
                    }

                    // next three edges
                    if (y < graph.length - 1)
                    {
                        let ny = y + 1
                        for (let nx = 0; nx < graph[ny].length; ++nx)
                        {
                            let next_node = graph[ny][nx]
                            if (node.edges.has(next_node))
                            {
                                // draw edge to next node
                                let dx = nx - x
                                for (let i = Math.min(x, nx); i <= Math.max(x, nx); ++i)
                                {
                                    // horizontal
                                    if (x != nx)
                                    {
                                        if (i == Math.min(x, nx))
                                        {
                                            buff[i] |= 1
                                        }
                                        else if (i == Math.max(x, nx))
                                        {
                                            buff[i] |= 2
                                        }
                                        else
                                        {
                                            buff[i] |= 3
                                        }
                                    }

                                    // vertical
                                    if (i == x)
                                    {
                                        buff[i] |= 4
                                    }
                                    if (i == nx)
                                    {
                                        buff[i] |= 8
                                    }
                                }
                            }
                        }
                    }
                }

                // render buffer of lines
                if (program.move(px, py + 2 * y + 1 - scroll))
                {
                    for (var i = 0; i < props.w; ++i)
                    {
                        let c = $d(buff[i] & ~debuff[i], 0) | 0
                        let char = boxline(c)
                        program.write(char)
                        if (c & 1)
                        {
                            program.write("─")
                        }
                        else
                        {
                            program.write(" ")
                        }
                    }
                }
            }

            // render legend
            if (graph.length > 1)
            {
                var oy = py
                var ox = px + 2 * graph[1].length + 2
                for (let row of [
                    "Legend",
                    {M: "Encounter"},
                    {E: "Elite"},
                    {C: "Rest Area"},
                    {$: "Merchant"},
                    {Q: "Unknown"},
                    {boss: "Boss"},
                ])
                {
                    program.move(ox, oy++)
                    if (typeof(row) == "object" && Object.keys(row).length == 1)
                    {
                        let key = Object.keys(row)
                        program.write(
                            `${node_remap(key)}: ${row[key]}`
                        )
                    }
                    else
                    {
                        program.write(row)
                    }
                }
            }

            // render bottom bar
            let text = "DUNGEON"
            program.move(0, props.h - 1)
            program.bg("gray")
            for (let i = 0; i < props.w; ++i)
            {
                program.write(" ")
            }
            program.fg("black")
            program.move(Math.floor(props.w / 2 - text.length / 2), props.h - 1)
            program.write(text)
            program.bg("!gray")
            program.fg("!black")
        }
    }
}