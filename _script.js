import { sig, mem, render, HTML as html, eff_on } from "/lib/solid/monke.js"
import { hyphenateSync } from "/lib/hyphenator/hyphenate.js"
import { Q5 as p5 } from "/lib/q5/q5.js"

const GlobalStyle = `
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
@typedef {{
  horizontal_pos: number,
  word_count: number,
  hyphen_leftover: "",
  space_size: number,
}} LineState

@typedef {{ 
  beforeHyphenate: (props: ParagraphHookProps) => void 
  afterHyphenate: (props: ParagraphHookProps) => void 
  beforeWord: (props: ParagraphHookProps) => void 
  afterWord: (props: ParagraphHookProps) => void 
}} LineHooks

@typedef {{
  paragraph_state: ParagraphState,
  paragraph: Paragraph,
}} ParentState

@param {string} text
@param {Unit} length
@param {Unit} x
@param {Unit} y
@param {LineHooks=} hooks
@param {ParentState} state
@param {p5} p

@description takes text and length, and returns overflowed text.
*/
let draw_line = (p, text, x, y, length, state, hooks,) => {
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
let draw_paragraph = (p, paragraph, grid) => {
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
    hooks: {}
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
  text:string,
  length:Unit,
  font_family:any,
  font_weight:number,
  leading:Unit,
  font_size:Unit,
  height:Unit,
  color:Color,
  stroke:Color,
  x:Unit,
  y:Unit,
  rect :boolean,
  hooks:ParagraphHooks,
}} Paragraph

@typedef {{
  text: string,
  font_family?: string,
  font_weight?:number
  leading?:Unit
  font_size?:Unit
  length?:(Unit | GridUnit) ,
  height?:(Unit | GridUnit) ,
  x?: (Unit | GridUnit),
  y?:(Unit | GridUnit),
  color?:Color ,
  stroke?:Color ,
  rect?:boolean  ,
  hooks?:ParagraphHooks ,
}} ParagraphProps
*/


/**
@typedef {("inch" | "pica" | "point" | "em" | "pixel")} UnitType
@typedef {{
  unit?: UnitType,
  value?: number,
  px: number
}} Unit

*/
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




class Book {
  /**
  @param {Spread[]} [spreads=[]] 
  @param {{draw_grid: boolean}=} opts
  */
  constructor(spreads = [], opts = { draw_grid: true }) {
    this.grid = opts.draw_grid
    this.current_spread = 0
    /**@type Spread[]*/
    this.spreads = spreads
  }

  saddle_pages(num = 1) {
    // get pages
    let pages = this.pages()
    if (!Array.isArray(pages)) return

    let last = pages.length - 1
    let pair = (i) => pages[last - i]

    let middle = Math.ceil(last / 2)

    // switch each recto with pair spread recto till middle
    for (let i = 0; i < middle; i++) {
      let f_recto = pages[i][1]
      let p_recto = pair(i)[1]

      pages[i][1] = p_recto
      pair(i)[1] = f_recto
    }

    // pair each pair and flatten
    let pairs = []

    for (let i = 0; i <= middle; i++) {
      pairs.push(pages[i])
      pairs.push(pair(i))
    }

    return pairs
  }

  page_to_spread(num) {
    return Math.floor(num / 2)
  }

  get_page(num = 1) {
    let spread = this.page_to_spread(num)
    return this.spreads[spread]
  }

  set_spread(spread) {
    this.current_spread = spread
  }

  set_page(num) {
    let spread = this.page_to_spread(num)
    this.current_spread = spread
  }

  pages() {
    /**@type {[number, number][]}*/
    let arr = []
    let is_odd = (num) => (num % 2) == 1

    // also make sure number of spreads is odd
    // TOD0: if it isn't, add a spread before last page in booklet buinding... 
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
    if (this.grid) this.spreads[this.current_spread].draw_grid(p, this.pages()[this.current_spread])
    this.spreads[this.current_spread].draw(p)
  }

  page_image(p, number) {
    let spread = this.page_to_spread(number)

    if (number % 2 == 1) return this.recto_image(p, spread)
    else return this.verso_image(p, spread)
  }

  /**
  @typedef {p5.Image} Image
  */
  verso_image(p, number) {
    let _p = p.createGraphics(p.width, p.height)
    if (this.grid) this.spreads[number].draw_grid(_p, [(number * 2), (number * 2) + 1])
    this.spreads[number].draw(_p)
    let img = _p.get(0, 0, _p.width / 2, _p.height)

    return img
  }

  recto_image(p, number) {
    let _p = p.createGraphics(p.width, p.height)
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

  draw_verso(p) {
    let img = this.verso_image(p, this.current_spread)
    this.draw_img(p, img)
  }

  draw_recto(p) {
    let img = this.recto_image(p, this.current_spread)
    this.draw_img(p, img, img.width)
  }

  draw_page_set(p, num1, num2) {
    this.draw_img(p, this.page_image(p, num1))
    let recto = this.page_image(p, num2)
    this.draw_img(p, recto, recto.width)
  }

  seek(page) {
    this.current_spread = page
  }

}

const hyphenate = (text) => hyphenateSync(text, { hyphenChar: "-" })
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
};

console.log(hyphenate("starbucks-smashing-globalist"))

let x = 1
let animating = false
let add = (x, y) => x + y
let sub = (x, y) => x - y

let op = add


let t = `She tried to imagine the technology conferences she'd been to with the addition of the subtitling and translation and couldn't do it. Not conferences. Something else. A kids' toy? A tool for Starbucks-smashing anti-globalists, planning strategy before a WTO riot? She patted her pocket. Freddy hissed and bubbled like a teakettle beside her, fuming. "What a cock," he muttered. "Thinks he's going to hire ten thousand teams to replace his workforce, doesn't say a word about what *that* lot is meant to be doing now he's shitcanned them all. Utter bullshit. Irrational exuberance gone berserk." Suzanne had a perverse impulse to turn the wand back on and splash Freddy's bilious words across the ceiling, and the thought made her giggle. She suppressed it and kept on piling up notes, thinking about the structure of the story she'd file that day. Kettlewell pulled out some charts and another surfer in a suit came forward to talk money, walking them through the financials. She'd read them already and decided that they were a pretty credible bit of fiction, so she let her mind wander. She was a hundred miles away when the ballroom doors burst open and the unionized laborers of the former Kodak and the former Duracell poured in on them, tossing literature into the air so that it snowed angry leaflets. They had a big drum and a bugle, and they shook tambourines. The hotel rent-a-cops occasionally darted forward and grabbed a protestor by the arm, but her colleagues would immediately swarm them and pry her loose and drag her back into the body of the demonstration. Freddy grinned and shouted something at Kettlewell, but it was lost in the din. The journalists took a lot of pictures. Suzanne closed her computer's lid and snatched a leaflet out of the air. WHAT ABOUT US? it began, and talked about the workers who'd been at Kodak and Duracell for twenty, thirty, even forty years, who had been conspicuously absent from Kettlewell's stated plans to date. She twisted the laser-pointer to life and pointed it back at the wall. Leaning in very close, she said, "What are your plans for your existing workforce, Mr Kettlewell?" WHAT ARE YOUR PLANS FOR YOUR EXISTING WORKFORCE MR KETTLEWELL She repeated the question several times, refreshing the text so that it scrolled like a stock ticker across that upholstered wall, an illuminated focus that gradually drew all the attention in the room. The protestors saw it and began to laugh, then they read it aloud in ragged unison, until it became a chant: WHAT ARE YOUR PLANS -- *thump* of the big drum -- FOR YOUR EXISTING WORKFORCE *thump* MR *thump* KETTLEWELL? Suzanne felt her cheeks warm. Kettlewell was looking at her with something like a smile. She liked him, but that was a personal thing and this was a truth thing. She was a little embarrassed that she had let him finish his spiel without calling him on that obvious question. She felt tricked, somehow. Well, she was making up for it now. On the stage, the surfer-boys in suits were confabbing, holding their thumbs over their tie-mics. Finally, Kettlewell stepped up and held up his own laser-pointer, painting another rectangle of light beside Suzanne's. "I'm glad you asked that, Suzanne," he said, his voice barely audible. I'M GLAD YOU ASKED THAT SUZANNE The journalists chuckled. Even the chanters laughed a little. They quieted down. "I'll tell you, there's a downside to living in this age of wonders: we are moving too fast and outstripping the ability of our institutions to keep pace with the changes in the world." Freddy leaned over her shoulder, blowing shit-breath in her ear. "Translation: you're ass-fucked, the lot of you." TRANSLATION YOUR ASS FUCKED THE LOT OF YOU Suzanne yelped as the words appeared on the wall and reflexively swung the pointer around, painting them on the ceiling, the opposite wall, and then, finally, in miniature, on her computer's lid. She twisted the pointer off. Freddy had the decency to look slightly embarrassed and he slunk away to the very end of the row of seats, scooting from chair to chair on his narrow butt. On stage, Kettlewell was pretending very hard that he hadn't seen the profanity, and that he couldn't hear the jeering from the protestors now, even though it had grown so loud that he could no longer be heard over it. He kept on talking, and the words scrolled over the far wall. THERE IS NO WORLD IN WHICH KODAK AND DURACELL GO ON MAKING FILM AND BATTERIES THE COMPANIES HAVE MONEY IN THE BANK BUT IT HEMORRHAGES OUT THE DOOR EVERY DAY WE ARE MAKING THINGS THAT NO ONE WANTS TO BUY THIS PLAN INCLUDES A GENEROUS SEVERANCE FOR THOSE STAFFERS WORKING IN THE PARTS OF THE BUSINESS THAT WILL CLOSE DOWN `

