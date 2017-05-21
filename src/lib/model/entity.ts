import * as _ from 'lodash'

import { VBH, SimpleVBH, IMoveAABB, IAABB } from '../vbh/vbh'

import { Body, RectArgs, LineArgs, GridArgs } from './body'
import { World } from './world'
import { Rect, Line, Grid } from './body'
import { Contact, RelativeContact } from './contact'

import { ParentType } from './enums'

type PureEntityArgs = {
    x: number
    y: number
    level?: number
    type?: string

    body?: (RectArgs | LineArgs | GridArgs)
    bodies?: (RectArgs | LineArgs | GridArgs) | (RectArgs | LineArgs | GridArgs)[]
} 

export type EntityArgs = PureEntityArgs
| (RectArgs & { level?: number, type: "rect" }) 
| (LineArgs & { level?: number, type: "line" }) 
| (GridArgs & { level?: number, type: "grid" })

export interface EntityListener {

    crushStart?()
    crushEnd?()

    contactStart?(body: Body, otherBody: Body, side: string)
    contactEnd?(body: Body, otherBody: Body, side: string)

    overlapStart?(body: Body, otherBody: Body)
    overlapEnd?(body: Body, otherBody: Body)

    gridContactStart?(body: Body, grid: Grid, x: number, y: number, side: string)
    gridContactEnd?(body: Body, grid: Grid, x: number, y: number, side: string)

    gridOverlapStart?(body: Body, grid: Grid, x: number, y: number, side: string)
    gridOverlapEnd?(body: Body, grid: Grid, x: number, y: number, side: string)
}

export class Entity implements IMoveAABB {

    _world: World

    _listener: EntityListener

    _parent: Entity // a rect of higher level
    _parentType: number // 0: static, 1: follow
    _childs: Entity[]
    _topEntity: Entity

    _level: number

    _bodies: Body | VBH<Body>
    _allBodies: VBH<Body>
    _grids: Grid | Grid[]
    
    _x: number
    _y: number

    _vx: number
    _vy: number

    _leftLower: Contact
    _rightLower: Contact
    _upLower: Contact
    _downLower: Contact

    _minx: number
    _maxx: number
    _miny: number
    _maxy: number

    // TMP
    name: string

    // FOR VBH 
    get enabled(): boolean { return true }

    get world(): World { return this._world }
    set world(val: World) { console.log("[ERROR] can't set Entity.world") }

    get listener(): EntityListener { return this._listener }
    set listener(val: EntityListener) { this._listener = val }

    // HIERARCHY
    get parent(): Entity { return this._parent }
    set parent(val: Entity) { this._setParent(val, this._parentType) }

    get parentType(): string { return this._parentType == 0 ? "static" : "follow" }
    set parentType(val: string) {
        if(this._parent != null) {
            this._setParent(this._parent, val == "static" ? 0 : 1)
        } else {
            this._parentType = val == "static" ? 0 : 1
        }
    }
    get childs(): Entity[] { return _.clone(this._childs) }
    set childs(val: Entity[]) { console.log("[ERROR] can't set Entity.childs") }

    get body(): Body {
        if(this._bodies instanceof Body) {
            return this._bodies
        } else {
            if(this._grids && this._grids instanceof Grid) {
                return this._grids
            } else {
                return this._bodies.all().find(b => b instanceof Grid)
            }
        }
    }
    set body(val: Body) { console.log("[ERROR] can't set Entity.body") }
    get bodies(): Body[] {
        if(this._bodies) {
            if(this._bodies instanceof Body) {
                return [this._bodies]
            } else {
                if(this._grids) {
                    if(this._grids instanceof Grid) {
                        return this._bodies.all().filter(b => !b._grid).concat([this._grids])
                    } else {
                        return this._bodies.all().filter(b => !b._grid).concat(this._grids)
                    }
                } else {
                    return this._bodies.all().filter(b => !b._grid)
                }
            }
        } else {
            return []
        }
    }
    set bodies(val: Body[]) { console.log("[ERROR] can't set Entity.bodies") }

