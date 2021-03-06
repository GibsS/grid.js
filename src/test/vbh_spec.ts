import * as assert from 'assert'
import * as _ from 'lodash'

import { nearEqual } from './helper'

import { VBH, MoveVBH, EnabledAABB, MoveAABB, SimpleVBH, SimpleMoveVBH } from '../lib/vbh/vbh'
import { BinaryTree, MoveBinaryTree } from '../lib/vbh/binaryTree'

function hasPair(list: any[], e1, e2) {
    assert(_.some(list, e => (e[0] == e1 && e[1] == e2) || (e[0] == e2 && e[1] == e1)))
}

function testVBH(VBHType: () => VBH<EnabledAABB>, otherVBHs: (() => VBH<EnabledAABB>)[]) {
    var vbh: VBH<EnabledAABB>,
        aabb1: EnabledAABB = { minX: 0, minY: 1, maxX: 2, maxY: 3, enabled: true },
        aabb2: EnabledAABB = { minX: 2, minY: -1, maxX: 3, maxY: 0, enabled: true },
        aabb3: EnabledAABB = { minX: 3.1, minY: -1, maxX: 4.1, maxY: 0, enabled: true },
        aabb4: EnabledAABB = { minX: -1, minY: 1, maxX: -0.1, maxY: 2, enabled: true }

    beforeEach(function() {
        vbh = VBHType()
    })

    describe("VBH.all", function() {
        it('should return a list of all the elements added to the vbh /1', function() {
            vbh.insert(aabb1)
            vbh.insert(aabb2)
            vbh.insert(aabb3)
            vbh.insert(aabb4)

            assert(_.isEqual(vbh.all().sort(), [aabb1, aabb2, aabb3, aabb4].sort()))
        })
        it('should return a list of all the elements added to the vbh /2', function() {
            vbh.bulkInsert([aabb1, aabb2, aabb3, aabb4])

            assert(_.isEqual(vbh.all().sort(), [aabb1, aabb2, aabb3, aabb4].sort()))
        })
    })

    describe("VBH.insert", function() {
        it('should add the given element to the vbh', function() {
            vbh.insert(aabb1)

            assert(vbh.all().indexOf(aabb1) >= 0)
        })
    })
    describe("VBH.remove", function() {
        it('should remove the given element of the vbh', function() {
            vbh.insert(aabb1)
            vbh.insert(aabb2)

            vbh.remove(aabb1)

            assert(vbh.all().indexOf(aabb1) < 0)
        })
    })

    describe("VBH.queryRect", function() {

        beforeEach(function() {
            vbh.bulkInsert([aabb1, aabb2, aabb3, aabb4])
        })

        it('should return null if nothing overlaps with the rectangle', function() {
            let res = vbh.queryRect(-10, 0, 4, 4)

            assert.deepEqual(res, [])
        })
        it('should return all the elements overlaps with the rectangle /1', function() {
            let res = vbh.queryRect(2, 0, 3, 3)

            assert(_.isEqual(res.sort(), [aabb1, aabb2, aabb3].sort()))
        })
        it('should return all the elements overlaps with the rectangle /2', function() {
            let res = vbh.queryRect(3, 0, 0, 0)

            assert(res.length == 1 && res[0] == aabb2)
        })
    })

    for(let other of otherVBHs) {
        vbh = VBHType()
        let otherVBH = other()
        describe.skip("VBH collisions between " + vbh.constructor.name + " and " + otherVBH.constructor.name, function() {
            let aabb5: EnabledAABB = { minX: 3, maxX: 4, minY: 4, maxY: 5, enabled: true },
                aabb6: EnabledAABB = { minX: 5, maxX: 6, minY: -1, maxY: 0, enabled: true }

            beforeEach(function() {
                otherVBH = other()
                otherVBH.bulkInsert([aabb5, aabb6])

                vbh = VBHType()
                vbh.bulkInsert([aabb1, aabb2, aabb3, aabb4])
            })

            describe("VBH.collideVBH", function() {
                it('should return the list of pairs of colliding elements /1', function() {
                    vbh.remove(aabb1)
                    vbh.remove(aabb2)
                    vbh.remove(aabb4)

                    otherVBH.remove(aabb5)

                    let res = vbh.collideVBH(otherVBH, 0, 0, 0.5, 0, 0, 0.2, -1, -0.5)

                    hasPair(res, aabb3, aabb6)
                })
                it('should return the list of pairs of colliding elements /2', function() {
                    let res = vbh.collideVBH(otherVBH, 0, 0, 0.5, 0, 0, 0.2, -1, -0.5)

                    hasPair(res, aabb3, aabb6)
                })
                it('should return the list of pairs of colliding elements /3', function() {
                    let res = vbh.collideVBH(otherVBH, 0, 3, 0, 0, 0, 0, 0, -6)

                    hasPair(res, aabb3, aabb5)
                })
                it('should return nothing if nothing collides', function() {
                    let res = vbh.collideVBH(otherVBH, 0, -2, 0, 0, 0, 1, 1, 0)

                    assert(res.length == 0)
                })
            })
        })
    }

    describe.skip("VBH.collideAAABB", function() {

        beforeEach(function() {
            vbh.bulkInsert([aabb1, aabb2, aabb3, aabb4])
        })

        let aabb6: EnabledAABB = { minX: 6, maxX: 7, minY: -1, maxY: 0, enabled: true }

        it('should return the list of pairs of colliding elements /1', function() {
            let res = vbh.collideAABB(aabb6, 0, 0, 0, 0, 0, 0, -4, 0)

            assert(res.length == 2)
        })
        it('should return the list of pairs of colliding elements /2', function() {
            let res = vbh.collideAABB(aabb6, 0.5, 0, 0, 0, 0, 0.3, -6, -0.3)

            assert(res.length == 2)
        })
        it('should return nothing if nothing collides', function() {
            let res = vbh.collideAABB(aabb6, 0, -2, 0, 0, 0, 1, 1, 0)

            assert(res.length == 0)
        })
    })
}

