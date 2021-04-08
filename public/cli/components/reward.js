import { assert, umod, clamp, getCurrRoom } from '../../game/utils.js'
import { draw_box, keypress_abstract} from '../util.js'
import { Component } from '../tui.js'
import { g } from '../constants.js'
import { CardComponent } from './cardselect.js'

function reward_text(reward)
{
    if (reward.type == "gold")
    {
        return `Obtain ${reward.amount} gold`
    }
    if (reward.type == "card")
    {
        return `Select a card`
    }
}

export class RewardComponent extends Component
{
    constructor(game)
    {
        super()
        this.name = "reward"
        this.select = 0
        this.options = []
        this.game = game
        let i = 0
        for (let reward of getCurrRoom(game.state).rewards.slice().sort(
            (a, b) => a.priority - b.priority
        ))
        {
            this.options.push({
                reward_idx: i++,
                text: reward_text(reward)
            })
        }
        this.options.push({
            text: "Proceed...",
            is_exit: true
        })
    }

    
    onKeypress(e)
    {
        let a = keypress_abstract(e)

        if (a.delta_y)
        {
            this.select += a.delta_y
            this.select = clamp(this.select, 0, this.options.length - 1)
        }

        if (a.confirm && this.resolve)
        {
            let option = this.options[this.select]
            if (option.is_exit)
            {
                return this.resolve({
                    type: 'skipRewards'
                })
            }
            else
            {
                let reward = getCurrRoom(this.game.state).rewards[option.reward_idx]
                if (reward.obtained) return true

                if (reward.type == "card")
                {
                    // select a card
                    this.tui.add_component(new CardComponent(reward.cards)).then(
                        (card) => {
                            if (card)
                            {
                                this.resolve({
                                    type: 'obtainReward',
                                    reward_idx: option.reward_idx,
                                    card_idx: reward.cards.indexOf(card)
                                })
                            }
                        }
                    )
                }
                else
                {
                    // apply immediately
                    return this.resolve({
                        type: 'obtainReward',
                        reward_idx: option.reward_idx
                    })
                }
            }
        }

        // capture all key events
        return true
    }

    async exec()
    {
        let value = await new Promise((resolve) => {
            this.resolve = resolve
        })
        this.resolve = null
        return value
    }

    render(program)
    {
        let y = 4
        let x = 8
        let i = 0
        program.move(x, y++-1)
        program.sgr("bold")
        program.write("The spoils of battle...")
        program.sgr("normal")
        let room = getCurrRoom(this.game.state)
        for (let option of this.options)
        {
            if (i++ == this.select)
            {
                program.bg(g.colors.hover.default)
            }

            if (option.reward_idx != undefined && room.rewards[option.reward_idx].obtained)
            {
                program.fg("#999")
            }
            program.move(x, y++)
            program.write(option.text)
            
            program.resetcol()
        }
    }
}