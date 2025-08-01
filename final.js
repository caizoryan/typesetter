import { sig, mem, render, HTML as html, eff_on } from "/lib/chowk/monke.js"
import { hyphenateSync } from "/lib/hyphenator/hyphenate.js"
import { Q5 as p5 } from "/lib/q5/q5.js"

const isOdd = num => num % 2 == 1;
let dpi = 100
let viewport = .4

const GlobalStyle = `
  @font-face {
    font-family: "Oracle";
    src: url("/fs/fonts/ABCOracle.ttf");
  }

  @font-face {
    font-family: "OracleTriple";
    src: url("/fs/fonts/OracleTriple.ttf");
  }

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
let funky_hyphens = false
let color_hyphens = false

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
  if (text.charAt(0) == `\n`) {
    return text.slice(1)
  }
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


    let hyphenated
    if (funky_hyphens) {
      hyphenated = word.split("")
    } else {
      hyphenated = hyphenateSync(word, {
        hyphenChar: "---((---))---"
      }).split("---((---))---")
    }

    console.log(hyphenated)

    // try to put first of hyphenated in...
    /**@type {number[]}*/
    let sizes = hyphenated.map(e => p.textWidth(e))
    let already = line_state.horizontal_pos
    //let lexeme = hyphenated.shift()
    let condition = () => {
      let cur_size = sizes
        .slice(0, count + 1)
        .reduce((sum, a) => sum += a, 0)
      return already + cur_size < length.px
    }

    let count = 0
    while (condition()) { count++ }

    //let word_len = p.textWidth(lexeme)

    if (count == 0) return false
    else {
      let remainder = hyphenated.slice(count).join("")
      let word = hyphenated.slice(0, count).join("")
      let _fill = p.ctx.fillStyle
      //
      if (color_hyphens) p.fill(p.color("red"))
      p.text(word + "-", x.px + line_state.horizontal_pos, y.px)
      p.fill(_fill)
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

    //if (typeof hooks?.beforeWord == "function") hooks?.beforeWord(props())
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

  return line_state.hyphen_leftover ? line_state.hyphen_leftover + " " + words + end_lines : words + end_lines
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
    )
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
    p.strokeWeight(.2)



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

    // pair spreads up with each other
    for (let i = 0; i < middle; i++) {
      pairedup.push(pages[i])
      pairedup.push(pairskiplast(i))
    }

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
    p.preload = () => {
      saddle_stich_img = p.loadImage("/fs/fonts/saddle_stitch.png")
      front_img = p.loadImage("/fs/fonts/front.png")
      introduction_img = p.loadImage("/fs/fonts/introduction.png")
      translation_img = p.loadImage("/fs/fonts/translation.png")
      saddle_one = p.loadImage("/fs/fonts/saddle_one.png")
      saddle_two = p.loadImage("/fs/fonts/saddle_two.png")
    }
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
let printing = false

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
let offsets = [6, 15]
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
    ["font_family", "Oracle"],
    ["font_size", ["point", 9]],
    ["leading", ["point", 12]],
    ["font_weight", 500],
    ["color", "black"],
  ],

  metadata: [
    ["font_family", "OracleTriple"],
    ["font_size", ["point", 7]],
    ["font_weight", 300],
    ["leading", ["point", 12]],
    ["color", "#ff00ff"],
  ],

  label: [
    ["font_family", "OracleTriple"],
    ["font_size", ["point", 18]],
    ["font_weight", 600],
    ["leading", ["point", 12]],
    ["color", "#00000066"],
  ]
}

let introduction = `This writing is a culmination of reflections that have steered and progressed my study over the course of the past 2 semesters. The investigation has been into at reframing design process as execution of graphic processes that are iterated and reflected upon over the course. The emphasis on graphic processes is to reveal conventional processes as being only one form out of many for engaging with a design practice, be it a technique, material, software, hardware or language, each can be bifurcated over and over till its altered into something new.`

// x------------------x
// *Header: Cover
// x------------------x
let cover = {
  title: "",
  content: [
    ["Header",
      ["text", "BOOKLET"],
      ["height", ["em", 12]],
      ["x", ["recto", 3, "x"]],
      ["y", ["hangline", 3]],
      //["color", "#0000ffaa"]
    ],

    ["TextFrame",
      ["text", "as {software}"],
      ["x", ["recto", 3, "x"]],
      ["y", ["recto", 0, "y"]],
      ["height", ["em", 8]],
      ["length", ["column_width", 3.5]],
      ["rect", false],
      ...style.label,
    ],

    ["TextFrame",
      ["text", introduction],
      ["length", ["column_width", 4]],
      ["height", ["em", 18]],
      ["x", ["recto", 2, "x"]],
      ["y", ["hangline", 1]],
      ...style.body
    ]
  ]
}


// x------------------x
// *Header: Structure
// x------------------x
let structure_writing = `In the following writing I will be focusing on software as that has been my focus over the past semester. The writing is set up in 3 parts enterlacing sections of technical implementations that form the booklet and the tool the booklet was designed in, first I frames a language of graphic processes, then I elaborate on that by showing language changes and is not altered when crossing material thresholds (virtual and physical) and concluding with software implementation as a form of interpretive note-taking.`
let graphic_processes_first = `Graphic software such as Photoshop or InDesign function by taking a vocabulary of primitive graphic processes (such as drawing pixels to canvas, text rendering, blend modes) and chaining them to form ‘tools’ in a context (‘documents’). These processes do not exist solely in Adobe tools and definitely do not belong to them. 
Graphic processes are abstract processes that can be made sense of by creating a system of relations.`

let graphicprocesses = [
  ["Header",
    ["text", "Language of Graphic Processes"],
    ["x", ["recto", 3, "x"]],
    ["y", ["hangline", 1]],
    ["height", ["em", 18]],
    ["length", ["column_width", 5]],
    ["rect", false],
  ],

  // Translucent Rect
  ...Array(22).fill(0).map((e, index) => {
    return ["Rect",
      ["x", ["recto", 2, "x"]],
      ["y", ["hangline", 1 + index / 15]],
      ["height", ["em", .5]],
      ["length", ["em", 9]],
      ["fill", "#ff00ff88"],
    ]
  }),
  //
  ...Array(22).fill(0).map((e, index) => {
    return ["Rect",
      ["x", ["recto", 2, "x"]],
      ["y", ["hangline", 3 + index / 10]],
      ["height", ["em", .5]],
      ["length", ["em", 9]],
      ["fill", "#ffffff88"],
    ]
  }),

  ...Array(12).fill(0).map((e, index) => {
    return ["Circle",
      ["x", ["recto", 2 + index / 3, "x"]],
      ["y", ["hangline", 3]],
      ["radius", ["em", 6]],
      ["stroke", "white"]
    ]
  }),

  ["Rect",
    ["x", ["recto", 2, "x"]],
    ["y", ["recto", 1.5, "y"]],
    ["height", ["em", 12]],
    ["length", ["em", 6]],
    ["fill", "#22222222"],
  ],

  ["TextFrame",
    ["text", "as {language}"],
    ["x", ["recto", 3, "x"]],
    ["y", ["recto", 0, "y"]],
    ["height", ["em", 8]],
    ["length", ["column_width", 3.5]],
    ["rect", false],
    ...style.label,
  ],

  ["LinkedFrame",
    graphic_processes_first,
    [
      ["x", ["recto", 0, "x"]],
      ["y", ["hangline", 1]],
      ["length", ["column_width", 4]],
      ["height", ["em", 8]],
      ...style.body
    ],
    [
      ["y", ["hangline", 5]],
      ["length", ["column_width", 4]],
    ]
  ],
]

let structure_graphic = {
  title: "",
  content: [
    ["Header",
      ["text", "INTRODUCTION"],
      ["x", ["verso", 2, "x"]],
      ["y", ["hangline", 0]],
      ["length", ["column_width", 6]],
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
      structure_writing,
      [
        ["text", ""],
        ["x", ["verso", 0, "x"]],
        ["y", ["hangline", 1.85]],
        ["height", ["em", 12]],
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

    ...graphicprocesses

  ]
}

let finish = `In this above example, the primitive process of drawing text to a pixel position has been chained with a system of typographic vocabulary, or rather a program and its properties have been made addressable through language. This is the crux of what software is, an organization of memory that serves a purpose. If a graphic language has been employed to create Adobe software, it is one instance of that and, a constrained one at that. More so, it is a language that seeks to overwrite all other forms of languages through its predatory monopolistic practices.
My point in framing graphic processes as language has been to show that programs are malleable, the message and medium of programs is malleability. The ones we use today are made a certain way but can potentially be made another way. 
Development of another monolithic software suite however is only going to recreate the same rigidity already existing in the Adobe suite. I am instead proposing, we start by looking at programs for what they are — a set of graphic process organized by a certain vocabulary that provides a context and affordances. And then we might be able to envision an alternative that doesn’t seek to be one stop solution for all graphic production requirements, but rather a workflow that can interop with other workflows, programs and processes.`

let grid_label = `[Elements on these spreads are positioned and sized according to columns and hanglines]`
let grid_intro = `The typographic grid is a tool that sections out space, so that it can be made legible to a system. Working in an explicit environment where interaction with the composition happens declaratively (rather than moving stuff with a mouse), the grid renders pixel values legible and meaningful. In other words, the grid provides an easier and more meaningful access to the space.`

let gridstructure = [
  ["Header",
    ["text", "STRUCTURE"],
    ["x", ["recto", 3, "x"]],
    ["y", ["hangline", 1]],
    ["height", ["em", 8]],
    ["length", ["column_width", 5]],
    ["rect", false],
  ],

  ...grid.hanglines()
    .map((e, i) =>
      ["TextFrame",
        ["text", "[HANGLINE]  "
          + e.value.toFixed(1)
          + " "
          + e.unit
          + ", "
          + e.px.toFixed(1)
          + " px"],
        ["x", ["recto", 1, "x"]],
        ["y", [e.unit, e.value]],
        ["height", ["em", 1]],
        ["length", ["column_width", 4]],
        ["rect", false],
        ...style.metadata
      ]
    ),

  ["TextFrame",
    ["text", "as {grid}"],
    ["x", ["recto", 3, "x"]],
    ["y", ["hangline", 3.3]],
    ["height", ["em", 8]],
    ["length", ["column_width", 5]],
    ["rect", false],
    ...style.label
  ],


  ["TextFrame",
    ["text", grid_intro],
    ["x", ["recto", 0, "x"]],
    ["y", ["hangline", 5]],
    ["height", ["em", 8]],
    ["length", ["column_width", 8]],
    ["rect", false],
    ...style.body
  ],


  ["Rect",
    ["x", ["recto", 0, "x"]],
    ["y", ["hangline", 3.3]],
    ["height", ["em", 4]],
    ["length", ["column_width", 3]],
    ["fill", "blue"]
  ],

  ["TextFrame",
    ["text", grid_label],
    ["x", ["recto", 0, "x"]],
    ["y", ["hangline", 3.3]],
    ["height", ["em", 8]],
    ["length", ["column_width", 3]],
    ["rect", false],
    ...style.metadata,
    ["font_weight", 800],
    ["color", "yellow"]
  ],
]

let grid_text = `The typographic grid is one example of a system that makes a space addressable in another form. Programs act as grids, where programs make legible memory addresses on the computer. A program will make memory addressable, which can be processed and made sense of depending on the programs logics. Depending on how a grid is laid out and interacted with different processes are able to emerge from it. A grid is made one way, but it can as easily be made another way.`
let graphic_processes = {
  title: "",
  content: [

    ["LinkedFrame",
      finish,
      [
        ["x", ["verso", 0, "x"]],
        ["y", ["verso", 0, "y"]],
        ["length", ["column_width", 4]],
        ["height", ["em", 24]],
        ...style.body
      ],
      [
        ["x", ["verso", 4, "x"]],
      ]
    ],
    ...gridstructure
  ]
}

let for_instance = `For instance, rendering text on the screen itself has no value other than being able to see the text on a screen. However consider the drawing of text starting at a fixed point and stoping at another fixed point and then continuing at a calculated position — this can be considered a basic typesetting program. The text stops drawing at the line length. Next position is calculated using the value of leading or line length. `
let above_example = `In this above example, the primitive process of drawing text to a pixel position has been chained with a system of typographic vocabulary, or rather a program and its properties have been made addressable through language. This is the crux of what software is, an organization of memory that serves a purpose. If a graphic language has been employed to create Adobe software, it is one instance of that and, a constrained one at that. More so, it is a language that seeks to overwrite all other forms of languages through its predatory monopolistic practices.`
let instance_example = {
  title: "",
  content: [

    ["Image",
      ["src", () => saddle_one],
      ["x", ["verso", 0, "x"]],
      ["y", ["hangline", 0]],
      ["width", ["column_width", 8]],
      ["height", ["em", 4.5]],
    ],

    ...grid.recto_columns()
      .map((e, i) =>
        ["TextFrame",
          ["text", "[" + (i + 1) + "]" +
            + e.x.value.toFixed(1)
            + " " + e.x.unit],
          ["x", ["verso", i, "x"]],
          ["y", [e.y.unit, e.y.value]],
          ["height", ["em", 3]],
          ["length", ["column_width", 1]],
          ["rect", false],
          ...style.metadata
        ]
      ),


    ["TextFrame",
      ["text", grid_text],
      ["x", ["verso", 0, "x"]],
      ["y", ["hangline", 5]],
      ["height", ["em", 8]],
      ["length", ["column_width", 8]],
      ["rect", false],
      ...style.body
    ],
    ["LinkedFrame",
      for_instance,
      [
        ["x", ["recto", 0, "x"]],
        ["y", ["recto", 0, "y"]],
        ["length", ["column_width", 4]],
        ["height", ["em", 8.5]],
        ...style.body
      ],
      [
        ["x", ["recto", 4, "x"]],
      ]
    ],

    ["LinkedFrame",
      above_example,
      [
        ["x", ["recto", 0, "x"]],
        ["y", ["hangline", 5]],
        ["length", ["column_width", 4]],
        ["height", ["em", 8.5]],
        ...style.body
      ],
      [
        ["x", ["recto", 4, "x"]],
        ["height", ["em", 10.5]],
        ["length", ["column_width", 4.1]],
      ]
    ],
  ]
}

let translationintro = `I have been specifically talking about a language of digital, although it is critical to note, this language is a borrowed language. Grids existed before computers were invented, so did leading, page numbers, units. These concepts were translated across the threshold of the physical into a digital implementation. 
Translation, does not mean making the same concept expressible through another language, rather it is creating a *new* counterpart that can be expressed in another language. We do not work through tools or communicate through languages, we work in them, bounded and constrained within the affordances provided to us by them.
`
let translationoutro = `Crossing translation thresholds, from physical to digital, to implement a book, a grid, a paragraph or any such concept requires labour which produces something new, the implemented artifact but also an altered understanding of what has been translated.`

let saddle_stich_img
let front_img, introduction_img, translation_img
let saddle_one, saddle_two

let saddle_stich_begin = `A booklet is designed spread by spread in a page layout software. This spread by spread design is then taken and put through an imposition software (or InDesign’s print booklet) that reorders the pages 
[see above pg. 6 to pg 9 transition]
to be turned into a form that can be stacked to form a booklet. 
[see pg. 10] ------ This process translates virtual spreads into a physical booklet abiding order. In attempting to implement this algorithm, I found visible patterns and rules that emerged from the booklet form.`

let translationstart = {
  title: "",
  content: [

    ["Header",
      ["text", "TRANSLATION"],
      ["x", ["verso", 3, "x"]],
      ["y", ["hangline", 1]],
      ["height", ["em", 18]],
      ["length", ["column_width", 8]],
      ["rect", false],
    ],

    ["Header",
      ["text", "BOOKLET"],
      ["x", ["recto", 3, "x"]],
      ["y", ["hangline", 5]],
      ["height", ["em", 18]],
      ["length", ["column_width", 8]],
      ["rect", false],
    ],

    ["Image",
      ["src", () => saddle_two],
      ["x", ["recto", 0, "x"]],
      ["y", ["hangline", 0]],
      ["width", ["column_width", 8]],
      ["height", ["em", 4.5]],
    ],

    // Translucent Rect
    ...Array(88).fill(0).map((e, index) => {
      return ["Rect",
        ["x", ["verso", 3, "x"]],
        ["y", ["hangline", 1 + index / 15]],
        ["height", ["em", .5]],
        ["length", ["em", 9]],
        ["fill", "#ff00ff88"],
      ]
    }),
    //
    ...Array(22).fill(0).map((e, index) => {
      return ["Rect",
        ["x", ["verso", 2, "x"]],
        ["y", ["hangline", 3 + index / 10]],
        ["height", ["em", .5]],
        ["length", ["em", 9]],
        ["fill", "#ffffff88"],
      ]
    }),

    ["LinkedFrame",
      saddle_stich_begin,
      [
        ["x", ["recto", 0, "x"]],
        ["y", ["hangline", 3]],
        ["length", ["column_width", 4]],
        ["height", ["em", 14.5]],
        ...style.body
      ],
      [
        ["x", ["recto", 4, "x"]],
      ]
    ],

    ["LinkedFrame",
      translationintro,
      [
        ["x", ["verso", 0, "x"]],
        ["y", ["hangline", 3]],
        ["length", ["column_width", 4]],
        ["height", ["em", 14.5]],
        ...style.body
      ],
      [
        ["x", ["verso", 4, "x"]],
      ]
    ],

  ]
}

let saddle_patterns = `These patterns only occur when we can assume some truths, such as the booklet goes from left to right, the recto is always odd and verso is always even.
With that stated, the page underneath a recto page will be the next odd number and for verso it will be the previous even number. This is directly dependent on the reading order being left to right. This understanding along with having access to the final representation of ‘real’ sheets the pages of the spread are going to be printed on, allowed me to implement a view that could simulate offset sheets in the tool, allowing me to design for a non-traditional book form.`

let translationend = {
  title: "",
  content: [
    ["Image",
      ["src", () => saddle_stich_img],
      ["x", ["verso", 0, "x"]],
      ["y", ["verso", 0, "y"]],
      ["width", ["column_width", 4]],
      ["height", ["em", 14.5]],
    ],

    ["LinkedFrame",
      saddle_patterns,
      [
        ["x", ["verso", 0, "x"]],
        ["y", ["hangline", 5]],
        ["length", ["column_width", 4]],
        ["height", ["em", 8.5]],
        ...style.body
      ],
      [
        ["y", ["hangline", 3]],
        ["x", ["verso", 4, "x"]],
        ["height", ["em", 14.5]],
      ]
    ],

    ["LinkedFrame",
      translationoutro,
      [
        ["x", ["recto", 0, "x"]],
        ["y", ["hangline", 5]],
        ["length", ["column_width", 4]],
        ["height", ["em", 8.5]],
        ...style.body
      ],
      [
        ["x", ["verso", 4, "x"]],
      ]
    ],
  ]
}


let writing_program = ` The process of writing a program that can typeset, compose spreads and impose them for printing, I have grown to understand the form of the book from a different perspective. While I knew how these processes worked before deconstructing and reconstructing them (translation) has given me an alternate vantage point that allows me to see a gestalt of parts coming together. How words, lines, hyphenations, paragraphs and spreads come together. The writing of programs has been akin to note-taking in the sense note-taking to understand.`
let writing_gui = `Writing as an alternate form to using a GUI to interact with a composition has created a working context where there is a friction in adding things to the page, and/or moving things around. The movement of elements happens along constrained rhythms defined by the grid. The friction makes each action more pronounced. Moreover it produces a distance between the work and the process where actions can be seen from 2 steps back, the decision, it’s interpretation in the constructed system, and the result. 
Writing as opposed to using the GUI also makes use of language, and a language I can produce at that. The language used in the making and using of the program is borrowed from the typographic vocabulary. However each term has been implemented in a certain way for certain purposes. This is a form of interpretation of these terms and an effort to create relationships with this vocabulary. This interpretive process reveals a generative quality of interpretations. Having interpreted these terms (or created) has impacted how the terms are used in the design process and if they were differently interpreted the process would be significantly altered.
`

let programmingnotetakng = {
  title: "",
  content: [

    ["Header",
      ["text", "PROGRAMMING"],
      ["x", ["verso", 3, "x"]],
      ["y", ["hangline", 1]],
      ["height", ["em", 18]],
      ["length", ["column_width", 8]],
      ["rect", false],
    ],

    ["Header",
      ["text", "NOTETAKING"],
      ["x", ["recto", 3, "x"]],
      ["y", ["hangline", 5]],
      ["height", ["em", 18]],
      ["length", ["column_width", 8]],
      ["rect", false],
    ],

    // Translucent Rect
    ...Array(88).fill(0).map((e, index) => {
      return ["Rect",
        ["x", ["recto", 3, "x"]],
        ["y", ["hangline", 1 + index / 15]],
        ["height", ["em", .5]],
        ["length", ["em", 9]],
        ["fill", "#ff00ff88"],
      ]
    }),
    //
    ...Array(22).fill(0).map((e, index) => {
      return ["Rect",
        ["x", ["verso", 2, "x"]],
        ["y", ["hangline", 3 + index / 10]],
        ["height", ["em", .5]],
        ["length", ["em", 9]],
        ["fill", "#ffffff88"],
      ]
    }),

    ["LinkedFrame",
      writing_program,
      [
        ["x", ["verso", 0, "x"]],
        ["y", ["hangline", 3]],
        ["length", ["column_width", 4]],
        ["height", ["em", 14.5]],
        ...style.body
      ],
      [
        ["x", ["verso", 4, "x"]],
      ]
    ],

    ["TextFrame",
      ["text", "&"],
      ["color", "#ff00ff"],
      ["font_family", "GapSans"],
      ["x", ["verso", 7, "x"]],
      ["y", ["hangline", 3]],
      ["length", ["column_width", 4]],
      ["height", ["em", 12.5]],
      ["font_size", ["em", 8]]
    ],

    ["LinkedFrame",
      writing_gui,
      [
        ["x", ["recto", 0, "x"]],
        ["y", ["hangline", 5]],
        ["length", ["column_width", 4]],
        ["height", ["em", 8.5]],
        ...style.body
      ],
      [
        ["x", ["recto", 4, "x"]],
        ["y", ["recto", 0, "y"]],
        ["height", ["em", 18.5]],
      ]
    ],

  ]
}


let frame = `["Header",
  ["text", "NOTES"],
  ["x", ["recto", 3, "x"]],
  ["y", ["hangline", 0]],
  ["height", ["em", 18]],
  ["length", ["column_width", 8]],
  ["rect", false],
],

