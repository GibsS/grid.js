import * as _ from 'lodash'

import { IAABB } from '../vbh/vbh'
import { Entity } from './entity'
import { Contact, Overlap } from './contact'

export enum BodyType {
    RECT, LINE, GRID
}

interface BodyArgs {
    x?: number
    y?: number

    enabled?: boolean
}
interface SmallBodyArgs extends BodyArgs {
    isSensor?: boolean
    layer?: string
    layerGroup?: number
}
export interface RectArgs extends SmallBodyArgs {
    width: number
    height: number
}
export interface LineArgs extends SmallBodyArgs {
    size: number
    isHorizontal: boolean
    side?: string
}
export interface GridArgs extends BodyArgs {
    layer?: string
    layerGroup?: number
    tiles?: TileArgs
    width?: number
    height?: number
    tileSize?: number
}
type TileList = { x: number, y: number, shape: number, data?: any }[]
type TileGrid = { x: number, y: number, info: ({ shape: number, data?: any } | number)[][] }
export type TileArgs = TileList | TileGrid

let resetminx = false, resetmaxx = false, resetminy = false, resetmaxy = false

export abstract class Body implements IAABB {

    type: number

    _grid: Grid
    _entity: Entity

    _enabled: boolean

    _x: number
    _y: number

    _higherContacts: Contact[]

    get entity(): Entity { return this._entity }
    set entity(val: Entity) { console.log("[ERROR] can't set entity") }
    get _topEntity(): Entity { return this._entity._topEntity }

    get enabled(): boolean { return this._enabled }
    set enabled(val: boolean) {
        if(val != this._enabled && !val) {
            this._clearContacts()
        }
        this._enabled = val
    }

    get x(): number { return this._x - this._topEntity._x + this._entity._x }
    get y(): number { return this._y - this._topEntity._y + this._entity._y }

    get globalx(): number { return this._x + this._topEntity._x }
    get globaly(): number { return this._y + this._topEntity._y }

    set x(val: number) { 
        let x = this.x, topEntity = this._entity
        while(topEntity != this._topEntity) { x += topEntity._x }
        this._topx = val
    }
    set y(val: number) {
        let y = this.y, topEntity = this._entity
        while(topEntity != this._topEntity) { y += topEntity._y }
        this._topy = val
    }
    set _topx(val: number) {
        this._testResetBounds()
        this._x = val
        this._clearContacts()
        this._resetBounds()
    }
    set _topy(val: number) {
        this._testResetBounds()
        this._y = val
        this._clearContacts()
        this._resetBounds()
    }
    set globalx(val: number) {
        this._topx = val - this._topEntity.globalx
    }
    set globaly(val: number) {
        this._topy = val - this._topEntity.globaly
    }

    get contacts(): Contact[] {
        return this._topEntity.contacts.filter(c => c.body == this)
    }
    get leftContact(): Contact {
        let leftContact = this._topEntity.leftContact
        return leftContact && leftContact.body == this && leftContact
    }
    get rightContact(): Contact {
        let rightContact = this._topEntity.rightContact
        return rightContact && rightContact.body == this && rightContact
    }
    get upContact(): Contact {
        let upContact = this._topEntity.upContact
        return upContact && upContact.body == this && upContact
    }
    get downContact(): Contact {
        let downContact = this._topEntity.downContact
        return downContact && downContact.body == this && downContact
    }

    abstract minx: number
    abstract miny: number
    abstract maxx: number
    abstract maxy: number

    constructor(entity: Entity, args?: BodyArgs) {
        if(args) {
            this._entity = entity

            this._x = args.x || 0
            this._y = args.y || 0
            this._enabled = args.enabled || true
        }
    }

    localToGlobal(x: number | { x: number, y: number }, y?: number): { x: number, y: number } {
        if(typeof x !== "number") {
            y = x.y
            x = x.x
        }
        let topParent = this._entity
        while(topParent != this._topEntity) {
            x += topParent._x
            y += topParent._y
            topParent = topParent._parent
        }
        return {
            x: x + this._x + this._topEntity.globalx,
            y: y + this._y + this._topEntity.globaly
        }
    }
    globalToLocal(x: number | { x: number, y: number }, y?: number): { x: number, y: number } {
        if(typeof x !== "number") {
            y = x.y
            x = x.x
        }
        let topParent = this._entity
        while(topParent != this._topEntity) {
            x -= topParent._x
            y -= topParent._y
            topParent = topParent._parent
        }
        return {
            x: x - this._x - this._topEntity.globalx,
            y: y - this._y - this._topEntity.globaly
        }
    }

    _clearContacts() {
        for(let t of ["_upLower", "_downLower", "_leftLower", "_rightLower"]) {
            let c: Contact = this._topEntity[t]

            if(c) {
                let i = c.otherBody._higherContacts.indexOf(c)
                c.otherBody._higherContacts.splice(i, 1)
                this._topEntity[t] = null
            }
        }

        if(this._higherContacts) {
            let len = this._higherContacts.length,
                toremove = []

            for(let i = 0; i < len; i++) {
                let c = this._higherContacts[i]
                
                if(c.side == "left") {
                    c.otherBody._topEntity._rightLower = null
                    toremove.push(i)
                } else if(c.side == "right") {
                    c.otherBody._topEntity._leftLower = null
                    toremove.push(i)
                } else if(c.side == "up") {
                    c.otherBody._topEntity._downLower = null
                    toremove.push(i)
                } else {
                    c.otherBody._topEntity._upLower = null
                    toremove.push(i)
                }
            }
            _.pullAt(this._higherContacts, toremove)
        }
    }

    _testResetBounds() {
        resetminx = this._topEntity.minx == this.minx
        resetmaxx = this._topEntity.maxx == this.maxx
        resetminy = this._topEntity.miny == this.miny
        resetmaxy = this._topEntity.maxy == this.maxy
    }
    _resetBounds() {
        if(resetminx) { this._topEntity._resetMinx() }
        if(resetmaxx) { this._topEntity._resetMaxx() }
        if(resetminy) { this._topEntity._resetMiny() }
        if(resetmaxy) { this._topEntity._resetMaxy() }
    }
}

export abstract class SmallBody extends Body {

    _isSensor: boolean
    _layer: number
    _layerGroup: number

    get isSensor(): boolean { return this._isSensor }
    get layer(): string {
        return this._topEntity._world._layerNames[this._layer]
    }
    get layerGroup(): number {
        return this._layerGroup
    }

