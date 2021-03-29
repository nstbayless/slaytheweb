import blessed from "../../node_modules/blessed/lib/blessed.js"
import {promisify} from "../../node_modules/util/util.js"

export class TUI {
    constructor() {
        this.screen = blessed.screen({
            smartCSR: true
        });
        
        // Quit on Escape, q, or Control-C.
        this.screen.key(['C-c'], function(ch, key) {
            return process.exit(0);
        });

        this.screen.title="Slay The Web"
    }

    /*
        opts: {
            title: str,
            contents: str
        }
    */
    async prompt(opts)
    {
        let box = blessed.prompt({
            top: 'center',
            left: 'center',
            content: opts.content || "",
            tags: true,
            border: {
              type: 'line'
            },
            style: {
              fg: 'white',
              border: {
                fg: '#f0f0f0'
              }
            }
        });
        
        this.screen.append(box)
        box.focus()
        this.screen.render()
    }
}