["Image",
  ["src", () => front_img],
  ["x", ["verso", 0, "x"]],
  ["y", ["verso", 0, "y"]],
  ["width", ["column_width", 6]],
  ["height", ["em", 25]],
],

["TextFrame",
  ["text", frame],
  ["color", "#ff00ff"],
  ["x", ["recto", 4, "x"]],
  ["y", ["hangline", 0]],
  ["length", ["column_width", 8]],
  ["height", ["em", 22.5]],
  ...style.metadata
]
`

let saddle_pages = `saddle_pages() {
    // get pages
    let pages = this.pages()

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

    // pair spreads up with each other
    for (let i = 0; i < middle; i++) {
      pairedup.push(pages[i])
      pairedup.push(pairskiplast(i))
    }

    return pairedup
  }
`

let front_cover_img = {
  title: "",
  content: [
    ["Image",
      ["src", () => front_img],
      ["x", ["verso", 0, "x"]],
      ["y", ["verso", 0, "y"]],
      ["width", ["column_width", 6]],
      ["height", ["em", 25]],
    ],

    ["Header",
      ["text", "NOTES"],
      ["x", ["recto", 3, "x"]],
      ["y", ["hangline", 0]],
      ["height", ["em", 18]],
      ["length", ["column_width", 8]],
      ["rect", false],
    ],

    ["TextFrame",
      ["text", frame],
      ["color", "#ff00ff"],
      ["x", ["recto", 4, "x"]],
      ["y", ["hangline", 0]],
      ["length", ["column_width", 8]],
      ["height", ["em", 22.5]],
      ...style.metadata,
      ["leading", ["point", 5]],
    ]

  ]
}

let saddle_instructions = `A series of spreads are input. The total pages must be a multiple of 4. The verso of first and recto of last spread are nullified (page next to front and back). Each spread exchanges its recto with its pair. Pairs are found by counting the index position from the back of list. Once each recto is switched, the spreads are then paired up, using the same pairing logic.`

let intoduction_cover_img = {
  title: "",
  content: [
    ["Image",
      ["src", () => front_img],
      ["x", ["verso", 0, "x"]],
      ["y", ["verso", 0, "y"]],
      ["width", ["column_width", 6]],
      ["height", ["em", 25]],
    ],

    ["Header",
      ["text", "booklet_bind()"],
      ["x", ["recto", 3, "x"]],
      ["y", ["hangline", 5]],
      ["height", ["em", 18]],
      ["length", ["column_width", 8]],
      ["rect", false],
    ],

    // Translucent Rect
    ...Array(58).fill(0).map((e, index) => {
      return ["Rect",
        ["x", ["recto", 2, "x"]],
        ["y", ["hangline", 3 + index / 15]],
        ["height", ["em", .5]],
        ["length", ["em", 9]],
        ["fill", "#0000ff22"],
      ]
    }),

    ["LinkedFrame",
      saddle_instructions,
      [
        ["color", "#ff00ff"],
        ["x", ["recto", 0, "x"]],
        ["y", ["hangline", 1]],
        ["length", ["column_width", 4]],
        ["height", ["em", 22.5]],
        ...style.body,
      ]
    ],

    ["LinkedFrame",
      saddle_pages,
      [
        ["color", "#ff00ff"],
        ["x", ["recto", 4, "x"]],
        ["y", ["hangline", 1]],
        ["length", ["column_width", 8]],
        ["height", ["em", 22.5]],
        ...style.metadata,
        ["leading", ["point", 5]],
      ]],

  ]
}

let translation_cover_img = {
  title: "",
  content: [
    ["Image",
      ["src", () => translation_img],
      ["x", ["verso", 3, "x"]],
      ["y", ["verso", 0, "y"]],
      ["width", ["column_width", 10]],
      ["height", ["em", 25]],
    ],
  ]
}

let colophon = {
  title: "",
  content: [
    ["TextFrame",
      ["text", `COLOPHON`],
      ["x", ["verso", 0, "x"]],
      ["y", ["hangline", 1]],
      ["length", ["column_width", 3]],
      ["height", ["em", 25]],
      ...style.metadata,
      ["font_weight", 600],
      ["font_size", ["point", 18]],
    ],
    ["TextFrame",
      ["text", `This booklet was typeset using ABC Dinamo's Oracle Family and GapSans designed by GrandChaos9000. GapSans is a fork of Sani Trixie Sans Typeface.