/**@type {p5}*/
let p
let oracle

let dpi = 150
let viewport = .45
let s = new Scale(dpi, viewport)
let mx = 0, my = 0

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
  page_width: s.inch(11),
  page_height: s.inch(8.5),
}, s)

let preload = (p) => {
  oracle = p.loadFont("/fs/fonts/ABCOracle.ttf")
}

let draw = (p) => {
  p.background("white");
  p.textWeight(600)
  p.textFont(oracle)


  mx = s.px(p.mouseX).px / viewport
  my = s.px(p.mouseY).px / viewport

  p.rect(mx, my, 10, 10)

  //book.draw(p)
  book.draw_page_set(p, 1, 9)
  //book.draw_saddle_view(p)
  //book.draw_verso(p)
  // book.seek(0)
  //book.draw_recto(p)
  p.noLoop()
}

setTimeout(() => {
  let el = document.querySelector(".q5")
  p = new p5('instance', el);

  p.setup = () => {
    p.createCanvas(s.inch(11).px, s.inch(8.5).px);
    el.style.transform = "scale(" + (1 / s.scale) * viewport + ")"
  };


  p.draw = () => {
    draw(p)
    //p.noLoop()
  };

  p.mousePressed = () => {
    p.save("print.png")
  }

}, 200)


const defer = (fn, t = 200) => setTimeout(fn, t)
let data
let pg = 0