    get level(): number { return this._level }
    set level(val: number) { 
        if(val > this._level) {
            this._forAllBodies(b => {
                if(b._higherContacts) {
                    let len = b._higherContacts.length,
                        remove = []

                    for(let i = 0; i < len; i++) {
                        let c = b._higherContacts[i]

                        if(c.body1._topEntity == this) {
                            if(c.body2._topEntity._level <= val) {
                                if(c.isHorizontal) {
                                    c.body2._topEntity._leftLower = null
                                } else {
                                    c.body2._topEntity._downLower = null
                                }
                                remove.push(i)
                            }
                        } else {
                            if(c.body1._topEntity._level <= val) {
                                if(c.isHorizontal) {
                                    c.body1._topEntity._rightLower = null
                                } else {
                                    c.body1._topEntity._upLower = null
                                }
                                remove.push(i)
                            }
                        }
                        _.pullAt(b._higherContacts, remove)
                    }
                }
            })
        } else if(val < this._level) {
            for(let t of ["_upLower", "_downLower", "_leftLower", "_rightLower"]) {
                let c: Contact = this[t]
                if(c) {
                    if(c.body1._topEntity == this) {
                        if(c.body2._topEntity.level >= val) {
                            let i = c.body2._higherContacts.indexOf(c)
                            c.body2._higherContacts.splice(i, 1)
                            this[t] = null
                        }
                    } else {
                        if(c.body1._topEntity.level >= val) {
                            let i = c.body2._higherContacts.indexOf(c)
                            c.body2._higherContacts.splice(i, 1)
                            this[t] = null
                        }
                    }
                }
            }
        }
        this._world._ents[this._level].splice(this._world._ents[this._level].indexOf(this), 1)
        this._level = val
        if(this._world._ents[val]) {
            this._world._ents[val].push(this)
        } else {
            this._world._ents[val] = [this]
        }
    }

    // POSITIONNING
    get x(): number { return this._x - (this._parent != null && this._parent.globalx) }
    get y(): number { return this._y - (this._parent != null && this._parent.globaly) }

    set x(val: number) { this.globalx = val + (this._parent != null && this._parent.globalx) }
    set y(val: number) { this.globaly = val + (this._parent != null && this._parent.globaly) }

    get globalx(): number { return this._x }
    get globaly(): number { return this._y }
    set globalx(val: number) {
        if(this._x != val) {
            // TODO: check if vertical contact is lost
            if(this._leftLower) {
                if(this._leftLower.body1._topEntity == this) {
                    let i = this._leftLower.body2._higherContacts.indexOf(this._leftLower)
                    this._leftLower.body2._higherContacts.splice(i, 1)
                } else {
                    let i = this._leftLower.body1._higherContacts.indexOf(this._leftLower)
                    this._leftLower.body1._higherContacts.splice(i, 1)
                }
                this._leftLower = null
            }

            if(this._rightLower) {
                if(this._rightLower.body1._topEntity == this) {
                    let i = this._rightLower.body2._higherContacts.indexOf(this._rightLower)
                    this._rightLower.body2._higherContacts.splice(i, 1)
                } else {
                    let i = this._rightLower.body1._higherContacts.indexOf(this._rightLower)
                    this._rightLower.body1._higherContacts.splice(i, 1)
                }
                this._rightLower = null
            }
            this._forAllBodies(b => {
                // TODO: move bodies in top parent
                if(b._higherContacts) {
                    let len = b._higherContacts.length,
                        toremove = []

                    for(let i = 0; i < len; i++) {
                        let c = b._higherContacts[i]
                        if(c.body1 == b) {
                            if(c.isHorizontal) {
                                c.body2._topEntity._leftLower = null
                                toremove.push(i)
                            }
                        } else {
                            if(c.isHorizontal) {
                                c.body1._topEntity._rightLower = null
                                toremove.push(i)
                            }
                        }
                    }
                    _.pullAt(b._higherContacts, toremove)
                }
            })

            this._x = val
        }
    }
    set globaly(val: number) { 
        if(this._y != val) {
            // TODO: check if horizontal contact is lost
            if(this._upLower) {
                if(this._upLower.body1._topEntity == this) {
                    let i = this._upLower.body2._higherContacts.indexOf(this._upLower)
                    this._upLower.body2._higherContacts.splice(i, 1)
                } else {
                    let i = this._upLower.body1._higherContacts.indexOf(this._upLower)
                    this._upLower.body1._higherContacts.splice(i, 1)
                }
                this._upLower = null
            }

            if(this._downLower) {
                if(this._downLower.body1._topEntity == this) {
                    let i = this._downLower.body2._higherContacts.indexOf(this._downLower)
                    this._downLower.body2._higherContacts.splice(i, 1)
                } else {
                    let i = this._downLower.body1._higherContacts.indexOf(this._downLower)
                    this._downLower.body1._higherContacts.splice(i, 1)
                }
                this._downLower = null
            }
            this._forAllBodies(b => {
                let len = b._higherContacts.length,
                    toremove = []

                for(let i = 0; i < len; i++) {
                    let c: Contact = b._higherContacts[i]
                    if(c.body1 == b) {
                        if(!c.isHorizontal) {
                            c.body2._topEntity._downLower = null
                            toremove.push(i)
                        }
                    } else {
                        if(!c.isHorizontal) {
                            c.body1._topEntity._upLower = null
                            toremove.push(i)
                        }
                    }
                }
                _.pullAt(b._higherContacts, toremove)
            })

            this._y = val
        }
    }