    set isSensor(val: boolean) {
        this._isSensor = val
        this._clearContacts()
    }
    set layer(val: string) {
        let l = this._entity._world._getLayer(val)
        if(l != this._layer) {
            this._layer = l
            this._clearContacts()
        }
    }
    set layerGroup(val: number) {
        if(val != this._layerGroup) {
            this._layerGroup = val
            this._clearContacts()
        }
    }

    abstract _width: number
    abstract _height: number

    abstract _leftCollide: boolean
    abstract _rightCollide: boolean
    abstract _upCollide: boolean
    abstract _downCollide: boolean

    constructor(entity: Entity, args?: SmallBodyArgs) {
        super(entity, args)

        if(args) {
            this._isSensor = args.isSensor || false
            this._layer = args.layer ? this._entity._world._getLayer(args.layer) : 0
            this._layerGroup = args.layerGroup || 0
        }
    }
}

export class Rect extends SmallBody {

    type = BodyType.RECT

    _width: number
    _height: number

    get width(): number { return this._width }
    get height(): number { return this._height }

    set width(val: number) { 
        this._testResetBounds()
        this._width = val
        this._resetBounds()
        this._clearContacts()
    }
    set height(val: number) { 
        this._testResetBounds()
        this._height = val
        this._resetBounds()
        this._clearContacts()
    }

    get minx(): number { return this._x - this._width/2 }
    get maxx(): number { return this._x + this._width/2 }
    get miny(): number { return this._y - this._height/2 }
    get maxy(): number { return this._y + this._height/2 }

    get _leftCollide(): boolean { return true }
    get _rightCollide(): boolean { return true }
    get _upCollide(): boolean { return true }
    get _downCollide(): boolean { return true }

    constructor(entity: Entity, args: RectArgs) {
        super(entity, args)

        if(args) {
            this._width = args.width
            this._height = args.height
        }
    }
}

export class Line extends SmallBody {

    type = BodyType.LINE

    _size: number

    _isHorizontal: boolean

    _oneway: number // 0: no, 1: up/right, 2: down/left

    get size(): number { return this._size }
    set size(val: number) {
        this._testResetBounds()
        this._size = val
        this._resetBounds()
        this._clearContacts()
    }

    get isHorizontal(): boolean { return this._isHorizontal }
    get isVertical(): boolean { return !this._isHorizontal }
    set isHorizontal(val: boolean) { console.log("[ERROR] Can't set Line.isHorizontal")}
    set isVertical(val: boolean) { console.log("[ERROR] Can't set Line.isVertical")}

    get side(): string { 
        return this._oneway == 0 ? "all" : 
            (this._isHorizontal ? (this._oneway == 1 ? "up" : "down") : (this._oneway == 1 ? "right" : "left")) 
    }
    set side(val: string) { 
        if(this.isHorizontal) {
            if(val == "all") {
                this._oneway = 0
            } else if(val == "down") {
                this._oneway = 2
            } else if(val == "up") {
                this._oneway = 1
            }
        } else {
            if(val == "all") {
                this._oneway = 0
            } else if(val == "right") {
                this._oneway = 1
            } else if(val == "left") {
                this._oneway = 2
            }
        }
    }

    get minx(): number { return this._x - (this._isHorizontal && this._size/2) }
    get maxx(): number { return this._x + (this._isHorizontal && this._size/2) }
    get miny(): number { return this._y - (!this._isHorizontal && this._size/2) }
    get maxy(): number { return this._y + (!this._isHorizontal && this._size/2) }

    get _width(): number { return this._isHorizontal ? this._size : 0 }
    get _height(): number { return this._isHorizontal ? 0 : this._size }

    get _leftCollide(): boolean { return this._oneway == 0 || !this._isHorizontal && this._oneway == 2 }
    get _rightCollide(): boolean { return this._oneway == 0 || !this._isHorizontal && this._oneway == 1 }
    get _upCollide(): boolean { return this._oneway == 0 || this._isHorizontal && this._oneway == 1 }
    get _downCollide(): boolean { return this._oneway == 0 || this._isHorizontal && this._oneway == 2 }

    constructor(entity: Entity, args: LineArgs) {
        super(entity, args)

        if(args) {
            this._size = args.size
            this._isHorizontal = args.isHorizontal
            if(args.side) {
                this.side = args.side
            } else {
                this._oneway = 0
            }
        }
    }
}

const subGridThreshold = 105
const subGridSize = 120

interface GridListener {
    gridContactStart?(body: Body, grid: Grid, x: number, y: number, side: string)
    gridContactEnd?(body: Body, grid: Grid, x: number, y: number, side: string)

    gridOverlapStart?(body: Body, grid: Grid, x: number, y: number, side: string)
    gridOverlapEnd?(body: Body, grid: Grid, x: number, y: number, side: string)
}

// IF THIS IS MODIFIED, ALL OTHER REFERENCES MUST BE ADAPTED
export const EMPTY = 0
export const BLOCK_TILE = 1
export const UP_ONEWAY = 4
export const DOWN_ONEWAY = 2
export const LEFT_ONEWAY = 3
export const RIGHT_ONEWAY = 5

export class Grid extends Body {

    type = BodyType.GRID

    _layer: number
    _layerGroup: number

    _listener: GridListener

    _tileSize: number
    _gridSize: number

    _xdownLeft: number
    _ydownLeft: number
    _subGrids: SubGrid | SubGrid[][]

    _width: number
    _height: number

    static _leftInfo: { line: number } = { line: 0 } // 0: nothing, 1: oneway right, 2: oneway left, 3: solid
    static _rightInfo: { line: number } = { line: 0 } // 0: nothing, 1: oneway left, 2: oneway right, 3: solid
    static _upInfo: { line: number } = { line: 0 } // 0: nothing, 1: oneway down, 2: oneway up, 3: solid
    static _downInfo: { line: number } = { line: 0 } // 0: nothing, 1: oneway up, 2: oneway down, 3: solid

    _newBodies: Body[]
    _oldBodies: Body[]
    
    get minx(): number { console.log('Grid.minx not implemented'); return 0 }
    get maxx(): number { console.log('Grid.maxx not implemented'); return 0 }
    get miny(): number { console.log('Grid.miny not implemented'); return 0 }
    get maxy(): number { console.log('Grid.maxy not implemented'); return 0 }

