import { sig, mem, render, HTML as html, eff_on } from "/lib/solid/monke.js"
import { hyphenateSync } from "/lib/hyphenator/hyphenate.js"
import { Q5 as p5 } from "/lib/q5/q5.js"

let dpi = 150
let viewport = .42
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
    let hyphenated = hyphenateSync(word, {
      hyphenChar: "---((---))---"
    }).split("---((---))---")

    // try to put first of hyphenated in...
    let lexeme = hyphenated.shift()
    let word_len = p.textWidth(lexeme)

    if (line_state.horizontal_pos + word_len < length.px) {
      let _fill = p.ctx.fillStyle
      // hook to change color of hyphenated
      p.fill(p.color("red"))
      p.text(lexeme + "-", x.px + line_state.horizontal_pos, y.px)
      p.fill(_fill)
      return hyphenated.join("")
    }

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
      if (!state.paragraph.hyphenate) return
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
  constructor(scale = 1, viewport = 1) {
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

let s = new Scale(dpi, viewport)

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

let grid = new Grid({

  margin: {
    top: s.em(8),
    bottom: s.em(4),
    inside: s.em(1),
    outside: s.em(4),
  },

  columns: 8,
  gutter: s.point(6),
  hanglines: [],
  page_width: s.inch(10),
  page_height: s.inch(8),
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
    p.text("[ PAGE " + (no[0]) + " ]", this.structure.verso_columns()[0].x.px, this.s.em(3).px)
    p.text("[ PAGE " + (no[1]) + " ]",
      this.structure.recto_columns()[0].x.px,
      this.structure.recto_columns()[3].y.px)

    p.noFill()
    p.stroke(0)
    p.strokeWeight(.2)


    recto.forEach((col) => { p.rect(col.x.px, col.y.px, col.w.px, col.h.px) })
    verso.forEach((col) => { p.rect(col.x.px, col.y.px, col.w.px, col.h.px) })
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

let offset_size = s.inch(1.5)
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
    console.log('recieved sheet', index)
    if (!this.validate_spread(index)) return

    let spreads = this.saddle_pages()

    let sheet = spreads[index]
    const isOdd = num => num % 2 == 1;
    let pair_index = isOdd(index) ? index - 1 : index + 1
    let pair = spreads[pair_index]
    console.log('pair', index, pair_index)
    console.log('contents', sheet, pair)

    sheet.forEach((e) => {
      console.log('page', e)
      if (this.offsets.findIndex(f => f == e) == -1) { this.offsets.push(e) }
    })

    pair.forEach((e) => {
      console.log('page', e)
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
    let img = _p.get(0, 0, _p.width / 2, _p.height)

    return img
  }

  recto_image(p, number, color = 255) {
    let _p = p.createGraphics(p.width, p.height)
    _p.background(color)
    if (this.grid) this.spreads[number].draw_grid(_p, [(number * 2), (number * 2) + 1])
    this.spreads[number].draw(_p)
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
    return this.offsets.includes(page + 1)
  }

  draw_verso(p) {
    let page = this.current_spread * 2 - 1
    let includes = this.page_is_offset(page)
    let img = this.verso_image(p, this.current_spread)
    this.draw_img(p, img, 0, includes ? offset_size.px : 0)
  }

  draw_recto(p) {
    let page = this.current_spread * 2
    let includes = this.page_is_offset(page)
    let img = this.recto_image(p, this.current_spread)
    this.draw_img(p, img, img.width, includes ? -offset_size.px : 0)
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
  constructor(p, s, el, size) {
    this.setup(p, s, el)
    this.size = size
    this.scale = s
    this.p5 = p
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

    let graphic = p.createGraphics(width.px, height.px)
    graphic.background(255)

    let verso_page = book.current_spread * 2 - 1
    let verso_offset = book.page_is_offset(verso_page)
    let recto_page = book.current_spread * 2
    let recto_offset = book.page_is_offset(recto_page)

    let verso_image = book.verso_image(graphic, book.current_spread, verso_offset ? "#ABE2F7" : 255)
    let recto_image = book.recto_image(graphic, book.current_spread, recto_offset ? "#ABE2F7" : 255)

    this.draw_crop_marks(book)

    let left = (this.size.width.px - width.px) / 2
    let top = (this.size.height.px - height.px) / 2

    // if offset also get pairing underneat page...

    p.image(verso_image, left,
      verso_offset ? top - (offset_size.px / 2) : top)
    p.image(recto_image, left + width.px / 2,
      recto_offset ? top - (offset_size.px / 2) : top)
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

    let width = book.structure?.props.page_width
    let height = book.structure?.props.page_height

    let graphic = p.createGraphics(width.px, height.px)
    graphic.background(255)

    book.draw_saddle_view(graphic)
    this.draw_crop_marks(book)

    let left = (this.size.width.px - width.px) / 2
    let top = (this.size.height.px - height.px) / 2


    p.image(graphic, left, top, width.px, height.px)
  }
  /**@param {Book} book */
  draw_spread(book) { }
}


/**@type {p5}*/
let p
let data

let pg = 1

fetch("./data.json")
  .then((res) => res.json())
  .then((res) => data = res)
  .then(_ => init())


let oninit = []
let pages, paper
function init() {
  render(container, document.body)

  pages = [
    spread_from_block(0, [graphic()]),
    spread_from_block(1, [graphic()]),
    spread_from_block(2, [graphic()]),
    spread_from_block(3, [graphic()]),
    spread_from_block(4, [graphic()]),
    spread_from_block(5, [graphic()]),
    spread_from_block(5, [graphic()]),
    spread_from_block(5, [graphic()]),
    // spread_from_block(6, [graphic()]),
  ]

  oninit.forEach(fn => typeof fn == "function" ? fn() : null)
}

oninit.push(() => {
  let el = document.querySelector(".q5")
  p = new p5('instance', el);

  // real
  // let paper = new Paper(p, s, el, {
  //   width: s.inch(11),
  //   height: s.inch(8.5),
  // })


  // for offset
  paper = new Paper(p, s, el, {
    width: s.inch(11),
    height: s.inch(10),
  })

  setTimeout(() => {
    paper.draw_book(book)
  }, 100)
})

let book
oninit.push(() => {
  let headers = data
    .contents
    .map((e, i) => Header(
      e.title,
      header_iterator()
    ))

  book = new Book([
    new Spread(grid, s, headers),
    ...pages
  ], {
    draw_grid: true
  })

  book.mark_page_offset(7)
  book.set_page(11)
})

let container = () => html`
  <style>
    ${GlobalStyle}
  </style>

  <div class="container">
    <div class="q5"></div>
    
    <button 
      style="position:fixed;top:1em;left:0"
      onclick=${() => { pg -= 2; book.seek(pg); paper.draw_book(book) }} >
      prev
    </button>

    <button 
    style="position:fixed;top:0;left:0"
    onclick=${() => { pg += 2; book.seek(pg); paper.draw_book(book) }} >
      next
    </button>
  </div>
`


/**@type {{
  body: ParagraphProps
  title: ParagraphProps
}}*/
let stylesheet = {
  title: {
    text: "",
    font_family: "ABC Maxi Round Unlicensed Trial",
    font_weight: 300,
    length: (grid) => grid.column_width(6),
    font_size: s.point(38),
    leading: s.point(22),
  },
  body: {
    text: "",
    leading: s.point(12),
    length: (grid) => grid.column_width(5),
    height: s.em(8),
    font_size: s.point(8),
    font_family: "ABC Oracle Variable Unlicensed Trial",
    font_weight: 600,
  }
}


function spread_from_block(index, extensions = []) {
  let t_index = index
  let through_title = Header(data.contents[t_index].title, {
    x: (grid) => grid.verso_columns()[0].x,
    y: (grid) =>
      s.add(
        grid.verso_columns()[0].y,
        s.px_raw(grid.column_width(3).px)
      ),
  })

  let through = new LinkedFrame("Hewl")
  through.add({
    ...stylesheet.body,
    text: "",
    x: (grid) => grid.verso_columns()[1].x,
    y: (grid) => s.add(grid.verso_columns()[0].y, s.em(4)),
    height: s.em(21)
  })

  through.add({
    ...stylesheet.body,
    text: "",
    x: (grid) => grid.recto_columns()[1].x,
    y: (grid) => s.add(grid.recto_columns()[0].y, s.em(4)),
  })

  let d = data.contents[t_index]
  if (d) through.set_text(d.content)

  return new Spread(grid, s, [through, through_title, ...extensions])
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
  /**@type {Drawable}*/
  let drawable = {
    draw: (p, props) => draw_paragraph(p, {
      font_family: "GapSansBold",
      text: text,

      color: "blue",

      rect: true,
      hyphenate: false,

      length: s.em(23.5),
      height: s.em(11.5),

      leading: s.point(38),
      font_size: s.point(32),
      ...para
    }, props.structure)
  }

  return drawable
}

/**@returns {() => ParagraphProps}*/
function HeaderIterator(ggrid) {
  let next = 0
  let col = 0

  let nextprop = () => {
    let current = next
    next++

    let y = (grid) => s.add(s.em(1), s.em(current * 12))
    let _y = y(ggrid)
    let bounds = s.sub(_y, s.sub(ggrid.props.page_height, ggrid.props.margin.bottom)).px
    let out = (bounds > 0)
    if (out) {
      current = 0
      next = 1
      col++
    }

    let cur_col = col

    return {
      x: (grid) => {
        return (cur_col == 0)
          ? grid.verso_columns()[0].x
          : grid.recto_columns()[0].x
      },

      y: y,
    }
  }

  return nextprop
}

let header_iterator = HeaderIterator(grid)


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
