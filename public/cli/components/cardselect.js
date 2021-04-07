import { assert, umod, clamp } from '../../game/utils.js'
import { draw_box, keypress_abstract} from '../util.js'
import { Component } from '../tui.js'
import { g } from '../constants.js'

export class CardComponent extends Component
{
    constructor(cards)
    {
        super()
        this.name = "cards"
        this.scroll = 0
        this.select_x = 0
        this.select_y = 0
        this.cards_per_row = 2
        this.cards = cards
        // cannot display a window with 0 cards.
        assert(this.cards && this.cards.length > 0)
    }

    onKeypress(e)
    {
        let a = keypress_abstract(e)

        if (a.delta_x)
        {
            this.select_x = umod(this.select_x + a.delta_x, this.cards_per_row)
        }
        if (a.delta_y)
        {
            if (this.select_y + a.delta_y < 0) {}
            else if (this.cards_per_row * (this.select_y + a.delta_y) + this.select_x >= this.cards.length) {}
            else
            {
                this.select_y += a.delta_y
            }

            // update scrolling based on selected y
            let scroll_margin = 0
            if (this.rows_visible() > 4) scroll_margin = 1
            if (this.select_y - this.scroll >= this.rows_visible() - scroll_margin - 1)
            {
                this.scroll = this.select_y + 1 + scroll_margin - this.rows_visible()
            }
            if (this.select_y - this.scroll <= scroll_margin)
            {
                this.scroll = this.select_y - scroll_margin
            }

            // clamp scroll
            if (this.scroll + this.rows_visible() > this.total_rows()) this.scroll = this.total_rows() - this.rows_visible()
            if (this.scroll < 0) this.scroll = 0
        }

        if (a.confirm) this.close(this.get_selected_card())
        if (a.cancel) this.close()

        // capture all key events
        return true
    }

    total_rows()
    {
        return (this.cards.length + this.cards_per_row - 1) / this.cards_per_row
    }

    rows_visible()
    {
        return Math.floor(Math.min(this.h - 6), this.total_rows())
    }

    get_selected_card()
    {
        let idx = clamp(this.select_y * this.cards_per_row + this.select_x, 0, this.cards.length - 1)
        return this.cards[idx]
    }

    render(program)
    {
        this.w = program.cols
        this.h = program.rows

        let h = this.rows_visible() + 2
        let w = 2 * g.CARD_SLOT_WIDTH + 3
        let left = Math.floor(this.w / 2 - w / 2)
        let top = Math.floor(this.h / 2 - h / 2)

        program.bg("#202020")
        draw_box(program, {
            x: left,
            y: top,
            w: w,
            h: h,
            filled: true,
            border: "double"
        })

        let i = -1
        for (let card of this.cards)
        {
            ++i
            let col = i % 2
            let row = Math.floor(i / 2)

            if (this.get_selected_card() === card)
            {
                program.bg(g.colors.hover.default)
            }
            program.move(left + 1 + col * (g.CARD_SLOT_WIDTH + 1), row + top + 1)
            program.write(`(${card.energy}), ${card.name}`)
            if (this.get_selected_card() === card)
            {
                program.bg("#202020")
            }
        }

        program.resetcol()
    }
}