    get globalvx(): number { return this._vx + (this._parent != null && this._parent.globalvx) }
    get globalvy(): number { return this._vy + (this._parent != null && this._parent.globalvy) }

    set globalvx(val: number) { this.vx = val - (this._parent != null && this._parent.globalvx) }
    set globalvy(val: number) { this.vy = val - (this._parent != null && this._parent.globalvy) }

    get vx(): number { return this._vx }
    get vy(): number { return this._vy }

    set vx(val: number) { this._vx = val }
    set vy(val: number) { this._vy = val }

    get contacts(): RelativeContact[] {
        let res = [this.leftContact, this.downContact, this.rightContact, this.upContact].filter(c => c)
        this._forAllBodies(b => {
            if(b._higherContacts) {
                res.push.apply(res, b._higherContacts.map(c => {
                    let entityHasBody1 = c.body1._topEntity == this,
                        body = entityHasBody1 ? c.body1 : c.body2,
                        otherBody = entityHasBody1 ? c.body2 : c.body1

                    if(body._grid) { body = body._grid }
                    if(otherBody._grid) { otherBody = otherBody._grid }

                    return {
                        body, otherBody,
                        side: entityHasBody1 ? (c.isHorizontal ? "right" : "up") : (c.isHorizontal ? "left" : "down")
                    }
                }))
            }
        })
        return res
    }
    get leftContact(): RelativeContact {
        return this._leftLower && {
            body: this._leftLower.body2._grid || this._leftLower.body2,
            otherBody: this._leftLower.body1._grid || this._leftLower.body1,
            side: "left"
        }
    }
    get rightContact(): RelativeContact {
        return this._rightLower && {
            body: this._rightLower.body1._grid || this._rightLower.body1,
            otherBody: this._rightLower.body2._grid || this._rightLower.body2,
            side: "right"
        }
    }
    get upContact(): RelativeContact {
        return this._upLower && {
            body: this._upLower.body1._grid || this._upLower.body1,
            otherBody: this._upLower.body2._grid || this._upLower.body2,
            side: "up"
        }
    }
    get downContact(): RelativeContact {
        return this._downLower && {
            body: this._downLower.body2._grid || this._downLower.body2,
            otherBody: this._downLower.body1._grid || this._downLower.body1,
            side: "down"
        }
    }

    get isCrushed(): boolean {
        return false
    }