    get listener(): GridListener { return this._listener }
    set listener(val: GridListener) { this._listener = val }

    get tileSize(): number { return this._tileSize }
    set tileSize(val: number) { console.log("[ERROR] can't set Grid.tileSize") }

    constructor(entity: Entity, args: GridArgs) {
        super(entity, args)

        this._tileSize = args.tileSize || 1
        this._gridSize = subGridSize

        this._layer = args.layer ? entity._world._layerIds[args.layer] : 0
        this._layerGroup = args.layerGroup || 0

        // GET MIN AND MAX
        let minx, maxx, miny, maxy
        if(args.tiles != null) {
            if((args.tiles as TileList).length != null) {
                minx = args.tiles[0].x
                miny = args.tiles[0].y
                maxx = args.tiles[0].x
                maxy = args.tiles[0].y

                for(let tile of args.tiles as any[]) {
                    minx = Math.min(minx, tile.x)
                    miny = Math.min(miny, tile.y)
                    maxx = Math.max(maxx, tile.x)
                    maxy = Math.max(maxy, tile.y)
                }
            } else {
                let t: TileGrid = args.tiles as TileGrid
                minx = t.x
                miny = t.y
                maxx = t.info.length + t.x
                maxy = t.info[0].length + t.y
            }
        } else {
            args.width = args.width || (this._gridSize - 15)
            args.height = args.height || (this._gridSize - 15)
            minx = -Math.floor(args.width/2)
            maxx = minx + args.width
            miny = -Math.floor(args.height/2)
            maxy = miny + args.height
        }

        // INIT EMPTY GRID
        if(maxx - minx > subGridThreshold || maxy - miny > subGridThreshold) {
            minx -= 10
            miny -= 10
            maxx += 10
            maxy += 10

            let w = Math.ceil((maxx - minx) / this._gridSize), h = Math.ceil((maxy - miny) / this._gridSize)

            this._subGrids = new Array(w)
            for(let i = 0; i < w; i++) {
                this._subGrids[i] = new Array(h)
                for(let j = 0; j < h; j++) {
                    this._subGrids[i][j] = new SubGrid(this._gridSize)
                }
            }

            this._xdownLeft = minx
            this._ydownLeft = miny
            this._width = w
            this._height = h
        } else {
            this._subGrids = new SubGrid(this._gridSize)
            this._xdownLeft = Math.floor((maxx - subGridThreshold)/2)
            this._ydownLeft = Math.floor((maxy - subGridThreshold)/2)
            this._width = 1
            this._height = 1
        }

        if(args.tiles != null) {
            if((args.tiles as TileList).length != null) {
                let len = (args.tiles as TileList).length
                for(let t of args.tiles as TileList) {
                    this._setTile(
                        t.x - this._xdownLeft, 
                        t.y - this._ydownLeft, 
                        t.shape, 
                        t.data
                    )
                }
            } else {
                this._setTiles(
                    (args.tiles as TileGrid).x - this._xdownLeft, 
                    (args.tiles as TileGrid).y - this._ydownLeft, 
                    (args.tiles as TileGrid).info.length, 
                    (args.tiles as TileGrid).info[0].length, 
                    (x, y) => (args.tiles as TileGrid).info[x - (args.tiles as TileGrid).x][y - (args.tiles as TileGrid).y]
                )
            }
        }
    }


    globalToTile(x: number, y: number): { x: number, y: number } {
        return { x: Math.floor(x - this._x - this._xdownLeft), y: Math.floor(y - this._y - this._ydownLeft) }
    }

    getTile(x: number, y: number): { shape: number, data: any } {
        x -= this._xdownLeft
        y -= this._ydownLeft
        let subgrid: SubGrid

        if(this._subGrids instanceof SubGrid) {
            if(x >= 0 && y >= 0 && x < this._gridSize && y < this._gridSize) {
                subgrid = this._subGrids
            } else {
                return { shape: 0, data: null }
            }
        } else {
            let gridx = Math.floor(x / this._gridSize), gridy = Math.floor(y / this._gridSize)
            if(gridx >= 0 && gridy >= 0 && gridx < this._width && gridy < this._height) {
                subgrid = this._subGrids[gridx][gridy]
                if(!subgrid) {
                    return { shape: 0, data: null }
                }
                x -= gridx * this._gridSize
                y -= gridy * this._gridSize
            } else {
                return { shape: 0, data: null }
            }
        }

        return { shape: subgrid.shape[x][y], data: subgrid.data[x][y] }
    }
    setTile(x: number, y: number, shape: number, data) {
        this._expandGrid(x - this._xdownLeft, y - this._ydownLeft, x - this._xdownLeft, y - this._ydownLeft)

        x -= this._xdownLeft
        y -= this._ydownLeft

        this._setTile(x, y, shape, data)
    }

    clearTile(x: number, y: number) {
        x -= this._xdownLeft
        y -= this._ydownLeft

        if(x >= 0 && y >= 0 && x < this._gridSize * this._width && y < this._gridSize * this._height) {
            this._setTile(x, y, 0, null)
        }
    }

    setTiles(args: TileArgs) {
        let minx, maxx, miny, maxy,
            list = (args as TileList).length != null
        if(list) {
            let t = args as TileList
            if(!t.length) {
                return
            }
            minx = t[0].x
            miny = t[0].y
            maxx = t[0].x
            maxy = t[0].y

            for(let tile of t as any[]) {
                minx = Math.min(minx, tile.x)
                miny = Math.min(miny, tile.y)
                maxx = Math.max(maxx, tile.x)
                maxy = Math.max(maxy, tile.y)
            }
        } else {
            let t = args as TileGrid
            minx = t.x
            miny = t.y
            maxx = t.info.length + t.x
            maxy = t.info[0].length + t.y
        }

        minx -= this._xdownLeft
        maxx -= this._xdownLeft
        miny -= this._ydownLeft
        maxy -= this._ydownLeft

        this._expandGrid(minx, maxx, miny, maxy)

        if(list) {
            for(let t of args as TileList) {
                this._setTile(t.x - this._xdownLeft, t.y - this._ydownLeft, t.shape, t.data)
            }
        } else {
            this._setTiles(
                minx, miny, 
                (args as any).info.length, (args as TileGrid).info[0].length, 
                (x, y) => {
                    return (args as TileGrid).info[x - (args as any).x][y - (args as any).y]
                }
            )
        }
    }
    clearTiles(args: { x: number, y: number, width: number, height: number } | { x: number, y: number }[]) {
        this._clearTiles(args, { shape: 0, data: null })
    }
    forTiles(x: number, y: number, width: number, height: number, lambda: (x: number, y: number, shape: number, data) => ({ shape: number, data? } | number)) {
        this._expandGrid(x - this._xdownLeft, y - this._ydownLeft, x + width - this._xdownLeft, y + height - this._ydownLeft)

        this._setTiles(
            x - this._xdownLeft, y - this._ydownLeft, 
            width, height, (xx, yy, shape, data) => lambda(xx, yy, shape, data)
        )
    }

