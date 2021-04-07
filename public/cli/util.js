import {promisify} from "../../node_modules/util/util.js"
import _ from "../../node_modules/lodash/lodash.js"
import { clamp } from "../game/utils.js";

export {promisify, _};

export function promisify_method(params)
{
    if (typeof(params) !== 'object' || Object.keys(params).length !== 1) {
        throw "promisify_method: takes {methodname: object}"
    }

    let method = Object.keys(params)[0]
    let obj = params[method]

    if (typeof(obj[method]) != "function") {
        throw `promisify_method: object contains no method with name "${method}"`
    }

    //return promisify(obj[method]).bind(obj)
    return (...args) => {
        return new Promise((resolve, reject) => {
            try
            {
                args.push((err, result) => {
                    if (err) reject(err)
                    resolve(result)
                })
                obj[method].bind(obj)(...args)
            }
            catch (e) {
                reject(e)
            }
        })
    }
}

export function or_default()
{
    for (let arg of arguments)
    {
        if (arg !== undefined)
        {
            return arg
        }
    }

    return undefined
}

// remove from array by-value
// returns number of items removed
export function $remove(arr, value)
{
    return (_.remove(arr, (n) =>  n === value)).length
}

export function $middle_element(arr)
{
    if (arr.length == 0)
    {
        return undefined
    }
    return arr[Math.floor(arr.length / 2)]
}

const _boxlines =
       [" ", "┄", "┈", "─",
        "┆", "└", "┘", "┴",
        "┊", "┌", "┐", "┬",
        "|", "├", "┤", "┼"]
export function boxline(c)
{
    if (typeof(c) == "number")
    {
        c = Math.floor(c)
        if (c >= 0 && c < 0x10)
        {
            return _boxlines[c]
        }
    }
    return " "
}

export function async_sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export function interpolate(a, b, p) {
    p = clamp(p, 0, 1)
    return a * (1 - p) + b * p
}

export function blend_colors(a, b, p) {
    // TODO: error if string does not start with #
    a = parseInt(a.substr(1), 16)
    b = parseInt(b.substr(1), 16)
    let
        ra = (a & 0xff0000) >> 16,
        ga = (a & 0x00ff00) >> 8,
        ba = (a & 0x0000ff),
        rb = (b & 0xff0000) >> 16,
        gb = (b & 0x00ff00) >> 8,
        bb = (b & 0x0000ff)

    let floor = Math.floor,
        ro = floor(interpolate(ra, rb, p)),
        go = floor(interpolate(ga, gb, p)),
        bo = floor(interpolate(ba, bb, p))

    let o = (ro << 16) | (go << 8) | (bo & 0xff)

    return `#${_.padStart(o.toString(16), 6, '0')}`
}

// https://stackoverflow.com/a/14487422
export function wordWrap(str, maxWidth) {
    let newLineStr = "\n"; let done = false; let res = ''; let found = false
    while (str.length > maxWidth) {                 
        found = false;
        // Inserts new line at first whitespace of the line
        for (let i = maxWidth - 1; i >= 0; i--) {
            if (testWhite(str.charAt(i))) {
                res = res + [str.slice(0, i), newLineStr].join('');
                str = str.slice(i + 1);
                found = true;
                break;
            }
        }
        // Inserts new line at maxWidth position, the word is too long to wrap
        if (!found) {
            res += [str.slice(0, maxWidth), newLineStr].join('');
            str = str.slice(maxWidth);
        }

    }

    return res + str;
}

export function splitlines (text) {
    return text.split(/\r?\n/)
}

export function wordWrapLines (text, maxWidth) {
    return splitlines(wordWrap(text, maxWidth))
}

// https://stackoverflow.com/a/14487422
function testWhite(x) {
    var white = new RegExp(/^\s$/);
    return white.test(x.charAt(0));
};

export function exit_with_message(tui, message="", code=0)
{
    tui.end()
    console.log(message)
    process.exit(code)
}

export function keypress_direction(event)
{
    let delta_x = 0, delta_y = 0
    if (event.full == "up") delta_y--
    if (event.full == "down") delta_y++
    if (event.full == "left") delta_x--
    if (event.full == "right") delta_x++
    return [delta_x, delta_y]
}

// returns the abstract key event notions
// e.g. "move left", "move right", "select", "back", etc.
export function keypress_abstract(event)
{
    let [delta_x, delta_y] = keypress_direction(event)
    return {
        delta_x, delta_y,
        confirm: event.full == "enter",
        cancel: event.full == "escape" || event.full == "esc" || event.full == "backspace"
    }
}

export function draw_box(program, props)
{
    let chars = " ││?" + "─┌┐?" + "─└┘?"
    if (props.style == "double")
    {
        chars = " ║║?" + "═╔╗?" + "═╚╝?"
    }
    let _x = undefined, _y = undefined // cached x, y values
    for (let x = props.x; x < props.x + props.w; ++x)
    {
        for (let y = props.y; y < props.y + props.h; ++y)
        {
            let xborder = (x == props.x | (2 * (x == props.x + props.w - 1)))
            let yborder = (y == props.y | 2 * (y == props.y + props.h - 1))
            if (!xborder && !yborder && !props.filled) continue
            let charidx = (4 * yborder) | xborder
            if (_x != x || _y != y)
            {
                program.move(x, y)
                _x = x
                _y = y
            }
            _x++
            program.write(chars[charidx])
        }
    }
}

// convenience
export let
    $p = promisify,
    $pm = promisify_method,
    $d = or_default