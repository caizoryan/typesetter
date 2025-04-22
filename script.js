import { sig, mem, render, HTML as html, eff_on } from "/lib/chowk/monke.js"
import { hyphenateSync } from "/lib/hyphenator/hyphenate.js"
import { Q5 as p5 } from "/lib/q5/q5.js"

const isOdd = num => num % 2 == 1;
let dpi = 350
let viewport = .93
let mx = 0, my = 0

const GlobalStyle = `
  @font-face {
    font-family: "GapSans";
    src: url("/fs/fonts/GapSans.ttf");
  }

  @font-face {
    font-family: "GapSansBold";
    src: url("/fs/fonts/GapSansBold.ttf");
  }

  @font-face {
    font-family: "GapSansBlack";
    src: url("/fs/fonts/GapSansBlack.ttf");
  }

  .container{
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #ddd;
  }

  .q5{
    width: min-content;
  }
`
/**
@param {string} text
@param {Unit} length
@param {Unit} x
@param {Unit} y
@param {LineHooks=} hooks
@param {ParentState} state
@param {p5} p

Takes text and length, and returns overflowed text.
*/
function draw_line(p, text, x, y, length, state, hooks) {
  let lines = text.split(`\n`)
  let words = lines.shift().split(" ")
  let end_lines = `\n` + lines.join(`\n`)

  let skip = false

  /**@type LineState*/
  let line_state = {
    space_size: p.textWidth(" "),
    hyphen_leftover: "",
    horizontal_pos: 0,
    word_count: 0,
  }

  let try_hyphenation = (word) => {
    if (word.includes("-")) return false
    let hyphenated = hyphenateSync(word, {
      hyphenChar: "---((---))---"
    }).split("---((---))---")

    // try to put first of hyphenated in...
    /**@type {number[]}*/
    let sizes = hyphenated.map(e => p.textWidth(e))
    let already = line_state.horizontal_pos
    //let lexeme = hyphenated.shift()
    let condition = () => {
      let cur_size = sizes
        .slice(0, count + 1)
        .reduce((sum, a) => sum += a, 0)
      console.log("calc size", count, hyphenated, cur_size)
      return already + cur_size < length.px
    }

    let count = 0
    while (condition()) { count++ }

    //let word_len = p.textWidth(lexeme)

    if (count == 0) return false
    else {
      let remainder = hyphenated.slice(count).join("")
      let word = hyphenated.slice(0, count).join("")
      //let _fill = p.ctx.fillStyle
      //p.fill(p.color("red"))
      p.text(word + "-", x.px + line_state.horizontal_pos, y.px)
      //p.fill(_fill)
      return remainder
    }

    // if (line_state.horizontal_pos + word_len < length.px) {
    //   let _fill = p.ctx.fillStyle
    //   // hook to change color of hyphenated
    //   p.fill(p.color("red"))
    //   p.text(lexeme + "-",
    //     x.px + line_state.horizontal_pos, y.px)
    //   p.fill(_fill)
    //   return hyphenated.join("")
    // }

    return false
  }

  const props = () => ({
    paragraph_state: state.paragraph_state,
    line_state: line_state,
    paragraph: state.paragraph,
    p: p,
  })

  words.forEach(word => {
    if (skip) return
    let word_len = p.textWidth(word)

    if (typeof hooks?.beforeWord == "function") hooks?.beforeWord(props())
    if (line_state.horizontal_pos + word_len > length.px) {
      // try hyphenation...
      if (!state.paragraph.hyphenate) {
        skip = true
        return
      }
      let _leftover = try_hyphenation(word)
      if (_leftover) {
        line_state.hyphen_leftover = _leftover
        line_state.word_count++
      }
      skip = true
      return
    }

    let _fill = p.ctx.fillStyle
    if (word.includes(`\n`)) {
      p.fill(p.color("red"))
    }

    p.text(word, x.px + line_state.horizontal_pos, y.px)
    p.fill(_fill)
    line_state.horizontal_pos += word_len
    line_state.horizontal_pos += line_state.space_size
    line_state.word_count++
  })

  p.opacity(1)
  words = words.slice(line_state.word_count).join(" ")

  return line_state.hyphen_leftover + " " + words + end_lines
}

/**
@param {ParagraphProps} paragraph
@param {p5} p
@param {Grid} grid 

@description takes text and length, and returns overflowed text.
*/
function draw_paragraph(p, paragraph, grid) {
  const is_fn = fn => typeof fn == "function"

  //@ts-ignore
  if (paragraph.x && is_fn(paragraph.x)) paragraph.x = paragraph.x(grid)
  //@ts-ignore
  if (paragraph.y && is_fn(paragraph.y)) paragraph.y = paragraph.y(grid)
  //@ts-ignore
  if (paragraph.length && is_fn(paragraph.length)) paragraph.length = paragraph.length(grid)
  //@ts-ignore
  if (paragraph.height && is_fn(paragraph.height)) paragraph.height = paragraph.height(grid)

  /**@type Paragraph*/
  let _paragraph = Object.assign({
    text: "",
    font_family: "monospace",
    font_weight: 300,
    x: { px: 10 },
    y: { px: 10 },
    height: { px: 100 },
    length: { px: 100 },
    leading: { px: 12 },

    color: p.color("black"),
    stroke: p.color("black"),
    font_size: { px: 14 },
    rect: true,
    hooks: {},
    hyphenate: true
  }, paragraph)


  p.textSize(_paragraph.font_size.px)
  p.textFont(_paragraph.font_family)
  p.textWeight(_paragraph.font_weight)

  /**@type ParagraphState*/
  let paragraph_state = {
    vertical_pos: _paragraph.y.px + p.textLeading(),
    word_count: 0,
  }

  if (_paragraph.rect) {
    p.noFill();
    p.strokeWeight(.5)
    p.stroke(_paragraph.stroke);
    p.rect(_paragraph.x.px, _paragraph.y.px, _paragraph.length.px, _paragraph.height.px);
  }

  p.noStroke();
  p.fill(_paragraph.color)
  let start_length = _paragraph.text.length

  while (_paragraph.text.length > 0 && paragraph_state.vertical_pos < _paragraph.y.px + _paragraph.height.px) {
    paragraph_state.word_count = start_length - _paragraph.text.length
    _paragraph.text = draw_line(
      p,
      _paragraph.text,
      _paragraph.x,
      { px: paragraph_state.vertical_pos },
      _paragraph.length,
      {
        paragraph: _paragraph,
        paragraph_state
      },
      _paragraph.hooks
    ).trim()
    paragraph_state.vertical_pos += _paragraph.leading.px
  }



  return _paragraph.text
}

class Scale {
  constructor(scale = 1) {
    this.dpi = window.devicePixelRatio * 96
    this.scale = scale / this.dpi
  }

  /**
  @param {Unit} unit1 
  @param {Unit} unit2 
  */
  add(unit1, unit2) {
    return this.px_raw(unit1.px + unit2.px)
  }