fetch("http://localhost:3000/api/channels/x-isp-statements")
  .then((res) => res.json())
  .then((res) => data = res)

let container = () => html`
<style>
  ${GlobalStyle}
</style>

<div class="container">
  <div class="q5"></div>
  
  <button 
  style="position:fixed;top:1em;left:0"
  onclick=${() => { pg--; book.seek(pg) }}
  >
    prev
  </button>
  <button 
  style="position:fixed;top:0;left:0"
  onclick=${() => { pg++; book.seek(pg) }}
  >
    next
  </button>
</div>
`
render(container, document.body)

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
let linked = new LinkedFrame(t)

linked.add({
  text: "",
  x: (grid) => grid.verso_columns()[1].x,
  y: (grid) => grid.verso_columns()[0].y,
  length: s.em(20),
  leading: s.point(12),
  font_size: s.point(7),
  height: s.em(28),
  rect: false,
})

linked.add({
  text: "",
  x: (grid) => grid.recto_columns()[0].x,
  y: (grid) => grid.recto_columns()[0].y,
  height: s.em(8),
})

linked.add({
  text: "",
  leading: s.point(12),
  x: grid => grid.recto_columns()[0].x,
  y: grid => s.add(grid.recto_columns()[0].y, s.em(12)),
})


let n_index = 0
let notationTitle = new LinkedFrame("UGH")

notationTitle.add({
  ...stylesheet.title,
  text: "",
  x: (grid) => grid.verso_columns()[3].x,
  y: (grid) =>
    s.add(
      grid.verso_columns()[0].y,
      s.px_raw(grid.column_width(3).px)
    ),

  height: s.em(12),
  rect: false,
})

