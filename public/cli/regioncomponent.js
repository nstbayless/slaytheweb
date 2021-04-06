// TUI component class comprising selectable "regions"

import {getCurrRoom, isCurrentRoomCompleted, isDungeonCompleted, getCurrMapNode, isRoomCompleted, getMonsterById, getMonsterIntent, getAliveMonsters} from '../game/utils.js'
import {$d, $middle_element, _, boxline, blend_colors, wordWrapLines, $remove, exit_with_message} from './util.js'
import { globals, g } from './constants.js'

import { TUI, Component } from "./tui.js";

export let SELECTABLE_AND_DEFAULT = 3

export class Region {
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

export class RegionComponent extends Component
{
    constructor(game)
    {
        // for Component
        super()
        this.depth = [TUI.BASE_DEPTH]

        // need this to access state
        this.game = game

        // a stack of UI selection contexts
        // e.g. "select campfire option" -> "select card to upgrade" -> "confirm upgrade"
        this.contexts = []

        // a region is a distinct rectangle on the screen
        // which has a render function (that can render itself)
        // and may be selectable in some contexts.
        this.regions = []
        
        // cache for updating purposes
        // width and height
        this.w = undefined
        this.h = undefined
        this._cache_state = null
    }

    // adds an element to the stack of contexts. Returns when it resolves (pop_context)
    // "contexts" are interactions for the player, e.g. "select a card" or "target an enemy"
    // they resolve to null if nothing was selected.
    push_context(props) {
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
    }
    // pops and resolves the current context
    // this may have the immediate side-effect of performing whatever
    // action is tied to the resolution of this context.
    pop_context(value=null) {
        let context = this.get_context()
        $remove(this.contexts, context)
        context._resolve(value)
    }
    // retrieves topmost context, or {type: null} if no context available.
    get_context() {
        if (this.contexts.length == 0) return {type: null}
        let context = this.contexts[this.contexts.length - 1]

        // (paranoia) if context cannot be resolved for some reason,
        // don't allow it to be accessed at all.
        if (context._resolve === undefined) return {type: null}
        return context
    }
    get_selected_region()
    {
        let context = this.get_context()
        if (context && context.selected_region) return context.selected_region
        return null
    }
    set_selected_region(region)
    {
        let context = this.get_context()
        if (context) context.selected_region = region
    }
    get_default_selected_region(context) {
        let selectable_regions = this.regions.filter((region) => region.selectable(context))
        if (selectable_regions.length > 0)
        {
            // get "most" selectable -- this is the default.
            selectable_regions.sort(
                (a, b) => b.selectable(context) - a.selectable(context)
            )
            return selectable_regions[0]
        }
        else
        {
            return null
        }
    }

    get_new_selection(delta_x, delta_y) {
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
    }

    remove_regions(owner)
    {
        this.regions = this.regions.filter((region) => region.owner !== owner)
    }

    // refreshes UI state which depends on the game state.
    // (this does not include e.g. cursor position)
    // returns true if state refreshed
    refresh_state(force=false) {
        // refresh regions
        if (this._cache_state !== this.game.state || force)
        {
            this._cache_state = this.game.state
            this.refresh_regions(force)
            return true
        }
        return false
    }

    // (override this.)
    refresh_regions() { }

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
    }

    // Component overrides -----------------------------------------
    onAdd() {
        this.refresh_state(this.refresh_dimensions())
    }

    render (program) {
        // force iff the screen dimensions have changed
        let full_refresh = this.refresh_dimensions()
        this.refresh_state(full_refresh)

        // remove current selection if region no longer exists
        // replace it with the default
        if (!this.get_selected_region() || !this.regions.includes(this.get_selected_region()))
        {
            this.set_selected_region(this.get_default_selected_region(this.get_context()))
        }

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

    onKeypress(event) {
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
    }
}