  /**
  @param {Unit} unit1 
  @param {Unit} unit2 
  */
  sub(unit1, unit2) {
    return this.px_raw(unit1.px - unit2.px)
  }

  /**
  @param {Unit} unit1 
  @param {number} unit2 
  */
  mul(unit1, unit2) {
    return this.px_raw(unit1.px * unit2)
  }

  /**
  @param {Unit} unit1 
  @param {Unit} unit2 
  */
  div(unit1, unit2) {
    return this.px_raw(unit1.px / unit2.px)
  }

  /**
  @param {number} value 
  @returns {Unit} 
  */
  em(value) {
    return {
      unit: "em",
      value,
      px: this.inch(value / 6).px
    }
  }

  /**
  @param {number} value 
  @returns {Unit} 
  */
  px(value) {
    return {
      unit: "pixel",
      value,
      px: value * this.scale
    }
  }

  /**
  @param {number} value 
  @returns {Unit} 
  */
  px_raw(value) {
    return {
      unit: "pixel",
      value,
      px: value
    }
  }

  pixel(value) { return this.px(value) }

  /**
  @param {number} value 
  @returns {Unit} 
  */
  inch(value) {
    return {
      unit: "inch",
      value,
      px: value * this.dpi * this.scale
    }
  }

  /**
  @param {number} value 
  @returns {Unit} 
  */
  pica(value) { return this.em(value) }
  picas(value) { return this.pica(value) }


  /**
  @param {number} value 
  @returns {Unit} 
  */
  point(value) {
    return {
      unit: "point",
      value,
      px: this.pica(value).px / 12
    }
  }
}

let s = new Scale(dpi)
class LinkedFrame {
  /**
  @param {ParagraphProps[]} [frames=[]] 
  @param {string} [text=""] 
  */
  constructor(text = "", frames = []) {
    this.frames = frames
    this.text = text
  }

  /**
  @param {ParagraphProps} frame 
  */
  add(frame) {
    this.frames.push(frame)
  }

  set_text(text) {
    this.text = text
  }

  /**
  @param {p5} p 
  @param {SpreadProps} props 
  */
  draw(p, props) {
    let text = this.text
    let count = 0
    /**@type {ParagraphProps}*/
    let last_props = { text: "" }

    while (text && count < this.frames.length) {
      let updated = this.frames[count]
      updated.text = text
      Object.assign(last_props, updated)

      text = draw_paragraph(p, last_props, props.structure)
      count++
    }

    return text
  }
}

/** 
@typedef {{
  margin: {
    top: Unit,
    bottom: Unit,
    inside: Unit,
    outside: Unit,
  }

  columns: number,
  gutter: Unit,
  
  hanglines: Unit[]
  page_width: Unit,
  page_height: Unit,
}} GridProps
*/
class Grid {
  /**
  @param {GridProps} props
  @param {Scale} s
  */
  constructor(props, s) {
    this.props = props
    this.s = s
  }

  hanglines() {
    return this.props.hanglines
  }

  set_margin(margin) {
    this.props.margin = margin
  }

  /**@returns {{x:Unit, y:Unit, w:Unit, h: Unit}[]}*/
  recto_columns() {
    /**@type {{x:Unit, y:Unit, w:Unit, h: Unit}[]}*/
    const cols = []

    for (let i = 0; i < this.props.columns; i++) {
      const y = this.props.margin.top
      const w = this.column_width()

      // outside + gutters + size
      const x = s.px_raw(this.half_page().x.px + this.props.margin.inside.px + i * this.props.gutter.px + i * this.column_width().px);
      const h = s.px_raw(this.props.page_height.px - (this.props.margin.top.px + this.props.margin.bottom.px))

      cols.push({ x, y, w, h })
    }

    return cols
  }

  /**@returns {{x:Unit, y:Unit, w:Unit, h: Unit}[]}*/
  verso_columns() {
    /**@type {{x:Unit, y:Unit, w:Unit, h: Unit}[]}*/
    const cols = []

    for (let i = 0; i < this.props.columns; i++) {
      const y = this.props.margin.top
      const w = this.column_width()

      // outside + gutters + size
      const x = s.px_raw(this.props.margin.outside.px + i * this.props.gutter.px + i * this.column_width().px);
      const h = s.px_raw(this.props.page_height.px - (this.props.margin.top.px + this.props.margin.bottom.px))

      cols.push({ x, y, w, h })
    }

    return cols
  }

  columns() { return [this.verso_columns(), this.recto_columns()] }

  /**@returns {Unit}*/
  column_width(n = 1) {
    let w = this.half_page().x.px - (this.props.margin.inside.px + this.props.margin.outside.px);
    let g = (n - 1) * this.props.gutter.px
    return s.px_raw(((w - (this.props.gutter.px * (this.props.columns - 1))) / this.props.columns) * n + g);
  }

  /**@returns {{x: Unit, y: Unit}}*/
  half_page() {
    return {
      x: s.px_raw(this.props.page_width.px / 2),
      y: s.px_raw(this.props.page_height.px / 2)
    }
  }
}

let offset_size = s.em(12)
let grid = new Grid({
  page_width: s.inch(10),
  page_height: s.inch(5),

  margin: {
    top: s.em(2),
    bottom: s.em(3),
    inside: s.em(1),
    outside: s.em(4),
  },

  columns: 8,
  gutter: s.point(6),
  hanglines: [
    s.em(6),
    s.em(6.5),
    s.em(12),
    s.em(12.5),
    s.em(18),
    s.em(18.5),
    s.em(24),
    s.em(24.5),
  ],
}, s)

/**
@typedef Drawable
@property {(p: p5, props: SpreadProps) => void} draw

@typedef {{
  structure: Grid,
  scale: Scale,
}} SpreadProps
*/
class Spread {
  /**
  @param {Grid} grid 
  @param {Scale} [scale=new Scale()] 
  @param {Drawable[]} [contents=[]] 
  */
  constructor(grid, scale = new Scale(), contents = []) {
    /**@type Scale*/
    this.s = scale
    /**@type Grid*/
    this.structure = grid
    /**@type Drawable[]*/
    this.contents = contents
  }

  setup(p) {
    // if needing to create canvas as well
  }

  draw(p) {
    this.contents.forEach(d => d.draw(p, this.props()))
  }

