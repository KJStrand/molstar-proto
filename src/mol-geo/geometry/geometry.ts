/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Mesh } from './mesh/mesh';
import { Points } from './points/points';
import { RenderableState } from 'mol-gl/renderable';
import { ValueCell } from 'mol-util';
import { BaseValues } from 'mol-gl/renderable/schema';
import { LocationIterator } from '../util/location-iterator';
import { ColorType } from './color-data';
import { SizeType } from './size-data';
import { Lines } from './lines/lines';
import { ParamDefinition as PD } from 'mol-util/param-definition'
import { DirectVolume } from './direct-volume/direct-volume';
import { Color } from 'mol-util/color';
import { Vec3 } from 'mol-math/linear-algebra';
import { Spheres } from './spheres/spheres';

//

export const VisualQualityInfo = {
    'custom': {},
    'auto': {},
    'highest': {},
    'higher': {},
    'high': {},
    'medium': {},
    'low': {},
    'lower': {},
    'lowest': {},
}
export type VisualQuality = keyof typeof VisualQualityInfo
export const VisualQualityNames = Object.keys(VisualQualityInfo)
export const VisualQualityOptions = VisualQualityNames.map(n => [n, n] as [VisualQuality, string])

//

export type GeometryKindType = {
    'mesh': Mesh,
    'points': Points,
    'spheres': Spheres,
    'lines': Lines,
    'direct-volume': DirectVolume,
}
export type GeometryKind = keyof GeometryKindType
export type Geometry = Helpers.ValueOf<GeometryKindType>

export namespace Geometry {
    export function getDrawCount(geometry: Geometry) {
        switch (geometry.kind) {
            case 'mesh': return geometry.triangleCount * 3
            case 'points': return geometry.pointCount
            case 'spheres': return geometry.sphereCount * 2 * 3
            case 'lines': return geometry.lineCount * 2 * 3
            case 'direct-volume': return 12 * 3
        }
    }

    //

    export const Params = {
        alpha: PD.Numeric(1, { min: 0, max: 1, step: 0.01 }, { label: 'Opacity' }),
        useFog: PD.Boolean(true),
        highlightColor: PD.Color(Color.fromNormalizedRgb(1.0, 0.4, 0.6)),
        selectColor: PD.Color(Color.fromNormalizedRgb(0.2, 1.0, 0.1)),

        quality: PD.Select<VisualQuality>('auto', VisualQualityOptions),
    }
    export type Params = typeof Params

    export type Counts = { drawCount: number, groupCount: number, instanceCount: number }

    export function createValues(props: PD.Values<Params>, counts: Counts) {
        return {
            uAlpha: ValueCell.create(props.alpha),
            uHighlightColor: ValueCell.create(Color.toArrayNormalized(props.highlightColor, Vec3.zero(), 0)),
            uSelectColor: ValueCell.create(Color.toArrayNormalized(props.selectColor, Vec3.zero(), 0)),
            uGroupCount: ValueCell.create(counts.groupCount),
            drawCount: ValueCell.create(counts.drawCount),
            dUseFog: ValueCell.create(props.useFog),
        }
    }

    export function updateValues(values: BaseValues, props: PD.Values<Params>) {
        if (Color.fromNormalizedArray(values.uHighlightColor.ref.value, 0) !== props.highlightColor) {
            ValueCell.update(values.uHighlightColor, Color.toArrayNormalized(props.highlightColor, values.uHighlightColor.ref.value, 0))
        }
        if (Color.fromNormalizedArray(values.uSelectColor.ref.value, 0) !== props.selectColor) {
            ValueCell.update(values.uSelectColor, Color.toArrayNormalized(props.selectColor, values.uSelectColor.ref.value, 0))
        }
        ValueCell.updateIfChanged(values.uAlpha, props.alpha)
        ValueCell.updateIfChanged(values.dUseFog, props.useFog)
    }

    export function createRenderableState(props: Partial<PD.Values<Params>> = {}): RenderableState {
        return {
            visible: true,
            pickable: true,
            opaque: props.alpha === undefined ? true : props.alpha === 1
        }
    }

    export function updateRenderableState(state: RenderableState, props: PD.Values<Params>) {
        state.opaque = props.alpha === 1
    }
}

//

export function getGranularity(locationIt: LocationIterator, granularity: ColorType | SizeType) {
    // Always use 'group' granularity for 'complex' location iterators,
    // i.e. for which an instance may include multiple units
    return granularity === 'instance' && locationIt.isComplex ? 'group' : granularity
}