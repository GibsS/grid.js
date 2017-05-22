import * as _ from 'lodash'
import * as mousetrap from 'mousetrap'
import * as wheel from 'mouse-wheel'

import { Script, ScriptDescriptor } from './script'

import { World, Entity, Body, BodyType, Rect, Line, Grid, Contact } from '../lib'

export class Testbed {

    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D

    scripts: Map<string, ScriptDescriptor>

    scriptDescriptor: ScriptDescriptor
    script: Script
    world: World

    lastUpdate: number

    xCam: number
    yCam: number
    zoom: number

    entities: Entity[]

    _play: boolean
    _request: number

    _step: number
    _frameStep: number
    _lastUpdateTime: number

    _displayTotal: number
    _logicTotal: number
    _physicsTotal: number

    // STATS
    _avgDisplayTime: number
    _avgLogicTime: number
    _avgPhysicTime: number
    _fps: number

    // OPTIONS
    _showEntityRadio
    _showBodyRadio
    _showContactRadio

    showEntity: boolean
    showBody: boolean
    showContact: boolean

    constructor() {
        this.canvas = document.getElementById("canvas") as HTMLCanvasElement
        this.ctx = this.canvas.getContext('2d')

        let dpr = window.devicePixelRatio || 1,
            bsr = (this.ctx as any).webkitBackingStorePixelRatio ||
                  (this.ctx as any).mozBackingStorePixelRatio ||
                  (this.ctx as any).msBackingStorePixelRatio ||
                  (this.ctx as any).oBackingStorePixelRatio ||
                  (this.ctx as any).backingStorePixelRatio || 1,
            ratio = dpr/bsr
        
        this.canvas.width = this.canvas.offsetWidth
        this.canvas.height = this.canvas.offsetHeight

        this.scripts = new Map<string, ScriptDescriptor>()

        window.onresize = (e) => {
            this.canvas.width = this.canvas.offsetWidth
            this.canvas.height = this.canvas.offsetHeight
        }

        // KEY INPUT
        this.resetKeys()

        // BUTTONS 
        let playBtn = document.getElementById("play-btn"),
            stepBtn = document.getElementById("step-btn"),
            resetBtn = document.getElementById("reset-btn")

        playBtn.onclick = () => { 
            if(this._play) {
                this.pause()
                playBtn.innerText = "Play"
            } else {
                this.resume()
                playBtn.innerText = "Pause"
            }
        }
        stepBtn.onclick = () => {
            if(!this._play && this.script) {
                this.step(0.016, true)
            }
        }
        resetBtn.onclick = () => {
            if(this.scriptDescriptor != null) {
                this.start(this.scriptDescriptor.id)
            }
        }

        this._showEntityRadio = document.getElementById("show-entity-info-radio")
        this._showBodyRadio = document.getElementById("show-body-info-radio")
        this._showContactRadio = document.getElementById("show-contacts-radio")

        this.showEntity = this._showEntityRadio.checked || false
        this.showBody = this._showBodyRadio.checked || false
        this.showContact = this._showContactRadio.checked || false

        this._showEntityRadio.onclick = () => {
            this.showEntity = !this.showEntity
            this._showEntityRadio.checked = this.showEntity
        }
        this._showBodyRadio.onclick = () => {
            this.showBody = !this.showBody
            this._showBodyRadio.checked = this.showBody
        }
        this._showContactRadio.onclick = () => {
            this.showContact = !this.showContact
            this._showContactRadio.checked = this.showContact
        }

        wheel(this.canvas, (dx, dy) => {
            if(dy > 0) {
                this.zoom = Math.max(0, this.zoom - 2)
            } else {
                this.zoom += 2
            }
        }, true)

        this.canvas.onclick = (e) => {
            if(this.zoom != 0 && this.world && this.script) {
                let x = (e.clientX - this.canvas.width/2) / this.zoom + this.xCam
                let y = -(e.clientY - this.canvas.height/2) / this.zoom + this.yCam
                let query = this.world.queryPoint(x, y)

                if(query) {
                    if(query.bodies.length > 0) {
                        this.script.click(x, y, query.bodies[0])
                    } else {
                        this.script.click(x, y, null)
                    }
                } else {
                    this.script.click(x, y, null)
                }
            }
        }
    }

