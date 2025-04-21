

type Hdom = () => any
type Arg1<A> = [(arg1: A) => Hdom, A]
type Arg2<A, B> = [(arg1: A, arg2: B) => Hdom, A, B]
type Arg3<A, B, C> = [(arg1: A, arg2: B, arg3: C) => Hdom, A, B, C]
type Arg4<A, B, C, D> = [(arg1: A, arg2: B, arg3: C, arg4: D) => Hdom, A, B, C, D]
type Arg5<A, B, C, D, E> = [(arg1: A, arg2: B, arg3: C, arg4: D, arg5: E) => Hdom, A, B, C, D, E]


// /**
//  * @typedef {[(string | any[]), ...*]} Hiccup
//  **/
//
type Fn<T> = (a: T) => Hdom
type FnArray<T> = [Fn<T>, T]
type FnArray2<A, B> = [Fn<A, B>, A, B]
type Hiccup = [string, Object, ...any]
type HdomArgs<A, B, C> = (
	[(string | any[]), ...*] |
	Arg1<A> | Arg2<A, B> | Arg3<A, B, C> | Arg4<A, B, C, D> | Arg5<A, B, C, D, E>)

export function hdom<A, B, C, D, E>(arg: HdomArgs<A, B, C, D, E>): Hdom
