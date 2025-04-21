import { h } from "../monke.js"
export function hdom(arr) {
  if (typeof arr[0] == "function") return arr[0](...arr.slice(1))
  else return h(...arr.map(
    item => Array.isArray(item)
      ? hdom(item) : item))
}