    bindKeys(key: string, callback: () => void) {
        mousetrap.bind(key, callback)
    }
    bindKeysUp(key: string, callback: () => void) {
        mousetrap.bind(key, callback, 'keyup')
    }
    resetKeys() {
        mousetrap.reset();
        mousetrap.bind('j', () => {
            this.xCam -= 5 / this.zoom
        })
        mousetrap.bind('l', () => {
            this.xCam += 5 / this.zoom
        })
        mousetrap.bind('k', () => {
            this.yCam -= 5 / this.zoom
        })
        mousetrap.bind('i', () => {
            this.yCam += 5 / this.zoom
        })
        mousetrap.bind('u', () => {
            this.zoom += 2
        })
        mousetrap.bind('o', () => {
            this.zoom = Math.max(0, this.zoom - 2)
        })
    }

    addScript(script: ScriptDescriptor) {
        this.scripts.set(script.id, script)
        let a = document.createElement('button')
        a.style.width = "100%"
        a.innerText = script.name
        a.onclick = () => { this.start(script.id) }
        document.getElementById('scripts').appendChild(a)
        document.getElementById('scripts').appendChild(document.createElement('br'))
    }
    start(script: string) {
        if(script != null) {
            this.stop()
        }
        this.resetKeys()
        document.getElementById("play-btn").innerText = "Pause"
        
        this.scriptDescriptor = this.scripts.get(script)
        this.script = this.scriptDescriptor.script()
        this.world = new World()
        this.script._world = this.world
        this.script._testbed = this
        this.lastUpdate = new Date().getTime()

        this._play = true

        this.xCam = 0
        this.yCam = 0
        this.zoom = 40

        this._step = 0
        this._frameStep = 0
        this._lastUpdateTime = 0

        this._displayTotal = 0
        this._logicTotal = 0
        this._physicsTotal = 0

        // STATS
        this._avgDisplayTime = 0
        this._avgLogicTime = 0
        this._avgPhysicTime = 0
        this._fps = 0

        this.script.init()
        this._update()
    }
    resume() {
        this._play = true
        this.lastUpdate = new Date().getTime()
        this._update()
    }
    pause() {
        this._play = false
        if(this._request != null) {
            cancelAnimationFrame(this._request)
        }
    }
    stop() {
        this.script = null
        this._play = false
        this.world = null
        this.entities = []
        if(this._request != null) {
            cancelAnimationFrame(this._request)
        }
    }
    _update() {
        if(this.script != null && this._play) {
            this._request = requestAnimationFrame(() => {
                let time = new Date().getTime()

                this.step((time - this.lastUpdate) / 1000, false)

                this.lastUpdate = time

                this._update()
            })
        }
    }
    step(delta: number, updateTimes: boolean) {
        let t0 = performance.now()
        this.world.simulate(delta)
        let t1 = performance.now()
        this.script.update(this.world.time, delta)
        let t2 = performance.now()

        this._draw()

        let t3 = performance.now()

        this._physicsTotal += t1 - t0
        this._logicTotal += t2 - t1
        this._displayTotal += t3 - t2

        this._step += 1
        this._frameStep += 1

        if(updateTimes) {
            this._avgPhysicTime = t1 - t0
            this._avgDisplayTime = t3 - t2
            this._avgLogicTime = t2 - t1
        } else if(this.world.time - this._lastUpdateTime > 1) {
            this._avgPhysicTime = (this._physicsTotal/this._frameStep)
            this._avgDisplayTime = (this._displayTotal/this._frameStep)
            this._avgLogicTime = (this._logicTotal/this._frameStep)

            this._physicsTotal = 0
            this._displayTotal = 0
            this._logicTotal = 0
            
            this._fps = this._frameStep
            this._frameStep = 0
            this._lastUpdateTime = this.world.time
        }
    }
    _draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