defer(() => notationTitle.set_text(data.contents[n_index].title), 50)
let notation = new LinkedFrame("Hewl")
notation.add({
  ...stylesheet.body,
  text: "",
  x: (grid) => grid.verso_columns()[1].x,
  y: (grid) => s.add(grid.verso_columns()[0].y, s.em(4)),
  leading: s.point(12),
  font_size: s.point(8),
  height: s.em(12),
  rect: true,
})
defer(() => notation.set_text(data.contents[n_index].content))

/**@type Drawable*/

let grid_test = {
  draw: (p, props) => {
    let [recto, verso] = props.structure.columns()
    let rect = (x, y, w, h) => {
      p.rect(x, y, w, h, s.em(3).px)
    }

    p.noFill()
    p.fill(245)
    p.strokeWeight(2)
    p.noStroke()
    p.noFill()
    recto.forEach((col) => { rect(col.x.px, col.y.px, col.w.px, col.h.px) })
    verso.forEach((col) => { rect(col.x.px, col.y.px, col.w.px, col.h.px) })

    p.strokeWeight(.5)

  }
}

let another = (p) => {
  p.circle(s.em(10).px,
    s.px((() => mx)()).px / viewport,
    s.px((() => my)()).px / viewport)
}

let notation_spread = new Spread(grid, s, [
  grid_test,
  notation, notationTitle])



function spread_from_block(index, extensions = []) {
  let t_index = index
  let throuth_title = new LinkedFrame("")

  throuth_title.add({
    ...stylesheet.title,
    text: "",
    x: (grid) => grid.verso_columns()[3].x,
    y: (grid) =>
      s.add(
        grid.verso_columns()[0].y,
        s.px_raw(grid.column_width(3).px)
      ),

    height: s.em(12),
    rect: false,
  })
  defer(() => throuth_title.set_text(data.contents[t_index].title), 50)

  let through = new LinkedFrame("Hewl")
  through.add({
    ...stylesheet.body,
    text: "",
    x: (grid) => grid.verso_columns()[1].x,
    y: (grid) => s.add(grid.verso_columns()[0].y, s.em(4)),
  })

  through.add({
    ...stylesheet.body,
    text: "",
    x: (grid) => grid.recto_columns()[1].x,
    y: (grid) => s.add(grid.recto_columns()[0].y, s.em(4)),
    height: s.em(21)
  })

  defer(() => through.set_text(data.contents[t_index].content))

  return new Spread(grid, s, [through, throuth_title, ...extensions])
}

let graphic = () => {
  let r = Math.random() * 12
  let f = Math.random() * 28
  let at = Math.random() + .5
  let ot = Math.random()
  return {
    draw: (p, props) => {
      p.noFill()
      p.stroke(0, 0, 255)

      p.strokeWeight(1)
      p.arc(s.em(18).px,
        s.em(f + r).px,
        s.em(r * 2 + 8).px,
        s.em(r * 2 + 8).px,
        ot, at
      )

      p.strokeWeight(.5)
      p.circle(s.em(8).px,
        s.em(18).px,
        s.em(r * at).px,
      )
    }
  }
}

let book = new Book(
  [
    new Spread(grid, s, [linked]),
    //1. contexts
    spread_from_block(0, [graphic()]),

    //2. in vs through
    spread_from_block(1, [graphic()]),

    //3. ground-up
    spread_from_block(2, [graphic()]),

    //4. nouns and verbs
    spread_from_block(10, [graphic()]),

    //5. labour:
    // example: video
    spread_from_block(5, [graphic()]),

    //6. feedback and change:
    spread_from_block(6, [graphic()]),

    //7. process parallels
    spread_from_block(9, [graphic()]),

    //8. where does meaning come from
    // spread_from_block(8, [graphic()]),

    //9. reconfiguration
    spread_from_block(11, [graphic()]),

    // -------------
    // predatory software
    // practices
    // + sustainability 
    // -------------

    // spread_from_block(7, [graphic()]),
    // spread_from_block(4, [graphic()]),
  ])

console.log(book.saddle_pages())
book.set_page(9)
//book.set_page()