function testMoveVBH(vbhType: () => MoveVBH<MoveAABB>) {

    // var vbh: MoveVBH<IMoveAABB>,
    // aabb1: IMoveAABB = { minX: 0, minY: 1, maxX: 2, maxY: 3, enabled: true, vx: 0, vy: 0 },
    // aabb2: IMoveAABB = { minX: 3, minY: -1, maxX: 4, maxY: 0, enabled: true, vx: 0, vy: 0 },
    // aabb3: IMoveAABB = { minX: 4.1, minY: -1, maxX: 5.1, maxY: 0, enabled: true, vx: 0, vy: 0 },
    // aabb4: IMoveAABB = { minX: -1, minY: 1, maxX: -0.1, maxY: 2, enabled: true, vx: 0, vy: 0 }

    // beforeEach(function() {
    //     vbh = vbhType()
    //     vbh.bulkInsert([aabb1, aabb2, aabb3, aabb4])
    // })

    // describe("MoveVBH.update", function() {
    //     it('should return every new collision /1', function() {
    //         let res = vbh.update(4)
    //     })
    //     it('should return every new collision /2', function() {
    //         aabb4.vx = 1
    //         aabb4.vy = 1
    //         aabb1.vx = -10

    //         aabb2.vx = 4
    //         let res = vbh.update(1)

    //         hasPair(res, aabb4, aabb1)
    //         hasPair(res, aabb2, aabb3)
    //     })
    //     it('should return every new collision /3', function() {
    //         aabb2.vx = -1
    //         aabb2.vy = 2
            
    //         let res = vbh.update(1)

    //         hasPair(res, aabb1, aabb2)
    //     })
    // })

    // describe("MoveVBH.updateSingle", function() {
    //     it('should return every new collision /1', function() {
    //         let res = vbh.updateSingle(aabb1, -1, 1)

    //         hasPair(res, aabb1, aabb4)
    //     })
    //     it('should return every new collision /2', function() {
    //         let res = vbh.updateSingle(aabb3, -10, 1)

    //         hasPair(res, aabb3, aabb1)
    //         hasPair(res, aabb3, aabb2)
    //         hasPair(res, aabb3, aabb4)
    //     })
    //     it('should return every new collision /3', function() {
    //         let res = vbh.updateSingle(aabb4, 1, 0)

    //         hasPair(res, aabb1, aabb4)
    //     })
    // })
}

export default function test() {
    testVBH(() => new SimpleVBH<EnabledAABB>(), [() => new SimpleVBH<EnabledAABB>(), () => new BinaryTree<EnabledAABB>()])
    testMoveVBH(() => new SimpleMoveVBH<MoveAABB>())
    testVBH(() => new BinaryTree<EnabledAABB>(), [() => new SimpleVBH<EnabledAABB>(), () => new BinaryTree<EnabledAABB>()])
    testMoveVBH(() => new MoveBinaryTree<MoveAABB>())
}