    get minx(): number {
        if(this._minx != null) {
            return this._minx
        } else {
            let tmp = Infinity
            this._forAllBodies(b => {
                tmp = Math.min(tmp, b.minx)
            })
            return tmp
        }
    }
    get miny(): number {
        if(this._miny != null) {
            return this._miny
        } else {
            let tmp = Infinity
            this._forAllBodies(b => {
                tmp = Math.min(tmp, b.miny)
            })
            return tmp
        }
    }
    get maxx(): number {
        if(this._maxx != null) {
            return this._maxx
        } else {
            let tmp = -Infinity
            this._forAllBodies(b => {
                tmp = Math.max(tmp, b.maxx)
            })
            return tmp
        }
    }
    get maxy(): number {
        if(this._maxy != null) {
            return this._maxy
        } else {
            let tmp = -Infinity
            this._forAllBodies(b => {
                tmp = Math.max(tmp, b.maxy)
            })
            return tmp
        }
    }

    constructor(world: World, args: EntityArgs) {
        this._world = world

        this._topEntity = this

        this._x = args.x
        this._y = args.y

        this._vx = 0
        this._vy = 0

        this._level = args.level || 0

        switch(args.type) {
            case null: {
                let a = args as PureEntityArgs
                if(a.body) {
                    this._createBody(a.body)
                } else if(a.bodies) {
                    if((a.bodies as any).length != null) {
                        for(let b of (a.bodies as any[])) {
                            this._createBody(b)
                        }
                    } else {
                        this._createBody(a.bodies as any)
                    }
                }
                break
            }
            case "rect": {
                let a = args as RectArgs
                a.x = 0
                a.y = 0
                this.createRect(a)
                break
            }
            case "line": {
                let a = args as LineArgs
                a.x = 0
                a.y = 0
                this.createLine(a)
                break
            }
            case "grid": {
                let a = args as GridArgs
                a.x = 0
                a.y = 0
                this.createGrid(a)
                break
            }
        }
    }

    // HIERARCHY
    createRect(args: RectArgs): Rect {
        let body = new Rect(this, args)
        this._addBody(body)
        return body
    }
    createLine(args: LineArgs): Line {
        let body = new Line(this, args)
        this._addBody(body)
        return body
    }
    createGrid(args: GridArgs): Grid {
        let body = new Grid(this, args)
        if(!this._grids) {
            this._grids = body
        } else if(this._grids instanceof Grid) {
            this._grids = [body, this._grids]
        } else {
            this._grids.push(body)
        }
        return body
    }
    removeBody(body: Body) {
        if(this._bodies instanceof Body) {
            if(body == this._bodies) {
                this._bodies = null
            }
        } else {
            this._bodies.remove(body)
        }

        let topEntity = this._topEntity
        if(topEntity._allBodies) {
            topEntity._allBodies.remove(body)
        }
        if(topEntity._minx == body.minx) { topEntity._resetMinx() }
        if(topEntity._maxx == body.maxx) { topEntity._resetMaxx() }
        if(topEntity._miny == body.miny) { topEntity._resetMiny() }
        if(topEntity._maxy == body.maxy) { topEntity._resetMaxy() }

        if(body._higherContacts) {
            let len = body._higherContacts.length
            for(let i = 0; i < len; i++) {
                let c: Contact = body._higherContacts[i]
                if(c.body1 == body) {
                    if(c.isHorizontal) {
                        c.body2._topEntity._leftLower = null
                    } else {
                        c.body2._topEntity._downLower = null
                    }
                } else {
                    if(c.isHorizontal) {
                        c.body1._topEntity._rightLower = null
                    } else {
                        c.body1._topEntity._upLower = null
                    }
                }
            }
        }

        for(let t in ["_downLower", "_upLower", "_leftLower", "_rightLower"]) {
            let c: Contact = this[t]
            if(c) {
                if(c.body1 == body) {
                    let i = c.body2._higherContacts.indexOf(c)
                    c.body2._higherContacts.splice(i, 1)
                    this[t] = null
                } else if(c.body2 == body) {
                    let i = c.body1._higherContacts.indexOf(c)
                    c.body1._higherContacts.splice(i, 1)
                    this[t] = null
                }
            }
        }
    }
    _createBody(args: RectArgs | LineArgs | GridArgs) {
        if((args as any).width != null) {
            this._addBody(new Rect(this, args as RectArgs))
        } else if((args as any).size != null) {
            this._addBody(new Line(this, args as LineArgs))
        } else {
            if(!this._grids) {
                this._grids = new Grid(this, args as GridArgs)
            } else if(this._grids instanceof Grid) {
                this._grids = [this._grids, new Grid(this, args as GridArgs)]
            } else {
                this._grids.push(new Grid(this, args as GridArgs))
            }
        }
    }
    _addBody(body: Body) {
        if(this._bodies != null) {
            if(this._bodies instanceof Body) {
                let old = this._bodies
                this._bodies = new SimpleVBH<Body>()
                this._bodies.insert(old)
            }
            this._bodies.insert(body)
        } else {
            this._bodies = body
        }

        let topEntity = this._topEntity
        if(topEntity._allBodies) {
            topEntity._allBodies.insert(body)
        }

        if(!(topEntity._bodies instanceof Body)) {
            topEntity._minx = Math.min(topEntity._minx || Infinity, body.minx)
            topEntity._maxx = Math.max(topEntity._maxx || -Infinity, body.maxx)
            topEntity._miny = Math.min(topEntity._miny || Infinity, body.miny)
            topEntity._maxy = Math.max(topEntity._maxy || -Infinity, body.maxy)
        }
    }
    _forAllBodies(lambda: (b: Body) => void) {
        if(this._allBodies) {
            this._allBodies.forAll(lambda)
        } else if(this._bodies) {
            if(this._bodies instanceof Body) {
                lambda(this._bodies)
            } else {
                this._bodies.forAll(lambda)
            }
        }
    }
    forBodies(lambda: (b: Body) => void) {
        if(this._bodies) {
            if(this._bodies instanceof Body) {
                lambda(this._bodies)
            } else {
                this._bodies.forAll(b => { if(!b._grid) { lambda(b) } })
            }
        }

        if(this._grids) {
            if(this._grids instanceof Grid) {
                lambda(this._grids)
            } else {
                this._grids.forEach(g => lambda(g))
            }
        }
    }
    _forBodies(lambda: (b: Body) => void) {
        if(this._bodies) {
            if(this._bodies instanceof Body) {
                lambda(this._bodies)
            } else {
                this._bodies.forAll(lambda)
            }
        }
    }