  draw_grid(p, no) {
    // -----------
    // draw grid
    // -----------
    let [recto, verso] = grid.columns()
    p.fill(0)
    p.textSize(this.s.point(9).px)
    p.textFont("monospace")
    p.textWeight(600)
    p.text("[ PAGE " + (no[0]) + " ]",
      this.structure.verso_columns()[0].x.px,
      this.structure.recto_columns()[3].y.px)
    p.text("[ PAGE " + (no[1]) + " ]",
      this.structure.recto_columns()[0].x.px,
      this.structure.recto_columns()[3].y.px)

    p.noFill()
    p.stroke(200, 0, 250)
    p.strokeWeight(.5)



    recto.forEach((col) => { p.rect(col.x.px, col.y.px, col.w.px, col.h.px) })
    verso.forEach((col) => { p.rect(col.x.px, col.y.px, col.w.px, col.h.px) })

    p.stroke(0, 0, 255)
    p.strokeWeight(.2)
    grid.hanglines().forEach(y => {
      p.line(0, y.px, p.width, y.px)
    })
  }


  /**@returns {SpreadProps}*/
  props() {
    return {
      scale: this.s,
      structure: this.structure
    }
  }

  /**
  @param {LinkedFrame} frame 
  */
  add_linked_frame(frame) {
    this.contents.push(frame)
  }

  // --------
  // Later
  // --------
  add_graphic() { }
}

class Book {
  /**
  @param {Spread[]} [spreads=[]] 
  @param {{draw_grid: boolean}=} opts
  */
  constructor(spreads = [], opts = { draw_grid: true }) {
    this.grid = opts.draw_grid
    this.structure = spreads[0] ? spreads[0].props().structure : undefined
    this.current_spread = 0
    /**@type Spread[]*/

    this.spreads = spreads
    this.offsets = []
  }

  saddle_pages() {
    // get pages
    let pages = this.pages()
    //let pages = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17]]
    if (!Array.isArray(pages)) return

    let last = pages.length - 1
    let pair = (i) => pages[last - i]
    let pairskiplast = (i) => pages[last - i - 1]

    let middle = Math.ceil(last / 2)

    // switch each recto with pair spread recto till middle
    for (let i = 0; i < middle; i++) {
      let f_verso = pages[i][0]
      let p_verso = pair(i)[0]

      pages[i][0] = p_verso
      pair(i)[0] = f_verso
    }


    let pairedup = []

    for (let i = 0; i < middle; i++) {
      pairedup.push(pages[i])
      pairedup.push(pairskiplast(i))
    }

    console.log(pairedup)

    return pairedup
  }

  // Will take sheet number, find pages in the sheet and mark it offset
  mark_sheet_offset(index) {
    if (!this.validate_spread(index)) return

    let spreads = this.saddle_pages()

    let sheet = spreads[index]
    let pair_index = isOdd(index) ? index - 1 : index + 1
    let pair = spreads[pair_index]

    sheet.forEach((e) => {
      if (this.offsets.findIndex(f => f == e) == -1) { this.offsets.push(e) }
    })

    pair.forEach((e) => {
      if (this.offsets.findIndex(f => f == e) == -1) { this.offsets.push(e) }
    })
  }

  // Will take page number and convert to sheet then mark it.
  mark_page_offset(page) {
    let spread = this.saddle_pages()
    let index = -1

    spread.forEach((e, i) => {
      e.forEach(pg => pg == page ? index = i : null)
    })

    this.mark_sheet_offset(index)
  }

  page_to_spread(num) {
    return Math.floor(num / 2)
  }

  get_page(num = 1) {
    let spread = this.page_to_spread(num)
    return this.spreads[spread]
  }

  set_spread(spread) {
    let valid = this.validate_spread(spread)
    if (!valid) return
    this.current_spread = spread
  }

  set_page(num) {
    let spread = this.page_to_spread(num)
    this.set_spread(spread)
  }

  validate_spread(spread) {
    if (this.spreads.length <= spread
      || spread < 0
    ) return false
    else return true
  }

  pages() {
    /**@type {[number, number][]}*/
    let arr = []
    let is_odd = (num) => (num % 2) == 1

    // also make sure number of spreads is odd
    // TOD0: if it isn't, add a spread before last page in booklet binding... 
    if (is_odd(this.spreads.length)) {
      this.spreads.forEach((_, i) => {
        let last = i == this.spreads.length - 1
        let first = i == 0
        let num = i * 2
        let recto = last ? 0 : num + 1
        let verso = num
        arr.push([verso, recto])
      })

      return arr
    }
    else {
      console.log("FUCK NOT MULTIPLE OF 4", (this.spreads.length * 2) - 2)
    }
  }

  /**@param {Spread} spread */
  add_spread(spread) {
    this.spreads.push(spread)
  }

  draw(p) {
    console.log("page drawing", this.current_spread)
    //if (this.grid) this.spreads[this.current_spread].draw_grid(p, this.pages()[this.current_spread])
    //this.spreads[this.current_spread].draw(p)
    this.draw_recto(p)
    this.draw_verso(p)
  }

  page_image(p, number) {
    let spread = this.page_to_spread(number)

    if (number % 2 == 1) return this.recto_image(p, spread)
    else return this.verso_image(p, spread)
  }

  /**
  @typedef {p5.Image} Image
  */
  verso_image(p, number, color = 255) {
    let _p = p.createGraphics(p.width, p.height)
    _p.background(color)
    if (this.grid) this.spreads[number].draw_grid(_p, [(number * 2), (number * 2) + 1])
    this.spreads[number].draw(_p)
    if (number == 0) _p.background(200)
    let img = _p.get(0, 0, _p.width / 2, _p.height)

    return img
  }

  recto_image(p, number, color = 255) {
    let _p = p.createGraphics(p.width, p.height)
    _p.background(color)
    if (this.grid) this.spreads[number].draw_grid(_p, [(number * 2), (number * 2) + 1])
    this.spreads[number].draw(_p)
    if (number == this.spreads.length - 1) _p.background(200)
    let img = _p.get(_p.width / 2, 0, _p.width / 2, _p.height)

    return img
  }


  draw_saddle_view(p) {
    let saddle = this.saddle_pages()
    if (!saddle) return

    let curr = saddle[this.current_spread]
    this.draw_page_set(p, curr[0], curr[1])
  }

  /**
  @param {Image} img  
  */
  draw_img(p, img, x = 0, y = 0) {
    p.image(img, x, y, img.width, img.height)
  }

  page_is_offset(page) {
    return this.offsets.includes(page)
  }

  draw_verso(p) {
    let page = this.current_spread * 2 - 1
    let includes = this.page_is_offset(page)
    let img = this.verso_image(p, this.current_spread)
    this.draw_img(p, img, 0, 0)
  }

  draw_recto(p) {
    let page = this.current_spread * 2
    let includes = this.page_is_offset(page)
    let img = this.recto_image(p, this.current_spread)
    this.draw_img(p, img, img.width, 0)
  }

  draw_page_set(p, num1, num2) {
    this.draw_img(p, this.page_image(p, num1))
    let recto = this.page_image(p, num2)
    this.draw_img(p, recto, recto.width)
  }

  seek(page) {
    this.set_page(page)
  }
}