        let bx = -this.xCam * this.zoom + this.canvas.width/2
        let by = this.yCam * this.zoom + this.canvas.height/2
        this.ctx.font="9px Arial";
        for(let e of this.entities) {
            if(this.showEntity) {
                let x = e.globalx, y = e.globaly
                this.ctx.beginPath()
                this.ctx.moveTo((x - 0.1) * this.zoom + bx,
                                -(y - 0.1) * this.zoom + by)
                this.ctx.lineTo((x + 0.1) * this.zoom + bx,
                                -(y + 0.1) * this.zoom + by)

                this.ctx.moveTo((x + 0.1) * this.zoom + bx,
                                -(y - 0.1) * this.zoom + by)
                this.ctx.lineTo((x - 0.1) * this.zoom + bx,
                                -(y + 0.1) * this.zoom + by)
                                
                this.ctx.fillText((e.name || "") + " [" + x.toFixed(2) + ", " + y.toFixed(2) + "]", (x + 0.2) * this.zoom + bx, -y * this.zoom + by)
                this.ctx.stroke()
            }

            if(this.showContact) {
                this.ctx.strokeStyle="#FF0000";
                for(let c of ["_upLower", "_downLower", "_rightLower", "_leftLower"]) {
                    let contact = e[c] as Contact

                    if(contact) {
                        this.ctx.beginPath()
                        this.ctx.moveTo(contact.body.globalx * this.zoom + bx, -contact.body.globaly * this.zoom + by)
                        this.ctx.lineTo(contact.otherBody.globalx * this.zoom + bx, -contact.otherBody.globaly * this.zoom + by)
                        this.ctx.stroke()
                    }
                }
                this.ctx.strokeStyle="#000000";
            }
            e._forBodies(b => {
                let x = b.globalx, y = b.globaly
                if(this.showBody) {
                    this.ctx.beginPath()
                    this.ctx.moveTo((x - 0.1) * this.zoom + bx,
                                    -(y - 0.1) * this.zoom + by)
                    this.ctx.lineTo((x + 0.1) * this.zoom + bx,
                                    -(y + 0.1) * this.zoom + by)

                    this.ctx.moveTo((x + 0.1) * this.zoom + bx,
                                    -(y - 0.1) * this.zoom + by)
                    this.ctx.lineTo((x - 0.1) * this.zoom + bx,
                                    -(y + 0.1) * this.zoom + by)
                                    
                    this.ctx.fillText("[" + x.toFixed(2) + ", " + y.toFixed(2) + "]", (x + 0.2) * this.zoom + bx, -y * this.zoom + by)
                    this.ctx.stroke()
                }
                switch(b.type) {
                    case BodyType.RECT: {
                        this.ctx.strokeRect(
                            (x - (b as Rect).width/2) * this.zoom + bx,
                            (-(b as Rect).height/2 - y) * this.zoom + by,
                            (b as Rect).width * this.zoom,
                            (b as Rect).height * this.zoom
                        )
                        break
                    }
                    case BodyType.LINE: {
                        if(b instanceof Line) {
                            if(b.isHorizontal) {
                                this.ctx.beginPath()
                                this.ctx.moveTo((x - b.size/2) * this.zoom + bx,
                                                -y * this.zoom + by)
                                this.ctx.lineTo((x + b.size/2) * this.zoom + bx,
                                                -y * this.zoom + by)
                                this.ctx.stroke()

                                if(b.side == "up") {
                                    this.ctx.beginPath()
                                    this.ctx.moveTo((x - b.size/2) * this.zoom + bx + 5,
                                                    -y * this.zoom + by + 5)
                                    this.ctx.lineTo((x + b.size/2) * this.zoom + bx - 5,
                                                    -y * this.zoom + by + 5)
                                    this.ctx.stroke()
                                } else if(b.side == "down") {
                                    this.ctx.beginPath()
                                    this.ctx.moveTo((x - b.size/2) * this.zoom + bx + 5,
                                                    -y * this.zoom + by - 5)
                                    this.ctx.lineTo((x + b.size/2) * this.zoom + bx - 5,
                                                    -y * this.zoom + by - 5)
                                    this.ctx.stroke()
                                }
                            } else {
                                this.ctx.beginPath()
                                this.ctx.moveTo(x * this.zoom + bx,
                                                (b.size/2 - y) * this.zoom + by)
                                this.ctx.lineTo(x * this.zoom + bx,
                                                (-b.size/2 - y ) * this.zoom + by)
                                this.ctx.stroke()

                                if(b.side == "left") {
                                    this.ctx.beginPath()
                                    this.ctx.moveTo(x * this.zoom + bx + 5,
                                                    (b.size/2 - y) * this.zoom + by - 5)
                                    this.ctx.lineTo(x * this.zoom + bx + 5,
                                                    (-b.size/2 - y ) * this.zoom + by + 5)
                                    this.ctx.stroke()
                                } else if(b.side == "right") {
                                    this.ctx.beginPath()
                                    this.ctx.moveTo(x * this.zoom + bx - 5,
                                                    (b.size/2 - y) * this.zoom + by - 5)
                                    this.ctx.lineTo(x * this.zoom + bx - 5,
                                                    (-b.size/2 - y ) * this.zoom + by + 5)
                                    this.ctx.stroke()
                                }
                            }
                        }
                        break
                    }
                }
            })
        }
        this.ctx.font="15px Arial"
        this.ctx.fillText("Physic (time/step): " + this._avgPhysicTime.toFixed(3), 10, this.canvas.offsetHeight - 10)
        this.ctx.fillText("Display (time/step): " + this._avgDisplayTime.toFixed(3), 10, this.canvas.offsetHeight - 25)
        this.ctx.fillText("Logic (time/step): " + this._avgLogicTime.toFixed(3), 10, this.canvas.offsetHeight - 40)
        this.ctx.fillText("FPS: " + this._fps, 10, this.canvas.offsetHeight - 55)
        this.ctx.fillText("Step: " + this._step, 10, this.canvas.offsetHeight - 70)
        this.ctx.fillText("World time: " + this.world.time.toFixed(1), 10, this.canvas.offsetHeight - 85)