    getTileShape(x: number, y: number): number {
        return this.getTile(x, y).shape
    }
    setTileShape(x: number, y: number, shape: number) {
        this._expandGrid(x - this._xdownLeft, y - this._ydownLeft, x - this._xdownLeft, y - this._ydownLeft)

        x -= this._xdownLeft
        y -= this._ydownLeft

        this._setTile(x, y, shape)
    }
    clearTileShape(x: number, y: number) {
        x -= this._xdownLeft
        y -= this._ydownLeft
        if(x >= 0 && y >= 0 && x < this._width * this._gridSize && y < this._height * this._gridSize) {
            this._setTile(x, y, 0)
        }
    }

    clearTileShapes(args: { x: number, y: number }[] | { x: number, y: number, width: number, height: number }) {
        this._clearTiles(args, 0)
    }
    _clearTiles(args: { x: number, y: number }[] | { x: number, y: number, width: number, height: number }, zero: number | { shape: number, data? }) {
        if((args as any).length != null) {
            if(typeof zero === "number") {
                for(let t of args as any[]) {
                    this.clearTileShape(t.x, t.y)
                }
            } else {
                for(let t of args as any[]) {
                    this.clearTile(t.x, t.y)
                }
            }
        } else {
            let x = Math.max(0, (args as any).x - this._xdownLeft),
                y = Math.max(0, (args as any).y - this._ydownLeft);
            (args as any).width = Math.min(this._width * this._gridSize, (args as any).x + (args as any).width) - x - this._xdownLeft;
            (args as any).height = Math.min(this._height * this._gridSize, (args as any).y + (args as any).height) - y - this._ydownLeft;

            if((args as any).width > 0 && (args as any).height > 0) {
                this._setTiles(x, y, (args as any).width, (args as any).height, (x, y) => zero)
            }
        }
    }
    /* _getUpInfo(shape: number, otherShape: number) {
        if(shape == 1) {
            if(otherShape == 1) {
                Grid._upInfo.line = -1
            } else {
                Grid._upInfo.line = 1
            }
        } else if(shape == 4) {
            if(otherShape == 1) {
                Grid._upInfo.line = 2
            } else if(otherShape == 2) {
                Grid._upInfo.line = 0
            } else {
                Grid._upInfo.line = 1
            }
        } else {
            if(otherShape == 1 || otherShape == 2) {
                Grid._upInfo.line = 2
            } else {
                Grid._upInfo.line = -1
            }
        }
    }
    _getRightInfo(shape: number, otherShape: number) {
        if(shape == 1) {
            if(otherShape == 1) {
                Grid._rightInfo.line = -1
            } else {
                Grid._rightInfo.line = 1
            }
        } else if(shape == 5) {
            if(otherShape == 1) {
                Grid._rightInfo.line = 2
            } else if(otherShape == 3) {
                Grid._rightInfo.line = 0
            } else {
                Grid._rightInfo.line = 1
            }
        } else {
            if(otherShape == 1 || otherShape == 3) {
                Grid._rightInfo.line = 2
            } else {
                Grid._rightInfo.line = -1
            }
        }
    }
    _getDownInfo(shape: number, otherShape: number) {
        if(shape == 1) {
            if(otherShape == 1) {
                Grid._downInfo.line = -1
            } else {
                Grid._downInfo.line = 2
            }
        } else if(shape == 2) {
            if(otherShape == 1) {
                Grid._downInfo.line = 1
            } else if(otherShape == 4) {
                Grid._downInfo.line = 0
            } else {
                Grid._downInfo.line = 2
            }
        } else {
            if(otherShape == 1 || otherShape == 4) {
                Grid._downInfo.line = 1
            } else {
                Grid._downInfo.line = -1
            }
        }
    }
    _getLeftInfo(shape: number, otherShape: number) {
        if(shape == 1) {
            if(otherShape == 1) {
                Grid._leftInfo.line = -1
            } else {
                Grid._leftInfo.line = 2
            }
        } else if(shape == 3) {
            if(otherShape == 1) {
                Grid._leftInfo.line = 1
            } else if(otherShape == 5) {
                Grid._leftInfo.line = 0
            } else {
                Grid._leftInfo.line = 2
            }
        } else {
            if(otherShape == 1 || otherShape == 5) {
                Grid._leftInfo.line = 1
            } else {
                Grid._leftInfo.line = -1
            }
        }
    }
    _clearOneBodyColumn(x: number, y: number, xgridOffset: number, ygridOffset: number, column, body: Line) {
        let rely = (y + ygridOffset) - body._y + body._size/2

        if(rely == 0) {
            body._size -= 1

            if(body._size == 0) {
                let i = this._newBodies.indexOf(body)
                if(i >= 0) {
                    this._newBodies.splice(i, 1)
                } else {
                    this._oldBodies.push(body)
                }
            } else {
                body._y += 0.5
            }
        } else if(rely == body._size - 1) {
            body._size -= 1
            if(body._size == 0) {
                let i = this._newBodies.indexOf(body)
                if(i >= 0) {
                    this._newBodies.splice(i, 1)
                } else {
                    this._oldBodies.push(body)
                }
            } else {
                body._y -= 0.5
            }
        } else {
            let newBody = new Line(null, null)
            newBody._entity = this._entity

            newBody._x = x + xgridOffset
            newBody._y = rely/2 + body._y - body._size/2
            newBody._size = rely
            newBody._isHorizontal = false
            newBody._enabled = true
            newBody._layer = 0
            newBody._layerGroup = 0
            newBody._grid = this
            newBody._oneway = body._oneway
            newBody._isSensor = false
            
            this._newBodies.push(newBody)
            for(let i = body._y - body._size/2 - ygridOffset; i < y; i++) {
                column[i] = newBody
            }

            body._y += (rely + 1)/2
            body._size -= (rely + 1)
        }
        column[y] = null
    }
    _clearOneBodyRow(x: number, y: number, xgridOffset: number, ygridOffset: number, row, body: Line) {
        let relx = (x + xgridOffset) - body._x + body._size/2
        
        if(relx == 0) {
            body._size -= 1

            if(body._size == 0) {
                let i = this._newBodies.indexOf(body)
                if(i >= 0) {
                    this._newBodies.splice(i, 1)
                } else {
                    this._oldBodies.push(body)
                }
            } else {
                body._x += 0.5
            }
        } else if(relx == body._size-1) {
            body._size -= 1

            if(body._size == 0) {
                let i = this._newBodies.indexOf(body)
                if(i >= 0) {
                    this._newBodies.splice(i, 1)
                } else {
                    this._oldBodies.push(body)
                }
            } else {
                body._x -= 0.5
            }
        } else {
            let newBody = new Line(null, null)
            newBody._entity = this._entity

            newBody._x = relx/2 + body._x - body._size/2
            newBody._y = y + ygridOffset
            newBody._size = relx
            newBody._isHorizontal = true
            newBody._enabled = true
            newBody._layer = 0
            newBody._layerGroup = 0
            newBody._grid = this
            newBody._oneway = body._oneway
            newBody._isSensor = false
            
            this._newBodies.push(newBody)
            for(let i = body._x - body._size/2 - xgridOffset; i < x; i++) {
                row[i] = newBody
            }

            body._x += (relx + 1)/2
            body._size -= (relx + 1)
        }
        row[x] = null
    }
    _addOneBodyColumn(x: number, y: number, xgridOffset: number, ygridOffset: number, column, info: { line: number }) {
        let upGrow = false,
            upBody: Line
        if(y < this._gridSize-1) {
            upBody = column[y+1]

            if(upBody && info.line == upBody._oneway) {
                upBody._size += 1
                upBody._y -= 0.5
                column[y] = upBody
                upGrow = true
            }
        }

        if(y > 0) {
            let downBody: Line = column[y-1]
            if(downBody && info.line == downBody._oneway) {
                if(upGrow) {
                    let i = this._newBodies.indexOf(downBody)
                    if(i >= 0) {
                        this._newBodies.splice(i, 1)
                    } else {
                        this._oldBodies.push(downBody)
                    }

                    upBody._size += downBody._size
                    upBody._y -= downBody._size/2

                    for(let i = y - downBody._size; i < y; i++) {
                        column[i] = upBody
                    }
                } else {
                    downBody._size += 1
                    downBody._y += 0.5
                    column[y] = downBody
                }
                return
            }
        }
        if(!upGrow) {
            let newBody = new Line(null, null)
            newBody._entity = this._entity

            newBody._x = x + xgridOffset
            newBody._y = y + 0.5 + ygridOffset
            newBody._size = 1
            newBody._isHorizontal = false
            newBody._oneway = info.line
            newBody._enabled = true
            newBody._layer = 0
            newBody._layerGroup = 0
            newBody._grid = this
            newBody._isSensor = false

            this._newBodies.push(newBody)
            column[y] = newBody
        }
    }
    _addOneBodyRow(x: number, y: number, xgridOffset: number, ygridOffset: number, row, info: { line: number }) {
        let upGrow = false,
            upBody: Line

        if(x < this._gridSize-1) {
            upBody = row[x+1]

            if(upBody && info.line == upBody._oneway) {
                upBody._size += 1
                upBody._x -= 0.5
                row[x] = upBody
                upGrow = true
            }
        }

        if(x > 0) {
            let downBody: Line = row[x-1]

            if(downBody && info.line == downBody._oneway) {
                if(upGrow) {
                    let i = this._newBodies.indexOf(downBody)
                    if(i >= 0) {
                        this._newBodies.splice(i, 1)
                    } else {
                        this._oldBodies.push(downBody)
                    }

                    upBody._size += downBody._size
                    upBody._x -= downBody._size/2

                    for(let i = x - downBody._size; i < x; i++) {
                        row[i] = upBody
                    }
                } else {
                    downBody._size += 1
                    downBody._x += 0.5
                    row[x] = downBody
                }
                return
            }
        }
        if(!upGrow) {
            let newBody = new Line(null, null)
            newBody._entity = this._entity

            newBody._x = x + 0.5 + xgridOffset
            newBody._y = y + ygridOffset
            newBody._size = 1
            newBody._isHorizontal = true
            newBody._oneway = info.line
            newBody._enabled = true
            newBody._layer = 0
            newBody._layerGroup = 0
            newBody._grid = this
            newBody._isSensor = false
            
            this._newBodies.push(newBody)
            row[x] = newBody
        }
    }

    _updateTileBodyInSmallGrid(subgrid: SubGrid, x: number, y: number, shape: number) {
        // LEFT
        if(x == 0) { this._getLeftInfo(shape, 0) }
        else { this._getLeftInfo(shape, subgrid.shape[x-1][y]) }
        let line = subgrid.columns[x]
        let body = line[y]
        if(((body && body._oneway) || -1) != Grid._leftInfo.line) {
            if(body) this._clearOneBodyColumn(x, y, this._xdownLeft, this._ydownLeft, line, body)
            if(Grid._leftInfo.line != -1) { this._addOneBodyColumn(x, y, this._xdownLeft, this._ydownLeft, line, Grid._leftInfo) }
        }
        
        // RIGHT
        if(x == this._gridSize - 1) { this._getRightInfo(shape, 0) } 
        else { this._getRightInfo(shape, subgrid.shape[x+1][y]) }
        line = subgrid.columns[x+1]
        body = line[y]
        if(((body && body._oneway) || -1) != Grid._rightInfo.line) {
            if(body) this._clearOneBodyColumn(x+1, y, this._xdownLeft, this._ydownLeft, line, body)
            if(Grid._rightInfo.line != -1) { this._addOneBodyColumn(x+1, y, this._xdownLeft, this._ydownLeft, line, Grid._rightInfo) }
        }
        
        // DOWN
        if(y == 0) { this._getDownInfo(shape, 0) } 
        else { this._getDownInfo(shape, subgrid.shape[x][y-1]) }
        line = subgrid.rows[y]
        body = line[x]
        if(((body && body._oneway) || -1) != Grid._downInfo.line) {
            if(body) this._clearOneBodyRow(x, y, this._xdownLeft, this._ydownLeft, line, body)
            if(Grid._downInfo.line != -1) { this._addOneBodyRow(x, y, this._xdownLeft, this._ydownLeft, line, Grid._downInfo) }
        }
        
        // UP
        if(y == this._gridSize - 1) { this._getUpInfo(shape, 0) } 
        else { this._getUpInfo(shape, subgrid.shape[x][y+1]) }
        line = subgrid.rows[y+1]
        body = line[x]
        if(((body && body._oneway) || -1) != Grid._upInfo.line) {
            if(body) this._clearOneBodyRow(x, y+1, this._xdownLeft, this._ydownLeft, line, body)
            if(Grid._upInfo.line != -1) { this._addOneBodyRow(x, y+1, this._xdownLeft, this._ydownLeft, line, Grid._upInfo) }
        }
    }

    _updateTileBodyInBigGrid(subgrid: SubGrid, gridx: number, gridy: number, x: number, y: number, shape: number) {
        let lines, 
            xoffset = this._xdownLeft + gridx * this._gridSize, 
            yoffset = this._ydownLeft + gridy * this._gridSize

        // ADJACENT SHAPE CALCULATION
        // LEFT
        if(x == 0) {
            if(gridx == 0) { this._getLeftInfo(shape, 0) } 
            else { this._getLeftInfo(shape, this._subGrids[gridx-1][gridy].shape[this._gridSize-1][y]) }
        } else {
            this._getLeftInfo(shape, subgrid.shape[x-1][y])
        }
        lines = subgrid.columns[x]
        let body = lines[y] as Line
        if(((body && body._oneway) || -1) != Grid._leftInfo.line) {
            if(body) this._clearOneBodyColumn(x, y, xoffset, yoffset, lines, body)
            if(Grid._leftInfo.line != -1) this._addOneBodyColumn(x, y, xoffset, yoffset, lines, Grid._leftInfo)
        }

        // RIGHT
        if(x == this._gridSize-1) {
            if(gridx == this._width-1) { this._getRightInfo(shape, 0); lines = subgrid.columns[x+1] } 
            else { this._getRightInfo(shape, this._subGrids[gridx + 1][gridy].shape[0][y]); lines = this._subGrids[gridx + 1][gridy].columns[0] }
        } else {
            this._getRightInfo(shape, subgrid.shape[x+1][y])
            lines = subgrid.columns[x+1]
        }
        body = lines[y]
        if(((body && body._oneway) || -1) != Grid._rightInfo.line) {
            if(body) this._clearOneBodyColumn(x+1, y, xoffset, yoffset, lines, body)
            if(Grid._rightInfo.line != -1) this._addOneBodyColumn(x+1, y, xoffset, yoffset, lines, Grid._rightInfo)
        }

        // DOWN
        if(y == 0) {
            if(gridy == 0) { this._getDownInfo(shape, 0) } 
            else { this._getDownInfo(shape, this._subGrids[gridx][gridy-1].shape[x][this._gridSize-1]) }
        } else {
            this._getDownInfo(shape, subgrid.shape[x][y-1])
        }
        lines = subgrid.rows[y]
        body = lines[x]
        if(((body && body._oneway) || -1) != Grid._downInfo.line) {
            if(body) this._clearOneBodyRow(x, y, xoffset, yoffset, lines, body)
            if(Grid._downInfo.line != -1) { this._addOneBodyRow(x, y, xoffset, yoffset, lines, Grid._downInfo) }
        }

        // UP
        if(y == this._gridSize-1) {
            if(gridy == this._height-1) { this._getUpInfo(shape, 0); lines = subgrid.rows[y+1] } 
            else { this._getUpInfo(shape, this._subGrids[gridx][gridy+1].shape[x][0]); lines = this._subGrids[gridx][gridy+1].rows[0] }
        } else {
            this._getUpInfo(shape, subgrid.shape[x][y+1])
            lines = subgrid.rows[y+1]
        }
        body = lines[x]
        if(((body && body._oneway) || -1) != Grid._rightInfo.line) {
            if(body) this._clearOneBodyRow(x, y+1, xoffset, yoffset, lines, body)
            if(Grid._upInfo.line != -1) { this._addOneBodyRow(x, y+1, xoffset, yoffset, lines, Grid._upInfo) }
        }
    }*/