class Paper {
  /**
   * @param {{width: Unit, height: Unit}} size 
   * @param {Scale} s 
   * @param {p5} p 
   * @param {Element} el 
   * */
  constructor(p, s, el, size, print = false) {
    this.setup(p, s, el)
    this.size = size
    this.scale = s
    this.p5 = p
    this.print = print
  }

  setup(p, s, el) {
    p.setup = () => {
      p.createCanvas(this.size.width.px, this.size.height.px);
      el.style.transform = "scale(" + (1 / s.scale) * viewport + ")"
    };

    p.draw = () => {
      p.background(200);
      p.noFill();
      p.noLoop()
    };
  }

  /**@param {Book} book */
  draw_book(book) {
    let p = this.p5
    p.background(200);

    let width = book.structure?.props.page_width
    let height = book.structure?.props.page_height
    let left = (this.size.width.px - width.px) / 2
    let top = (this.size.height.px - height.px) / 2

    let graphic = p.createGraphics(width.px, height.px)
    graphic.background(255)

    this.draw_crop_marks(book)

    let nextvisibleverso = (spread) => {
      let verso_page = spread * 2
      let verso_offset = book.page_is_offset(verso_page)
      let offset_pages = book.offsets

      let found = -100
      if (verso_offset) return found

      offset_pages.forEach(page => {
        if (!isOdd(page) &&
          page < verso_page) {

          // if diff is less then 
          let diff = Math.abs(verso_page - page)
          let diffAlready = Math.abs(verso_page - found)

          if (diff < diffAlready) found = page
        }
      })

      return found
    }

    let nextvisiblerecto = (spread) => {
      let recto_page = spread * 2 + 1
      let recto_offset = book.page_is_offset(recto_page)
      let offset_pages = book.offsets

      let found = -200
      if (recto_offset) return found

      offset_pages.forEach(page => {
        if (isOdd(page) &&
          page > recto_page) {
          // if diff is less then 
          let diff = Math.abs(recto_page - page)
          let diffAlready = Math.abs(recto_page - found)

          if (diff < diffAlready) found = page
        }
      })

      return found
    }


    let draw_verso = (graphic, spread, draw_behind = true) => {
      let verso_page = spread * 2
      let verso_offset = book.page_is_offset(verso_page)
      let verso_image = book.verso_image(graphic, spread, verso_offset ? "#ABE2F7" : 255)

      if (verso_offset && draw_behind) {
        draw_verso(graphic, spread - 1)
        p.opacity(.95)
      }

      p.image(verso_image, left, verso_offset ? top + (offset_size.px * offset_direction) : top, verso_image.width, verso_image.height)
      p.opacity(1)
    }


    let draw_recto = (graphic, spread, draw_behind = true) => {
      let recto_page = spread * 2 + 1
      let recto_offset = book.page_is_offset(recto_page)
      let recto_image = book.recto_image(graphic, spread, recto_offset ? "#ABE2F7" : 255)

      if (recto_offset && draw_behind) {
        draw_recto(graphic, spread + 1)
        p.opacity(.8)
      }

      p.image(recto_image, left + width.px / 2, recto_offset ? top + (offset_size.px * offset_direction) : top, recto_image.width, recto_image.height)
      p.opacity(1)
    }


    let visible_recto = nextvisiblerecto(book.current_spread)
    let visible_verso = nextvisibleverso(book.current_spread)

    if (visible_recto >= 0) draw_recto(graphic, book.page_to_spread(visible_recto), false)
    if (visible_verso >= 0) draw_verso(graphic, book.page_to_spread(visible_verso), false)

    draw_verso(graphic, book.current_spread)
    draw_recto(graphic, book.current_spread)
  }

  /**@param {Book} book */
  draw_crop_marks(book) {
    let p = this.p5

    let width = book.structure?.props.page_width
    let height = book.structure?.props.page_height
    let left = (this.size.width.px - width.px) / 2
    let top = (this.size.height.px - height.px) / 2

    // crop marks
    p.line(left, 0, left, top)
    p.line(0, top, left, top)

    p.line(p.width - left, 0, p.width - left, top)
    p.line(p.width, top, p.width - left, top)

    p.line(0, p.height - top, left, p.height - top)
    p.line(left, p.height, left, p.height - top)

    p.line(p.width, p.height - top, p.width - left, p.height - top)
    p.line(p.width - left, p.height, p.width - left, p.height - top)
  }

  /**@param {Book} book */
  draw_saddle(book) {
    let p = this.p5

    if (this.print) {
      p.background(255);
    } else {
      p.background(200);
    }
    let width = book.structure?.props.page_width
    let height = book.structure?.props.page_height

    let graphic = p.createGraphics(width.px, height.px)
    graphic.background(255)

    book.draw_saddle_view(graphic)
    this.draw_crop_marks(book)

    let left = (this.size.width.px - width.px) / 2
    let top = (this.size.height.px - height.px) / 2

    p.image(graphic, left, top, width.px, height.px)
    return graphic
  }
  /**@param {Book} book */
  draw_spread(book) { }

  /**@param {Book} book */
  save_saddle_spread(book) {
    // will draw saddle spread and download it
    let save = this.draw_saddle(book)
    this.p5.save("spread-" + book.current_spread + ".jpg")
  }
}


/**@type {p5}*/
let p


fetch("./quick.json")
  .then((res) => res.json())
  //.then((res) => data = res)
  .then(_ => init())


let oninit = []


/** @type {Paper} */
let paper
let pages
let printing = true

function init() {
  render(container, document.body)
  pages = data.contents.map((e) => spread_from_block(e, []))
  oninit.forEach(fn => typeof fn == "function" ? fn() : null)
}

oninit.push(() => {
  let el = document.querySelector(".q5")
  p = new p5('instance', el);

  // for export
  if (printing) {
    paper = new Paper(p, s, el, {
      width: s.inch(11),
      height: s.inch(8.5),
    }, true)
  }

  // for offset
  else {
    paper = new Paper(p, s, el, {
      width: s.inch(11),
      height: s.add(
        grid.props.page_height,
        s.px_raw(offset_size.px * 2.5)
      ),
    })
  }

  setTimeout(() => {
    paper.draw_book(book)
    //paper.draw_saddle(book)
  }, 100)
})

// x--------------------x
// *Header: Book
// x--------------------x
//
/**@type {Book}*/
let book
let page = 1
let offsets = [3]
let offset_direction = -1

oninit.push(() => {
  book = new Book(pages)
  offsets.forEach((e) => book.mark_page_offset(e))
  book.set_page(page)
})

class TextFrame {
  /**
   * @param {ParagraphProps} props 
   * @param {Grid} structure 
   * */
  constructor(text, props) {
    this.text = text
    this.props = props
  }

  draw(p, prop) {
    draw_paragraph(p, { text: this.text, font_size: s.point(7), ...this.props }, prop.structure)
  }
}

let saddle = sig(false)
let drawpaper = () => saddle() ?
  paper.draw_saddle(book) :
  paper.draw_book(book)