        this.ctx.font="20px Arial"
        this.ctx.fillText(this.scriptDescriptor.name, 10, 30)
        this.ctx.font="15px Arial"
        let d = this.scriptDescriptor.description,
            begin = 0,
            row = 0
        if(d) {
            while(begin != -1) {
                let br = d.indexOf('\n', begin)
                if(br == -1) {
                    if(d.length - begin < 30) {
                        this.ctx.fillText(d.substring(begin), 10, 55 + row * 15)
                        begin = -1
                    } else {
                        this.ctx.fillText(d.substring(begin, begin + 30), 10, 55 + row * 15)
                        begin += 30
                    }
                } else {
                    if(br - begin < 30) {
                        this.ctx.fillText(d.substring(begin, br), 10, 55 + row * 15)
                        begin = br + 1
                    } else {
                        this.ctx.fillText(d.substring(begin, begin + 30), 10, 55 + row * 15)
                        begin += 30
                    }
                }
                row++
            }
        }
    }

    registerEntity(entity: Entity): Entity {
        if(this.entities.indexOf(entity) < 0) {
            this.entities.push(entity)
        }
        return entity
    }
}

import { GridScript1, GridScript2, GridScript3, GridScript4 } from './scripts/gridScripts'
import { SimulScript1 } from './scripts/simulScripts'

window.onload = () => {
    let testbed = new Testbed()

    testbed.addScript(GridScript1)
    testbed.addScript(GridScript2)
    testbed.addScript(GridScript3)
    testbed.addScript(GridScript4)

    testbed.addScript(SimulScript1)

    testbed.start(SimulScript1.id)
}