    _updateTileBody(subgrid: SubGrid, x: number, y: number, xoffset: number, yoffset: number, shape: number, layer: number, layerGroup: number) {
        // REMOVE CURRENTLY PRESENT BODY

        // TRY TO EXTEND EXISTING ADJACENT BODIES

        // UPDATE ADJACENT: IF EMPTY OR SIDE ADDED INSTEAD OF FULL, POTENTIALLY ADD FULL AND VICE VERSA

    }
    _updateTileSensorBody(subgrid: SubGrid, x: number, y: number, xoffset: number, yoffset: number, isSensor: boolean) {
        if (isSensor) {
            let rightBody: Rect, body: Rect

            if (x < this._gridSize-1) {
                rightBody = subgrid.sensors[x+1][y]

                if (rightBody) {
                    rightBody._width += 1
                    rightBody._x -= 0.5
                    subgrid.sensors[x][y] = rightBody
                    body = rightBody
                }
            }

            if (x > 0) {
                let leftBody: Rect = subgrid.sensors[x-1][y]

                if (leftBody) {
                    if(body) {
                        let i = this._newBodies.indexOf(leftBody)
                        if(i >= 0) this._newBodies.splice(i, 1)
                        else this._oldBodies.push(leftBody)

                        rightBody._width += leftBody._width
                        rightBody._x -= leftBody._width/2

                        for(let i = leftBody._y - xoffset - leftBody._width; i < x; i++) {
                            subgrid.sensors[i][y] = rightBody
                        }
                    } else {
                        leftBody._width += 1
                        leftBody._x += 0.5
                        subgrid.sensors[x][y] = leftBody
                        body = leftBody
                    }
                }
            }

            if (!body) {
                body = new Rect(null, null)
                body._entity = this._entity

                body._x = x + 0.5 + xoffset
                body._y = y + 0.5 + yoffset
                body._width = 1
                body._height = 1
                body._enabled = true
                body._layer = 0
                body._layerGroup = 0
                body._grid = this
                body._isSensor = false
                
                this._newBodies.push(body)
                subgrid.sensors[x][y] = body
            }

            let downBody: Rect
            if (y > 0) {
                downBody = subgrid.sensors[x][y-1]

                if(downBody && downBody._x == body._x && downBody._width == body._width) {
                    downBody._height += 1
                    downBody._y += 0.5
                    for(let i = downBody._x - downBody._width/2; i < downBody._x + downBody._width/2; i++) {
                        subgrid.sensors[i][y] = downBody
                    }
                }
            }

            if (y < this._gridSize) {
                let upBody = subgrid.sensors[x][y+1]

                if(upBody && upBody._x == body._x && upBody._width == body._width) {
                    if(downBody) {
                        let i = this._newBodies.indexOf(upBody)
                        if(i >= 0) {
                            this._newBodies.splice(i, 1)
                        } else {
                            this._oldBodies.push(upBody)
                        }

                        downBody._height += upBody._height
                        downBody._y += upBody._height/2

                        for(let i = x - downBody._width; i < x; i++) {
                            subgrid.sensors[i][y] = upBody
                        }
                    } else {
                        upBody._height += 1
                        upBody._y -= 0.5
                        for(let i = upBody._x - upBody._width/2; i < upBody._x + upBody._width/2; i++) {
                            subgrid.sensors[i][y] = upBody
                        }
                    }
                }
            }
        } else {
            let body = subgrid.sensors[x][y]

            if (body._height == 1) {
                if(body._width == 1) {
                    let i = this._newBodies.indexOf(body)
                    if(i >= 0) this._newBodies.splice(i, 1)
                    else this._oldBodies.push(body)
                } else if (x == body._x - body._width/2) {
                    body._width -= 1
                    body._x += 0.5
                } else if (x == body._x + body._width/2 - 1) {
                    body._width -= 1
                    body._x -= 0.5
                } else {
                    body = new Rect(null, null)
                    body._entity = this._entity

                    body._x = x + 0.5 + xoffset
                    body._y = y + 0.5 + yoffset
                    body._width = 1
                    body._height = 1
                    body._enabled = true
                    body._layer = 0
                    body._layerGroup = 0
                    body._grid = this
                    body._isSensor = false
                }
            } else if (body._width == 1) {
                if (body._height == 1) {
                    let i = this._newBodies.indexOf(body)
                    if(i >= 0) this._newBodies.splice(i, 1)
                    else this._oldBodies.push(body)
                } else if (y == body._y + body._height/2 - 1) {
                    body._height -= 1
                    body._y -= 1
                } else if (y == body._y - body._height/2) {
                    body._height -= 1
                    body._y += 0.5
                } else {
                    // TODO
                }
            } else { 
                if (x == body._x - body._width/2) {
                    if (y == body._y - body._height/2) {
                        // TODO
                        body._height -= 1
                        body._y += 0.5
                        body = new Rect(null, null)
                        body._entity = this._entity

                        body._x = x + 0.5 + xoffset
                        body._y = y + 0.5 + yoffset
                        body._width = 1
                        body._height = 1
                        body._enabled = true
                        body._layer = 0
                        body._layerGroup = 0
                        body._grid = this
                        body._isSensor = false
                        
                        this._newBodies.push(body)
                        subgrid.sensors[x][y] = body
                    } else if (y == body._y + body._height/2 - 1) {
                        // TODO
                    } else {
                        // TODO    
                    }
                } else if (x == body._x + body._width/2 - 1) {
                    if (y == body._y - body._height/2) {
                        // TODO
                    } else if (y == body._y + body._height/2 - 1) {
                        // TODO
                    } else {
                        // TODO                       
                    }
                } else {
                    if (y == body._y - body._height/2) {
                        // TODO
                    } else if (y == body._y + body._height/2 - 1) {
                        // TODO
                    } else {
                        // TODO 
                    }
                }
            }
            subgrid.sensors[x][y] = null
        }
    }