oninit.push(() => eff_on(saddle, drawpaper))
let pg = sig(0)
let container = () => html`
  <style>
    ${GlobalStyle}
  </style>

  <div class="container">
    <div class="q5"></div>

    <button 
    style="position:fixed;top:0;left:0"
    onclick=${() => {
    pg(book.current_spread + 1);
    book.set_spread(pg());
    drawpaper()
  }} >
      next
    </button>

    <p style="position:fixed;top:0;left:3em"> ${pg} </p>
    
    <button 
      style="position:fixed;top:2em;left:0"
      onclick=${() => {
    pg(book.current_spread - 1); book.set_spread(pg()); drawpaper()
  }} >
      prev
    </button>

    <button 
      style="position:fixed;top:4em;left:0"
      onclick=${() => saddle(!saddle())} >
      ${() => saddle() ? "display" : "print"}
    </button>
    
    <button 
      style="position:fixed;top:6em;left:0"
      onclick=${() => paper.save_saddle_spread(book)} >
      download
    </button>
  </div>
`

let style = {
  title: [
    ["font_family", "GapSansBlack"],
    ["length", ["column_width", 7]],
    ["font_size", ["point", 28]],
    ["leading", ["point", 38]],
    ["color", "#0000ff"],
  ],

  body: [
    ["font_family", "Arial Narrow"],
    ["font_size", ["point", 9]],
    ["leading", ["point", 12]],
    ["font_weight", 100],
    ["color", "black"],
  ],

  label: [
    ["font_family", "GapSansBold"],
    ["font_size", ["point", 18]],
    ["leading", ["point", 12]],
    ["color", "#ff00ff"],
  ]
}

let gridsystem_description = `The grid is a tool that sections out space, so that it can be made legible to a system. Working in an explicit environment where interaction with the composition happens declaratively (rather than moving stuff with a mouse), the grid renders pixel values legible and meaningful. In other words, the grid provides an easier and more meaningful access to the space. 

For instance, elements can be positioned and sized according to columns and/or hanglines.`

let cover = {
  title: "",
  content: [
    ["Header",
      ["text", "Structure of the Book"],
      ["height", ["em", 12]],
      ["x", ["recto", 0, "x"]],
      ["y", ["hangline", 3]],
    ],

    ["TextFrame",
      ["text", "This booklet describes the structure of its making."],
      ["length", ["column_width", 4]],
      ["height", ["em", 12]],
      ["x", ["recto", 2, "x"]],
      ["y", ["hangline", 3]],
      ...style.body
    ]
  ]
}

let the_grid = {
  title: "describes grid",
  content: [
    ["Header",
      ["text", "GRID {system}"],
      ["x", ["verso", 2, "x"]],
      ["y", ["hangline", 0]],
      ["length", ["column_width", 4]],
      ["height", ["em", 12]],
    ],

    // Translucent Rect
    ["Rect",
      ["x", ["verso", 1, "x"]],
      ["y", ["em", 10]],
      ["height", ["em", 18]],
      ["length", ["em", 12]],
      ["fill", "#22222222"],
    ],

    // Circles
    ...Array(12).fill(0).map((e, i) => {
      return ["Circle",
        ["x", ["verso", 3, "x"]],
        ["y", ["em", 4 + i * 1]],
        ["radius", ["em", 1 - (i / 18)]],
        ["stroke", "black"]
      ]
    }),

    // Circles
    ...Array(7).fill(0).map((e, i) => {
      return ["Circle",
        ["x", ["verso", 3, "x"]],
        ["y", ["em", 18 + i * 1.5]],
        ["radius", ["em", 1]],
        ["stroke", "black"]
      ]
    }),

    // Fun Arc
    ["Arc",
      ["x", ["verso", 2, "x"]],
      ["y", ["hangline", 1]],
      ["radius", ["em", 15]],
      ["stroke", "black"]
    ],

    // Description text
    ["LinkedFrame",
      gridsystem_description,
      [
        ["text", ""],
        ["x", ["verso", 0, "x"]],
        ["y", ["em", 15]],
        ["height", ["em", 6]],
        ["length", ["em", 12]],
        ...style.body
      ],

      [
        ["text", ""],
        ["x", ["verso", 4, "x"]],
        ["y", ["hangline", 5]],
        ["height", ["em", 8]],
        ["length", ["em", 12]],
        ...style.body
      ],
    ],

    ...["HANGLINE", "COLUMN", "UNIT"]
      .map((e, i) =>
        ["TextFrame",
          ["text", e],
          ["x", ["recto", i * 3, "x"]],
          ["y", ["hangline", 1]],
          ["height", ["em", 3]],
          ["length", ["column_width", 3]],
          ["rect", false],
          ...style.label
        ]
      ),

    ...[
      `[UNIT]
  manages conversion from units such as EMS, PICAS, POINTS, INCHES to pixel values. The values change based on viewport (zoom) size and DPI. 
  
  `,
      `[Hangline]
  helps place elements veritcally, it is set independantly of other grid attributes. It only requires a Y-axis value, which will be used to draw line from 0 to width on given y-value`,

      `[Columns]
  are calculated based on the inside and outside margin and the gutter. Total area for the grid can be calculated by subtracting margins from page size. This area is subtracted by total gutters (cols - 1) times gutter size. And the remaining area is divided by total columns`,]
      .map((e, i) =>
        ["TextFrame",
          ["text", e],
          ["x", ["recto", 2, "x"]],
          ["y", ["em", 12 + i * 5]],
          ["height", ["em", 12]],
          ["length", ["column_width", 6]],
          ["rect", false],
          ...style.body,
          ["color", "#444"],
          ["font_weight", "600"]
        ]
      )
  ]
}

