import blessed from "../../node_modules/blessed/lib/blessed.js"
import {$p, $pm, $d, _, $remove} from "./util.js"

let global_modal_component_next_depth = 0

export class Component {
    constructor(props)
    {
        this.depth = [TUI.MODAL_DEPTH, global_modal_component_next_depth--]
        this.render = (program) => {}
        this.onKeypress = (event) => false
        this.onClose = () => undefined
        this.onAdd = () => undefined
        _.extend(this, props)

        // bind 'this' to be accessible in methods provided
        this.onClose = this.onClose.bind(this)
        this.onKeypress = this.onKeypress.bind(this)
        this.render = this.render.bind(this)
        this.onAdd = this.onAdd.bind(this)
    }

    close(exitvalue)
    {
        if (this.tui)
        {
            // invokes onClose and then removes the component
            this.tui.remove_component(this, exitvalue)
        }

        else throw "already closed"
    }
}

// terminal UI
export class TUI {
    static MODAL_DEPTH = 0
    static BASE_DEPTH = 1
    static UI_DEPETH = -1
    constructor() {
        const program = blessed.program({
        });
        let _move = program.move
        program.resetbg = function() {
            program.bg("!black")
        }
        program.resetfg = function() {
            program.fg("!black")
        }
        program.resetcol = function() {
            program.resetfg()
            program.resetbg()
        }
        program.move = function(x=0, y=0) {
            if (y < 0 || y >= program.rows || x < 0 || x >= program.cols)
            {
                _move.bind(program)(0, 0)
                return false
            }
            return {
                result: _move.bind(program)(x, y)
            }
        }.bind(program)
        this.program = program;

        // things to be rendered
        this.components = []
        this.upcoming_render = null
        program.alternateBuffer();
        program.clear();
        program.hideCursor();
        let _this = this
        program.on("resize", (data) => {
            try {
                this.program.clear()
                _this.mark_dirty()
            }
            catch (e)
            {
                _this.end()
                console.error(e, e.stack);
                process.exit(1)
            }
        })
        program.on("keypress", (c, e) => {
            e.char = c
            program.move(0, 0)
            try {
                this.keypress(e)
            }
            catch (e)
            {
                this.end()
                console.error(e, e.stack);
                process.exit(1)
            }
        })
    }

    end() {
        this.program.resetcol()
        this.program.move(0, 0)
        this.program.normalBuffer();
        this.program.showCursor();
    }

    // adds component to the screen
    // returns a promise which resolves when the component is removed.
    // (components can remove themselves by calling .close())
    add_component(component) {
        component = (component instanceof Component) ? component : new Component(component)
        // add component, and attach tui and tui_resolve, which we need
        // to handle closing later.
        if (component.tui !== undefined)
        {
            throw "component already has tui defined"
        }
        if (component.tui_resolve !== undefined)
        {
            throw "component already has tui_resolve defined"
        }
        component.tui = this;
        this.components.push(component);
        this.sort_components();
        component.onAdd()
        this.mark_dirty()
        return new Promise((resolve, reject) => {
            component.tui_resolve = resolve
        })
    }

    remove_component(component, default_value=undefined) {
        // shortcut if component is not actually attached.
        if (!component || !component.tui) return default_value

        // perform component's onClose() event
        let rv = $d(component.onClose(), default_value)

        // retake attached attributes
        let resolve = component.tui_resolve
        delete component.tui
        delete component.tui_resolve

        // remove from components list
        $remove(this.components, component);
        
        // resolve promise with onClose returned value, or defaultvalue if onClose returns undefined
        resolve(rv)
        return rv
    }

    sort_components() {
        this.components.sort((a, b) => {
            // lexicographic comparison
            for (let i = 0; i < a.length && i < b.length; ++i)
            {
                if (a[i] != b[i])
                {
                    return a[i] - b[i]
                }
            }
            return a.length - b.length
        })
    }

    // queues a render onto the event loop
    mark_dirty() {
        if (!this.upcoming_render)
        {
            this.upcoming_render = true
            setTimeout(() => {
                this.upcoming_render = false
                this.render()
            }, 0)
        }
    }

    render() {
        let w = this.program.cols
        let h = this.program.rows
        this.program.clear()
        this.sort_components()
        
        // start with highest-depth components
        for (var i = this.components.length; i --> 0;) {
            let component = this.components[i]
            component.render(
                this.program, {
                w: w,
                h: h
            })
        }

        this.program.flush()
    }

    keypress(e) {
        if (e.full == 'C-c')
        {
            // quit
            this.end()
            process.exit(0);
        }
        else
        {
            this.sort_components()
            for (let component of this.components)
            {
                let r = component.onKeypress(e)
                if (r === false || r === undefined)
                {
                    continue
                }
                else
                {
                    // keypress occurred -- update state and then re-render
                    this.render()
                    return
                }
            }
        }
    }
}