The booklet was designed in a custom tool developed for an independent study conducted for reasons noted in the contents of the booklet. The tool was written in vanilla javascript.
`],
      ["x", ["verso", 3, "x"]],
      ["y", ["hangline", 1]],
      ["length", ["column_width", 5]],
      ["height", ["em", 25]],
      ...style.body
    ],
  ]
}

let blankpages = {
  title: "",
  content: [

    ["TextFrame",
      ["text", `[GOTTA PRINT BLANK PAGES]`],
      ["x", ["verso", 3, "x"]],
      ["y", ["hangline", 1]],
      ["length", ["column_width", 5]],
      ["height", ["em", 25]],
      ...style.metadata
    ],
  ]
}


let empty = {
  title: "describes grid",
  content: []
}

page = 17

// x-----------------------x
// *Header: Data
// x-----------------------x
let data = {
  contents: [
    cover,
    structure_graphic,
    graphic_processes,
    instance_example,
    translationstart,
    translationend,
    programmingnotetakng,
    front_cover_img,
    intoduction_cover_img,
    translation_cover_img,
    colophon,
    blankpages,
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
let process_hangline = (prop) =>
  /**@param {Grid} grid */
  (grid) => {
    let index = Math.floor(prop[1])
    let diff = prop[1] - index

    let value = grid.hanglines()[index]
    //let next = grid.hanglines().length - 1 >= index ? grid.props.page_width : grid.hanglines()[index + 1]
    let next = grid.hanglines()[index + 1]
    if (!next) next = grid.props.page_width

    let dist = s.sub(next, value)
    let offset = s.mul(dist, diff)
    console.log("offset", offset)

    return s.add(value, offset)
  }

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
    if (item[0] == "Image") return image(reduceprops(item.slice(1)))
    if (item[0] == "Circle") return circle(reduceprops(item.slice(1)))
    if (item[0] == "Arc") return arc(reduceprops(item.slice(1)))
  })


  return new Spread(grid, s, [...contents, ...extensions])
}


const image = ({ src, x, y, width, height }) => {
  return {
    draw: (p, props) => {

      if (typeof x == "function") x = x(props.structure)
      if (typeof y == "function") y = y(props.structure)
      if (typeof width == "function") width = width(props.structure)
      if (typeof height == "function") height = height(props.structure)
      p.blendMode("multiply")
      p.image(src(), x.px, y.px, width.px, height.px)
      p.blendMode("blend")
    }
  }
}

const rect = ({ x, y, length, height, fill, stroke, strokeWeight }) => {
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