    _updateTileBodies(subgrid: SubGrid, x: number, y: number, xoffset: number, yoffset: number, shape: number, data) {
        this._oldBodies = []
        this._newBodies = []

        let newLayer = typeof data != "undefined" && typeof data.layer != "undefined" ? this._entity.world._layerIds[data.layer] : this._layer,
            newLayerGroup = typeof data != "undefined" && typeof data.layerGroup != "undefined" ? data.layerGroup : this._layerGroup,
            oldData = subgrid.data[x][y]
            
        if (shape != subgrid.shape[x][y] 
            || ((oldData || typeof oldData.layer == "undefined") ? newLayer != this._layer : newLayer != data.layer)
            || ((oldData || typeof oldData.layerGroup == "undefined") ? newLayerGroup != this._layerGroup : newLayerGroup != data.layerGroup)) {
            this._updateTileBody(subgrid, x, y, xoffset, yoffset, shape, newLayer, newLayerGroup)
        }

        if (typeof data != "undefined" && typeof data.isSensor != "undefined" && subgrid.sensors[x][y] != data.isSensor) {
            this._updateTileSensorBody(subgrid, x, y, xoffset, yoffset, data.isSensor)
        }

        for(let b of this._oldBodies) { this._entity.removeBody(b) }
        for(let b of this._newBodies) { this._entity._addBody(b) }
    }