let label_each = {
  title: "describes grid",
  content: [
    ["Header",
      ["text", "Hanglines"],
      ["x", ["verso", 2, "x"]],
      ["y", ["hangline", 5]],
      ["length", ["column_width", 4]],
      ["height", ["em", 12]],
    ],

    ["Header",
      ["text", "Columns"],
      ["x", ["recto", 2, "x"]],
      ["y", ["hangline", 5]],
      ["length", ["column_width", 4]],
      ["height", ["em", 12]],
    ],

    // Circles
    ...Array(12).fill(0).map((e, i) => {
      return ["Circle",
        ["x", ["verso", 3, "x"]],
        ["y", ["em", 18 + i * 1.5]],
        ["radius", ["em", 1]],
        ["stroke", "black"]
      ]
    }),

    // Fun Arc
    ...Array(8).fill(0).map((e, i) =>
      ["Arc",
        ["x", ["verso", i, "x"]],
        ["y", ["hangline", i]],
        ["radius", ["em", 2 + i * .5]],
        ["start", -i * 15],
        ["stop", 90],
        ["stroke", "#ff00ff"]
      ]),


    ...grid.hanglines()
      .map((e, i) =>
        ["TextFrame",
          ["text", "hangline --- "
            + e.value.toFixed(1)
            + " "
            + e.unit
            + ", "
            + e.px.toFixed(1)
            + " px"],
          ["x", ["verso", 3, "x"]],
          ["y", [e.unit, e.value]],
          ["height", ["em", 3]],
          ["length", ["column_width", 4]],
          ["rect", false],
          //...style.label
        ]
      ),

    ...grid.recto_columns()
      .map((e, i) =>
        ["TextFrame",
          ["text", "X --- "
            + e.x.value.toFixed(1)
            + " " + e.x.unit],
          ["x", ["recto", i, "x"]],
          ["y", [e.y.unit, e.y.value * (12 - (i))]],
          ["height", ["em", 3]],
          ["length", ["column_width", 1]],
          ["rect", false],
          //...style.label
        ]
      ),

    ...grid.recto_columns()
      .map((e, i) =>
        ["TextFrame",
          ["text", "Y --- " + e.y.value.toFixed(1) + " " + e.y.unit],
          ["x", ["recto", i, "x"]],
          ["y", [e.y.unit, e.y.value * (14 - (i))]],
          ["height", ["em", 3]],
          ["length", ["column_width", 1]],
          ["rect", false],
          //...style.label
        ]
      ),


  ]
}

let margin = {
  title: "describes grid",
  content: [
    ["Header",
      ["text", "Margin"],
      ["x", ["verso", 2, "x"]],
      ["y", ["hangline", 5]],
      ["length", ["column_width", 4]],
      ["height", ["em", 12]],
    ],

    // Circles
    ...Array(12).fill(0).map((e, i) => {
      return ["Circle",
        ["x", ["verso", 3, "x"]],
        ["y", ["em", 18 + i * 1.5]],
        ["radius", ["em", 1]],
        ["stroke", "black"]
      ]
    }),

    // Fun Arc
    ...Array(8).fill(0).map((e, i) =>
      ["Arc",
        ["x", ["verso", i, "x"]],
        ["y", ["hangline", i]],
        ["radius", ["em", 2 + i * 1.5]],
        ["start", -i * 12],
        ["stop", 110],
        ["stroke", "#ff00ff"]
      ]),

    // Fun Arc
    ...Array(6).fill(0).map((e, i) =>
      ["Arc",
        ["x", ["recto", i, "x"]],
        ["y", ["hangline", 6 - i]],
        ["radius", ["em", 2 + i * 2.5]],
        ["start", -i * 15],
        ["stop", 110],
        ["stroke", "#ff00ff"]
      ]),


    ...Object.entries(grid.props.margin)
      .map((e, i) =>
        ["TextFrame",
          ["text",
            e[0]
            + "--- "
            + e[1].value.toFixed(1)
            + " "
            + e[1].unit
            + ", "
            + e[1].px.toFixed(1)
            + " px"],
          ["x", ["verso", 3, "x"]],
          ["y", ["em", 6 * (i + 1)]],
          ["height", ["em", 3]],
          ["length", ["column_width", 4]],
          ["rect", false],
          //...style.label
        ]
      ),

    ["Rect",
      ["x", ["verso", 5, "x"]],
      ["y", ["hangline", 5]],
      ["height", ["point", 1]],
      ["length", ["column_width", 3]],
      ["fill", "#222"],
    ],

    ["Rect",
      ["x", ["recto", 0, "x"]],
      ["y", ["hangline", 1]],
      ["height", ["point", 1]],
      ["length", ["column_width", 4]],
      ["fill", "#222"],
    ],

    ["Header",
      ["text", "To grid or not to grid?"],
      ["x", ["recto", 0, "x"]],
      ["y", ["hangline", 1]],
      ["height", ["em", 18]],
      ["length", ["column_width", 4]],
      ["rect", true],
    ],

    ["LinkedFrame",
      `The grid is just one example of a system that makes a space addressable in another form. Software acts akin to a grid, where programs make legible memory addresses on the computer. A program will make addressable memory which can be processed and made sense of depending on the programs logics. Depending on how a grid is laid out and interacted with different processes are able to emerge from it. A grid is made one way, but it can as easily be made another way.`,
      [
        ["x", ["recto", 3, "x"]],
        ["y", ["hangline", 1]],
        ["height", ["em", 8]],
        ["length", ["column_width", 4]],
        ["rect", false],
        ...style.body
      ],

      [
        ["x", ["recto", 3, "x"]],
        ["y", ["hangline", 5]],
        ["height", ["em", 18]],
        ["length", ["column_width", 4]],
        ["rect", false],
        ...style.body,
        ["font_weight", 600]
      ]

    ],

  ]
}

let empty = {
  title: "describes grid",
  content: []
}

page = 6

// x-----------------------x
// *Header: Data
// x-----------------------x
let data = {
  contents: [
    cover,
    the_grid,
    label_each,
    margin,
    empty,
  ]
}

// x-----------------------x
// *Header: Instruction sheet
// x-----------------------x
//
// ["recto", 2, "x"]
// ["verso", 2, "x"]
let process_verso = (prop) => (grid) => {
  let index = Math.floor(prop[1])
  let diff = prop[1] - index
  let offset = s.mul(grid.column_width(1), diff)
  return s.add(grid.verso_columns()[index][prop[2]], offset)
}
let process_recto = (prop) => (grid) => {
  let index = Math.floor(prop[1])
  let diff = prop[1] - index
  let offset = s.mul(grid.column_width(1), diff)
  return s.add(grid.recto_columns()[index][prop[2]], offset)
}
let process_column_width = (prop) => (grid) => grid.column_width(prop[1])

// ["hangline", 2]
let process_hangline = (prop) => (grid) => grid.hanglines()[prop[1]]

// ["em", 2]
let process_em = (prop) => s.em(prop[1])
let process_inch = (prop) => s.inch(prop[1])
let process_point = (prop) => s.point(prop[1])
let process_px = (prop) => s.px(prop[1])
let process_pica = (prop) => s.pica(prop[1])

let process_add = (prop) => s.add(prop[1], prop[2])
let process_mul = (prop) => s.mul(prop[1], prop[2])
let process_sub = (prop) => s.sub(prop[1], prop[2])
let process_div = (prop) => s.div(prop[1], prop)

/**
 * @param {(any[] | number | string)} property
 */
let process_property = (property) => {
  if (Array.isArray(property)) {
    if (property[0] == "hangline") return process_hangline(property)
    if (property[0] == "verso") return process_verso(property)
    if (property[0] == "recto") return process_recto(property)
    if (property[0] == "column_width") return process_column_width(property)

    // units
    if (property[0] == "em") return process_em(property)
    if (property[0] == "inch") return process_inch(property)
    if (property[0] == "px") return process_px(property)
    if (property[0] == "pica") return process_pica(property)
    if (property[0] == "point") return process_point(property)

    // math
    if (property[0] == "add") return process_add(property)
    if (property[0] == "sub") return process_sub(property)
    if (property[0] == "mul") return process_mul(property)
    if (property[0] == "div") return process_div(property)
  }

  else return property
}

