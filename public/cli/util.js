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

// convenience
export let
    $p = promisify,
    $pm = promisify_method,
    $d = or_default