    _setTile(x: number, y: number, shape: number, data?) {
        let subgrid: SubGrid

        // FIND WHICH SUBGRID TO AFFECT + AJUST X/Y POSITION
        if(this._subGrids instanceof SubGrid) {
            subgrid = this._subGrids
        } else {
            let gridx = Math.floor(x / this._gridSize), gridy = Math.floor(y / this._gridSize)

            subgrid = this._subGrids[gridx][gridy]
            
            x -= gridx * this._gridSize
            y -= gridy * this._gridSize
        }

        // BODY MODIFICATION
        this._updateTileBodies(subgrid, x, y, shape, data)

        // DATA MODIFICATION
        if(typeof data != "undefined") {
            if(subgrid.data[x][y]) {
                subgrid.data[x][y] = Object.assign(subgrid.data[x][y], data)
            } else{
                subgrid.data[x][y] = _.cloneDeep(data)
            }
        }
        subgrid.shape[x][y] = shape

        this._topEntity._resetMaxx()
        this._topEntity._resetMinx()
        this._topEntity._resetMaxy()
        this._topEntity._resetMiny()
    }
    _setTiles(x: number, y: number, width: number, height: number, info: (x: number, y: number, shape: number, data?) => ({ shape: number, data? } | number)) {
        var small = this._subGrids instanceof SubGrid
        if(small) {
            this._newBodies = []
            this._oldBodies = []

            this._setTilesInSubGrid(
                x, x + width,
                y, y + height,
                this._subGrids as SubGrid,
                (xx, yy, shape, data?) => info(xx + this._xdownLeft, yy + this._ydownLeft, shape, data)
            )

            for(let b of this._oldBodies) { this._entity.removeBody(b) }
            for(let b of this._newBodies) { this._entity._addBody(b) }
        } else {
            this._newBodies = []
            this._oldBodies = []

            let gridminx = Math.floor(x / this._gridSize),
                gridminy = Math.floor(y / this._gridSize),
                gridmaxx = Math.floor((x + width) / this._gridSize),
                gridmaxy = Math.floor((y + height) / this._gridSize)

            for(let gridx = gridminx; gridx <= gridmaxx; gridx++) {
                for(let gridy = gridminy; gridy <= gridmaxy; gridy++) {
                    let xoff = gridx * this._gridSize, yoff = gridy * this._gridSize
                    let xoff2 = xoff + this._xdownLeft, yoff2 = yoff + this._ydownLeft

                    let subgrid: SubGrid = this._subGrids[gridx][gridy]
                    if(!subgrid) {
                        subgrid = new SubGrid(this._gridSize)
                        this._subGrids[gridx][gridy] = subgrid
                    }

                    this._setTilesInSubGrid(
                        Math.max(0, x - xoff),
                        Math.min(this._gridSize, x + width - xoff),
                        Math.max(0, y - yoff),
                        Math.min(this._gridSize, y + height - yoff),
                        subgrid,
                        (x, y, shape, data?) => info(x + xoff2, y + yoff2, shape, data)
                    )
                }
            }

            for(let b of this._oldBodies) { this._entity.removeBody(b) }
            for(let b of this._newBodies) { this._entity._addBody(b) }
        }

        this._topEntity._resetMaxx()
        this._topEntity._resetMinx()
        this._topEntity._resetMaxy()
        this._topEntity._resetMiny()
    }
    _setTilesInSubGrid(minx: number, maxx: number, miny: number, maxy: number, subgrid: SubGrid, 
                        info: (x: number, y: number, shape: number, data?) => ({ shape: number, data? } | number)) {
        for(let i = minx; i < maxx; i++) {
            for(let j = miny; j < maxy; j++) {
                let prevshape = subgrid.shape[i][j]
                let res = info(i, j, prevshape, subgrid.data[i][j])
                if(res) {
                    if(typeof res == "number") {
                        this._updateTileBodies(subgrid, i, j, res, undefined)
                        subgrid.shape[i][j] = res
                    } else {
                        this._updateTileBodies(subgrid, i, j, res.shape, res.data)
                        subgrid.shape[i][j] = res.shape
                        if(typeof res.data != "undefined") {
                            if(subgrid.data[i][j]) {
                                subgrid.data[i][j] = Object.assign(subgrid.data[i][j], res.data)
                            } else{
                                subgrid.data[i][j] = _.cloneDeep(res.data)
                            }
                        }
                    }
                }
            }
        }            
    }
    