    addChild(ent: Entity, parentType?: string) { // static | follow
        ent.setParent(this, parentType)
    }
    removeChild(ent: Entity) {
        ent._setParent(null, 0)
    }
    setParent(parent: Entity, parentType?: string) {
        this._setParent(parent, parentType && parentType == "follow" ? 1 : 0)
    }

    _setParent(parent: Entity, parentType: number, keepPosition?: boolean) {
        // TODO: update bounds
        if(keepPosition == null) {
            keepPosition = true
        }
        if(this._parent != parent) {
            // IF HAS A PARENT, REMOVE IT
            if(this._parent) {
                // #################################
                // REMOVE PARENT - START
                // #################################
                // REPOSITION
                if(!keepPosition) {
                    this._x -= this._parent.globalx
                    this._y -= this._parent.globaly
                }

                // ADAPT SPEED
                this._vx += this._parent.globalvx
                this._vy += this._parent.globalvy

                if(this._parentType == 0) {
                    // CALCULATE TOP ENTITY + ENTITY POSITION WITHIN THE TOP ENTITY
                    let topEntity = this._parent,
                        x = this._x,
                        y = this._y
                    while(topEntity._parent != null && topEntity._parentType == 0) {
                        x += topEntity._x
                        y += topEntity._y
                        topEntity = topEntity._parent
                    }

                    // IF HAS STATIC CHILD, NEEDS A VBH
                    if(this._childs && this.childs.filter(c => c._parentType == 0).length && !this._allBodies) {
                        this._allBodies = new SimpleVBH<Body>()
                        this._allBodies.bulkInsert(this.bodies)
                    }

                    // MOVE CHILDS
                    let childs = []
                    let child = this

                    let resetminx = false, resetmaxx = false, resetmaxy = false, resetminy = false
                    this._minx = Infinity
                    this._maxx = -Infinity
                    this._miny = Infinity
                    this._maxy = -Infinity

                    while(child) {
                        child._topEntity = this
                        // MODIFY BODY FIELDS
                        child.bodies.forEach(b => {
                            topEntity._allBodies.remove(b)
                            if(this._allBodies) {
                                this._allBodies.insert(b)
                            }
                            resetminx = resetminx || topEntity.minx == b.minx
                            resetmaxx = resetmaxx || topEntity.maxx == b.maxx
                            resetminy = resetminy || topEntity.miny == b.maxy
                            resetmaxy = resetmaxy || topEntity.maxy == b.maxy

                            b._x -= x
                            b._y -= y
                            this._minx = Math.min(this._minx, b.minx)
                            this._maxx = Math.max(this._maxx, b.maxx)
                            this._miny = Math.min(this._miny, b.miny)
                            this._maxy = Math.max(this._maxy, b.maxy)
                        })

                        // CHANGE OWNERSHIP OF CONTACTS
                        for(let lower in ["_upLower", "_downLower", "_leftLower", "_rightLower"]) {
                            let c = topEntity[lower]
                            if(c && (c.body1._entity == child || c.body2._entity == child)) {
                                this[lower] = c
                                topEntity[lower] = null
                            }
                        }

                        // CONTINUE TO THE NEXT
                        if(child._childs) {
                            childs.push.apply(childs, child.childs.filter(c => c._parentType == 0))
                        }
                        child = childs.pop()
                    }
                    if(resetminx) { topEntity._resetMinx() }
                    if(resetmaxx) { topEntity._resetMaxx() }
                    if(resetminy) { topEntity._resetMiny() }
                    if(resetmaxy) { topEntity._resetMaxy() }

                    this._world._addTopEntity(this)
                }

                this._parent._childs.splice(this._parent._childs.indexOf(this), 1)
                this._parent = null

                // #################################
                // REMOVE PARENT - END
                // #################################
            }

            if(parent) {
                // #################################
                // SET PARENT - START
                // #################################
                if(!keepPosition) {
                    this._x += parent.globalx
                    this._y += parent.globaly
                }

                this._vx -= parent.globalvx
                this._vy -= parent.globalvy

                if(parentType == 0) {
                    let topEntity = parent,
                        x = this._x,
                        y = this._y
                    while(topEntity._parent != null && topEntity._parentType == 0) {
                        x += topEntity._x
                        y += topEntity._y
                        topEntity = topEntity._parent
                    }

                    for(let b of this.bodies) {
                        b._x += x
                        b._y += y
                    }

                    // IF HAS STATIC CHILD, NEEDS A VBH
                    if(!topEntity._allBodies) {
                        topEntity._allBodies = new SimpleVBH<Body>()
                        topEntity._allBodies.bulkInsert(topEntity.bodies)
                    }

                    // MOVE CHILDS
                    for(let b of this._allBodies ? this._allBodies.all() : this.bodies) {
                        if(this._allBodies) {
                            this._allBodies.remove(b)
                        }
                        topEntity._allBodies.insert(b)
                        b._x += x
                        b._y += y
                        b._entity._topEntity = topEntity
                    }

                    // CHANGE OWNERSHIP OF CONTACTS
                    for(let lower in ["_upLower", "_downLower", "_leftLower", "_rightLower"]) {
                        if(!topEntity[lower]) {
                            let c = this[lower]
                            if(c) {
                                topEntity[lower] = c
                                this[lower] = null
                            }
                        }
                    }
                    this._world._removeTopEntity(this)
                }

                this._parent = parent
                if(!parent._childs) {
                    parent._childs = [this]
                } else {
                    parent._childs.push(this)
                }
                this._parentType = parentType

                // #################################
                // SET PARENT - END
                // #################################
            }
        } else if(parent && parentType != this._parentType) {
            if(parentType == 0) {
                let topEntity = parent,
                    x = this._x,
                    y = this._y

                while(topEntity._parent != null && topEntity._parentType == 0) {
                    x += topEntity._x
                    y += topEntity._y
                    topEntity = topEntity._parent
                }

                if(!topEntity._allBodies) {
                    topEntity._allBodies = new SimpleVBH<Body>()
                    topEntity._allBodies.bulkInsert(topEntity.bodies)
                }

                // MOVE CHILDS
                for(let b of this._allBodies ? this._allBodies.all() : this.bodies) {
                    if(this._allBodies) {
                        this._allBodies.remove(b)
                    }
                    topEntity._allBodies.insert(b)
                    b._x += x
                    b._y += y
                    b._entity._topEntity = topEntity
                }

                // CHANGE OWNERSHIP OF CONTACTS
                for(let lower in ["_upLower", "_downLower", "_leftLower", "_rightLower"]) {
                    if(!topEntity[lower]) {
                        let c = this[lower]
                        if(c) {
                            topEntity[lower] = c
                            this[lower] = null
                        }
                    }
                }

                this._world._removeTopEntity(this)
            } else {
                let topEntity = parent,
                    x = this._x,
                    y = this._y

                while(topEntity._parent != null && topEntity._parentType == 0) {
                    x += topEntity._x
                    y += topEntity._y
                    topEntity = topEntity._parent
                }

                // IF HAS STATIC CHILD, NEEDS A VBH
                if(this._childs && this.childs.filter(c => c._parentType == 0).length && !this._allBodies) {
                    this._allBodies = new SimpleVBH<Body>()
                    this._allBodies.bulkInsert(this.bodies)
                }

                // MOVE CHILDS
                let childs = []
                let child = this

                while(child) {
                    child.bodies.forEach(b => {
                        topEntity._allBodies.remove(b)
                        if(this._allBodies) {
                            this._allBodies.insert(b)
                        }
                        b._x -= x
                        b._y -= y
                        b._entity._topEntity = this
                    })

                    // CHANGE OWNERSHIP OF CONTACTS
                    for(let lower in ["_upLower", "_downLower", "_leftLower", "_rightLower"]) {
                        let c = topEntity[lower]
                        if(c && (c.body1._entity == child || c.body2._entity == child)) {
                            this[lower] = c
                            topEntity[lower] = null
                        }
                    }

                    if(child._childs) {
                        childs.push.apply(childs, child.childs.filter(c => c._parentType == 0))
                    }
                    child = childs.pop()
                }

                this._world._addTopEntity(this)
            }
            this._parentType = parentType
        }
    }