let reduceprops = (props) => props.reduce((acc, tuple) => {
  let key = tuple[0]
  let value = tuple[1]
  acc[key] = process_property(value)
  return acc
}, {})


// x-----------------------x
// *Header: Spread from block
// x-----------------------x
//
/**
 * @typedef {("Header" | "Rect" | "Body")} ContentType
 * @typedef {(ContentType | Property)[]} Content
 * @typedef {[string, (number | string | Property)]} Property
 *
 * @param {{
 *  content: Content,
 *  title: string,
 * }} block 
 * */
function spread_from_block(block, extensions = []) {
  /**
   * @param {Property[]} props
   * */
  let process_header = (props) => {
    let p = reduceprops(props)
    return Header(p["text"] ? p["text"] : "", p)
  }

  /**
   * @param {Property[]} props
   * */
  let process_textframe = (props) => {
    let p = reduceprops(props)
    return new TextFrame(p["text"] ? p["text"] : "", p)
  }

  /**
   * @param {Property[]} props
   * */
  let process_linked = (props) => {
    let tframes = props.slice(1).map(e => reduceprops(e))
    return new LinkedFrame(props[0], tframes)
  }

  let contents = block.content.map((item) => {
    if (item[0] == "Header") return process_header(item.slice(1))
    if (item[0] == "TextFrame") return process_textframe(item.slice(1))
    if (item[0] == "LinkedFrame") return process_linked(item.slice(1))
    if (item[0] == "Rect") return rect(reduceprops(item.slice(1)))
    if (item[0] == "Circle") return circle(reduceprops(item.slice(1)))
    if (item[0] == "Arc") return arc(reduceprops(item.slice(1)))
  })


  return new Spread(grid, s, [...contents, ...extensions])
}

const rect = ({ x, y, length, height, fill, stroke, strokeWeight }) => {
  console.log({ x, y, length, height, fill, stroke, strokeWeight })
  return {
    draw: (p, props) => {
      fill ? p.fill(fill) : p.noFill()
      stroke ? p.stroke(stroke) : p.noStroke()
      strokeWeight ? p.strokeWeight(strokeWeight) : null

      if (typeof x == "function") x = x(props.structure)
      if (typeof y == "function") y = y(props.structure)
      if (typeof length == "function") length = length(props.structure)
      if (typeof height == "function") height = height(props.structure)

      p.rect(x.px, y.px, length.px, height.px)
    }
  }
}

const circle = ({ x, y, radius, fill, stroke, strokeWeight }) => {
  return {
    draw: (p, props) => {
      fill ? p.fill(fill) : p.noFill()
      stroke ? p.stroke(stroke) : p.noStroke()
      strokeWeight ? p.strokeWeight(strokeWeight) : null

      if (typeof x == "function") x = x(props.structure)
      if (typeof y == "function") y = y(props.structure)
      if (typeof radius == "function") radius = radius(props.structure)

      p.circle(x.px, y.px, radius.px)
    }
  }
}

const arc = ({ x, y, radius, start = 0, stop = 180, fill, stroke, strokeWeight }) => {
  return {
    draw: (p, props) => {
      fill ? p.fill(fill) : p.noFill()
      stroke ? p.stroke(stroke) : p.noStroke()
      strokeWeight ? p.strokeWeight(strokeWeight) : null

      if (typeof x == "function") x = x(props.structure)
      if (typeof y == "function") y = y(props.structure)
      if (typeof radius == "function") radius = radius(props.structure)

      p.arc(x.px, y.px, radius.px, radius.px, start, stop)
    }
  }
}

const graphic = () => {
  let r = Math.random() * 12
  let f = Math.random() * 28
  let at = Math.random() + .5
  let ot = Math.random()
  return {
    draw: (p, props) => {
      p.noFill()
      p.stroke(0, 0, 255)

      p.strokeWeight(1)
      p.arc(s.em(18).px
        , s.em(f + r).px
        , s.em(r * 2 + 8).px
        , s.em(r * 2 + 8).px
        , ot
        , at
      )

      p.strokeWeight(.5)
      p.circle(s.em(8).px,
        s.em(18).px,
        s.em(r * at).px,
      )
    }
  }
}


function Header(text, para) {
  text = decodeHTML(text)
  let propies = reduceprops(style.title)
  /**@type {Drawable}*/
  let drawable = {
    draw: (p, props) => draw_paragraph(p, {
      text: text,
      color: "blue",
      rect: true,
      hyphenate: false,

      ...propies,
      ...para
    }, props.structure)
  }

  return drawable
}



