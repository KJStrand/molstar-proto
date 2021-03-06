/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Box3D } from '../../geometry';
import { Vec3, Mat4, Tensor } from '../../linear-algebra';
import { RuntimeContext } from 'mol-task';
import { PositionData, DensityData } from '../common';
import { OrderedSet } from 'mol-data/int';
import { GaussianDensityProps, getDelta } from '../gaussian-density';

export async function GaussianDensityCPU(ctx: RuntimeContext, position: PositionData, box: Box3D, radius: (index: number) => number,  props: GaussianDensityProps): Promise<DensityData> {
    const { resolution, radiusOffset, smoothness } = props

    const { indices, x, y, z } = position
    const n = OrderedSet.size(indices)

    const v = Vec3.zero()
    const p = Vec3.zero()

    let maxRadius = 0
    for (let i = 0; i < n; ++i) {
        const r = radius(OrderedSet.getAt(indices, i)) + radiusOffset
        if (maxRadius < r) maxRadius = r

        if (i % 10000 === 0 && ctx.shouldUpdate) {
            await ctx.update({ message: 'calculating max radius', current: i, max: n })
        }
    }

    const pad = maxRadius * 2 + resolution
    const expandedBox = Box3D.expand(Box3D.empty(), box, Vec3.create(pad, pad, pad))
    const extent = Vec3.sub(Vec3.zero(), expandedBox.max, expandedBox.min)
    const min = expandedBox.min

    const delta = getDelta(Box3D.expand(Box3D.empty(), box, Vec3.create(pad, pad, pad)), resolution)
    const dim = Vec3.zero()
    Vec3.ceil(dim, Vec3.mul(dim, extent, delta))
    // console.log('grid dim cpu', dim)

    const space = Tensor.Space(dim, [0, 1, 2], Float32Array)
    const data = space.create()
    const field = Tensor.create(space, data)

    const idData = space.create()
    const idField = Tensor.create(space, idData)

    const densData = space.create()

    const c = Vec3.zero()

    const alpha = smoothness

    const _r2 = maxRadius * 2
    const _radius2 = Vec3.create(_r2, _r2, _r2)
    Vec3.mul(_radius2, _radius2, delta)
    const updateChunk = Math.ceil(10000 / (_radius2[0] * _radius2[1] * _radius2[2]))

    const beg = Vec3.zero()
    const end = Vec3.zero()

    const gridPad = 1 / Math.max(...delta)

    // console.time('gaussian density cpu')
    for (let i = 0; i < n; ++i) {
        const j = OrderedSet.getAt(indices, i)

        Vec3.set(v, x[j], y[j], z[j])

        Vec3.sub(v, v, min)
        Vec3.mul(c, v, delta)

        const rad = radius(j) + radiusOffset
        const rSq = rad * rad

        const r2 = radiusOffset + rad * 2 + gridPad
        const rad2 = Vec3.create(r2, r2, r2)
        Vec3.mul(rad2, rad2, delta)
        const r2sq = r2 * r2

        const [ begX, begY, begZ ] = Vec3.floor(beg, Vec3.sub(beg, c, rad2))
        const [ endX, endY, endZ ] = Vec3.ceil(end, Vec3.add(end, c, rad2))

        for (let xi = begX; xi < endX; ++xi) {
            for (let yi = begY; yi < endY; ++yi) {
                for (let zi = begZ; zi < endZ; ++zi) {
                    Vec3.set(p, xi, yi, zi)
                    Vec3.div(p, p, delta)
                    const distSq = Vec3.squaredDistance(p, v)
                    if (distSq <= r2sq) {
                        const dens = Math.exp(-alpha * (distSq / rSq))
                        space.add(data, xi, yi, zi, dens)
                        if (dens > space.get(densData, xi, yi, zi)) {
                            space.set(densData, xi, yi, zi, dens)
                            space.set(idData, xi, yi, zi, i)
                        }
                    }
                }
            }
        }

        if (i % updateChunk === 0 && ctx.shouldUpdate) {
            await ctx.update({ message: 'filling density grid', current: i, max: n })
        }
    }
    // console.timeEnd('gaussian density cpu')

    const transform = Mat4.identity()
    Mat4.fromScaling(transform, Vec3.inverse(Vec3.zero(), delta))
    Mat4.setTranslation(transform, expandedBox.min)

    return { field, idField, transform }
}