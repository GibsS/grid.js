import { Script } from '../script'
import { Entity } from '../../lib'

export function input(script: Script, entity: any, leftKey?: string, rightKey?: string, upKey?: string, downKey?: string) {
    script.keyDown(leftKey || 'q', () => { entity.moveLeft = true; entity.moveRight = false })
    script.keyUp(leftKey || 'q', () => { entity.moveLeft = false })
        
    script.keyDown(rightKey || 'd', () => { entity.moveRight = true; entity.moveLeft = false })
    script.keyUp(rightKey || 'd', () => { entity.moveRight = false })
        
    script.keyDown(upKey || 'z', () => { entity.jump = true })
    script.keyUp(upKey || 'z', () => { entity.jump = false })
}
export function update(entity, time: number, delta: number, speed: number) {
    if (entity.hasDownContact) {
        if(entity.jump) {
            entity.vy = 8
        }
        entity.setParent(entity.downContact.otherBody._topEntity, "follow")

        if(entity.moveLeft && !entity.moveRight) {
            entity.vx = -speed
        } else if(entity.moveRight && !entity.moveLeft) {
            entity.vx = speed
        } else {
            entity.vx = 0
        }
    } else {
        entity.setParent(null)
        if(entity.moveLeft && !entity.moveRight) {
            entity.vx = Math.max(-speed * 1.5, entity.vx - speed * delta * 2)
        } else if(entity.moveRight && !entity.moveLeft) {
            entity.vx = Math.min(speed * 1.5, entity.vx + speed * delta * 2)
        }
    }

    entity.vy -= 10 * delta
}