const decodeHTML = function(str) {
  var map = {
    quot: '"',
    amp: "&",
    lt: "<",
    gt: ">",
    OElig: "Œ",
    oelig: "œ",
    Scaron: "Š",
    scaron: "š",
    Yuml: "Ÿ",
    circ: "ˆ",
    tilde: "˜",
    ensp: " ",
    emsp: " ",
    thinsp: " ",
    zwnj: "‌",
    zwj: "‍",
    lrm: "‎",
    rlm: "‏",
    ndash: "–",
    mdash: "—",
    lsquo: "‘",
    rsquo: "’",
    sbquo: "‚",
    ldquo: "“",
    rdquo: "”",
    bdquo: "„",
    dagger: "†",
    Dagger: "‡",
    permil: "‰",
    lsaquo: "‹",
    rsaquo: "›",
    fnof: "ƒ",
    Alpha: "Α",
    Beta: "Β",
    Gamma: "Γ",
    Delta: "Δ",
    Epsilon: "Ε",
    Zeta: "Ζ",
    Eta: "Η",
    Theta: "Θ",
    Iota: "Ι",
    Kappa: "Κ",
    Lambda: "Λ",
    Mu: "Μ",
    Nu: "Ν",
    Xi: "Ξ",
    Omicron: "Ο",
    Pi: "Π",
    Rho: "Ρ",
    Sigma: "Σ",
    Tau: "Τ",
    Upsilon: "Υ",
    Phi: "Φ",
    Chi: "Χ",
    Psi: "Ψ",
    Omega: "Ω",
    alpha: "α",
    beta: "β",
    gamma: "γ",
    delta: "δ",
    epsilon: "ε",
    zeta: "ζ",
    eta: "η",
    theta: "θ",
    iota: "ι",
    kappa: "κ",
    lambda: "λ",
    mu: "μ",
    nu: "ν",
    xi: "ξ",
    omicron: "ο",
    pi: "π",
    rho: "ρ",
    sigmaf: "ς",
    sigma: "σ",
    tau: "τ",
    upsilon: "υ",
    phi: "φ",
    chi: "χ",
    psi: "ψ",
    omega: "ω",
    thetasym: "ϑ",
    upsih: "ϒ",
    piv: "ϖ",
    bull: "•",
    hellip: "…",
    prime: "′",
    Prime: "″",
    oline: "‾",
    frasl: "⁄",
    weierp: "℘",
    image: "ℑ",
    real: "ℜ",
    trade: "™",
    alefsym: "ℵ",
    larr: "←",
    uarr: "↑",
    rarr: "→",
    darr: "↓",
    harr: "↔",
    crarr: "↵",
    lArr: "⇐",
    uArr: "⇑",
    rArr: "⇒",
    dArr: "⇓",
    hArr: "⇔",
    forall: "∀",
    part: "∂",
    exist: "∃",
    empty: "∅",
    nabla: "∇",
    isin: "∈",
    notin: "∉",
    ni: "∋",
    prod: "∏",
    sum: "∑",
    minus: "−",
    lowast: "∗",
    radic: "√",
    prop: "∝",
    infin: "∞",
    ang: "∠",
    and: "⊥",
    or: "⊦",
    cap: "∩",
    cup: "∪",
    int: "∫",
    there4: "∴",
    sim: "∼",
    cong: "≅",
    asymp: "≈",
    ne: "≠",
    equiv: "≡",
    le: "≤",
    ge: "≥",
    sub: "⊂",
    sup: "⊃",
    nsub: "⊄",
    sube: "⊆",
    supe: "⊇",
    oplus: "⊕",
    otimes: "⊗",
    perp: "⊥",
    sdot: "⋅",
    lceil: "⌈",
    rceil: "⌉",
    lfloor: "⌊",
    rfloor: "⌋",
    lang: "〈",
    rang: "〉",
    loz: "◊",
    spades: "♠",
    clubs: "♣",
    hearts: "♥",
    diams: "♦",
    nbsp: " ",
    iexcl: "¡",
    cent: "¢",
    pound: "£",
    curren: "¤",
    yen: "¥",
    brvbar: "¦",
    sect: "§",
    uml: "¨",
    copy: "©",
    ordf: "ª",
    laquo: "«",
    not: "¬",
    shy: "­",
    reg: "®",
    macr: "¯",
    deg: "°",
    plusmn: "±",
    sup2: "²",
    sup3: "³",
    acute: "´",
    micro: "µ",
    para: "¶",
    middot: "·",
    cedil: "¸",
    sup1: "¹",
    ordm: "º",
    raquo: "»",
    frac14: "¼",
    frac12: "½",
    frac34: "¾",
    iquest: "¿",
    Agrave: "À",
    Aacute: "Á",
    Acirc: "Â",
    Atilde: "Ã",
    Auml: "Ä",
    Aring: "Å",
    AElig: "Æ",
    Ccedil: "Ç",
    Egrave: "È",
    Eacute: "É",
    Ecirc: "Ê",
    Euml: "Ë",
    Igrave: "Ì",
    Iacute: "Í",
    Icirc: "Î",
    Iuml: "Ï",
    ETH: "Ð",
    Ntilde: "Ñ",
    Ograve: "Ò",
    Oacute: "Ó",
    Ocirc: "Ô",
    Otilde: "Õ",
    Ouml: "Ö",
    times: "×",
    Oslash: "Ø",
    Ugrave: "Ù",
    Uacute: "Ú",
    Ucirc: "Û",
    Uuml: "Ü",
    Yacute: "Ý",
    THORN: "Þ",
    szlig: "ß",
    agrave: "à",
    aacute: "á",
    acirc: "â",
    atilde: "ã",
    auml: "ä",
    aring: "å",
    aelig: "æ",
    ccedil: "ç",
    egrave: "è",
    eacute: "é",
    ecirc: "ê",
    euml: "ë",
    igrave: "ì",
    iacute: "í",
    icirc: "î",
    iuml: "ï",
    eth: "ð",
    ntilde: "ñ",
    ograve: "ò",
    oacute: "ó",
    ocirc: "ô",
    otilde: "õ",
    ouml: "ö",
    divide: "÷",
    oslash: "ø",
    ugrave: "ù",
    uacute: "ú",
    ucirc: "û",
    uuml: "ü",
    yacute: "ý",
    thorn: "þ",
    yuml: "ÿ",
  };
  return str.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);?/gi, function($0, $1) {
    if ($1[0] === "#") {
      return String.fromCharCode(
        $1[1].toLowerCase() === "x"
          ? parseInt($1.substr(2), 16)
          : parseInt($1.substr(1), 10),
      );
    } else {
      return map.hasOwnProperty($1) ? map[$1] : $0;
    }
  });
};

/**
@typedef {{
  vertical_pos: number,
  word_count: number,
}} ParagraphState

@typedef {{
  line_state: LineState,
  paragraph_state: ParagraphState,
  paragraph: Paragraph,
  p: p5
}} ParagraphHookProps

@typedef {{ 
  beforeHyphenate?: (props: ParagraphHookProps) => void 
  afterHyphenate?: (props: ParagraphHookProps) => void 
  beforeWord?: (props: ParagraphHookProps) => void 
  afterWord?: (props: ParagraphHookProps) => void 
  beforeLine?: (props: ParagraphHookProps) => void
  afterLine?: (props: ParagraphHookProps) => void
}} ParagraphHooks

@typedef {(grid: Grid) => Unit} GridUnit

@typedef {{
  text: string,
  length: Unit,
  font_family: any,
  font_weight: number,
  leading: Unit,
  font_size: Unit,
  height: Unit,
  color: string,
  stroke: string,
  x: Unit,
  y: Unit,
  rect: boolean,
  hyphenate: boolean,
  hooks: ParagraphHooks
}} Paragraph


@typedef {{
  hyphenate?: boolean,
  text?: string,
  font_family?: any,
  font_weight?: number,
  leading?: Unit,
  font_size?: Unit,
  length?: Unit | GridUnit,
  height?: Unit | GridUnit,
  x?: Unit | GridUnit,
  y?: Unit | GridUnit,
  color?: string,
  stroke?: string,
  rect?: boolean,
  hooks?: ParagraphHooks
}} ParagraphProps

@typedef {("inch" | "pica" | "point" | "em" | "pixel")} UnitType
@typedef {{
  unit?: UnitType,
  value?: number,
  px: number
}} Unit

*/


/**
 *
 * @typedef {{
 *   horizontal_pos: number,
 *   word_count: number,
 *   hyphen_leftover: "",
 *   space_size: number,
 * }} LineState
 *
 * @typedef {{ 
 *   beforeHyphenate: (props: ParagraphHookProps) => void 
 *   afterHyphenate: (props: ParagraphHookProps) => void 
 *   beforeWord: (props: ParagraphHookProps) => void 
 *   afterWord: (props: ParagraphHookProps) => void 
 * }} LineHooks
 *
 * @typedef {{
 *   paragraph_state: ParagraphState,
 *   paragraph: Paragraph,
 * }} ParentState
 ** */