    _expandGrid(minx: number, miny: number, maxx: number, maxy: number) {
        if(minx < 0 || miny < 0 || maxx >= this._gridSize * this._width || maxy >= this._gridSize * this._height) {
            let left = Math.max(Math.ceil(-minx / this._gridSize), 0),
                right = Math.max(Math.floor(maxx / this._gridSize) - this._width + 1, 0),
                up = Math.max(Math.floor(maxy / this._gridSize) - this._height + 1, 0),
                down = Math.max(Math.ceil(-miny / this._gridSize), 0)

            let grid, newWidth, newHeight

            if(left > 0 || right > 0 || up > 0 || down > 0) {
                if(this._subGrids instanceof SubGrid) { 
                    newWidth = left + 1 + right
                    newHeight = down + 1 + up
                    grid = new Array(newWidth)
                    for(let i = 0; i < newWidth; i++) {
                        grid[i] = new Array(newHeight)
                    }
                    for(let i = 0; i < newWidth; i++) {
                        for(let j = 0; j < newHeight; j++) {
                            if(i == left && j == down) {
                                grid[i][j] = this._subGrids
                            } else {
                                grid[i][j] = new SubGrid(this._gridSize)
                            }
                        }
                    }
                } else {
                    newWidth = left + this._width + right
                    newHeight = down + this._height + up
                    grid = new Array(newWidth)
                    for(let i = 0; i < newWidth; i++) {
                        grid[i] = new Array(newHeight)
                    }
                    for(let i = 0; i < newWidth; i++) {
                        for(let j = 0; j < newHeight; j++) {
                            if(i >= left && j >= down && i < left + this._width && j < down + this._height) {
                                grid[i][j] = this._subGrids[i - left][j - down]
                            } else {
                                grid[i][j] = new SubGrid(this._gridSize)
                            }
                        }
                    }
                }

                if(right > 0) {
                    for(let i = down; i < down + this._height; i++) {
                        grid[left + this._width][i].columns[0] = grid[left + this._width - 1][i].columns[this._gridSize]
                    }
                }
                if(up > 0) {
                    for(let i = left; i < left + this._width; i++) {
                        grid[i][down + this._height].rows[0] = grid[i][down + this._height - 1].rows[this._gridSize]
                    }
                }

                this._subGrids = grid
                this._width = newWidth
                this._height = newHeight
                this._xdownLeft -= left * this._gridSize
                this._ydownLeft -= down * this._gridSize
            }
        }
    }
}

export class SubGrid {

    shape: number[][]
    data: any[][]

    bodies: SmallBody[][]
    sensors: Rect[][]

    constructor(size: number) {
        this.shape = new Array(size)
        this.data = new Array(size)
        this.bodies = new Array(size)
        this.sensors = new Array(size)

        for(let i = 0; i < size; i++) {
            this.shape[i] = new Array(size)
            this.data[i] = new Array(size)
            this.bodies[i] = new Array(size)
            this.sensors[i] = new Array(size)

            for(let j = 0; j < size; j++) {
                this.shape[i][j] = 0
            }
        }
    }
}