    createChild(args: EntityArgs, parentType?: string): Entity {
        let ent = new Entity(this._world, args)
        this._world._addEntity(ent)
        ent._setParent(this, parentType && parentType == "follow" ? 1 : 0, false)
        return ent
    }
    destroyChild(ent: Entity) {
        this._world.destroyEntity(ent)
    }
    destroy() {
        this._world.destroyEntity(this)
    }

    move(dx: number, dy: number) {
        this._world._move(this, dx, dy)
    }
    moveToGlobal(x: number, y: number) {
        this.move(x - this._x, y - this._y)
    }
    moveToLocal(x: number, y: number) {
        this.move(x - this.x, y - this.y)
    }

    localToGlobal(x: number | { x: number, y: number }, y?: number): { x: number, y: number } {
        if(typeof x !== "number") {
            y = x.y
            x = x.x
        }

        return {
            x: x + this._x,
            y: y + this._y
        }
    }
    globalToLocal(x: number | { x: number, y: number }, y?: number): { x: number, y: number } {
        if(typeof x !== "number") {
            y = x.y
            x = x.x
        }
        
        return {
            x: x - this._x,
            y: y - this._y
        }
    }

    _resetMinx() {
        this._minx = Infinity
        this._forAllBodies(b => {
            this._minx = Math.min(this._minx, b.minx)
        })
    }
    _resetMiny() {
        this._miny = Infinity
        this._forAllBodies(b => {
            this._miny = Math.min(this._miny, b.miny)
        })
    }
    _resetMaxx() {
        this._maxx = -Infinity
        this._forAllBodies(b => {
            this._maxx = Math.max(this._maxx, b.maxx)
        })
    }
    _resetMaxy() {
        this._maxy = -Infinity
        this._forAllBodies(b => {
            this._maxy = Math.max(this._maxy, b.maxy)
        })
    }
}