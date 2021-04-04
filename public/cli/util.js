import {promisify} from "../../node_modules/util/util.js"
import _ from "../../node_modules/lodash/lodash.js"

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
    p = _.clamp(p, 0, 1)
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

// convenience
export let
    $p = promisify,
    $pm = promisify_method,
    $d = or_default