/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { ValueCell } from 'mol-util';
import { ArrayKind, BufferItemSize, ElementsKind } from '../webgl/buffer';
import { UniformKind } from '../webgl/uniform';
import { DefineKind } from '../shader-code';
import { Vec2, Vec3, Vec4, Mat3, Mat4 } from 'mol-math/linear-algebra';
import { TextureImage } from './util';

export type ValueKindType = {
    'number': number
    'string': string
    'any': any
}
export type ValueKind = keyof ValueKindType

//

export type KindValue = {
    'f': number
    'i': number
    'v2': Vec2
    'v3': Vec3
    'v4': Vec4
    'm3': Mat3
    'm4': Mat4
    't2': number

    'uint8': Uint8Array
    'int8': Int8Array
    'uint16': Uint16Array
    'int16': Int16Array
    'uint32': Uint32Array
    'int32': Int32Array
    'float32': Float32Array

    'image': TextureImage

    'number': number
    'string': string
    'boolean': boolean
    'any': any
}

export type Values<S extends RenderableSchema> = { [k in keyof S]: ValueCell<KindValue[S[k]['kind']]> }

//

export type AttributeSpec<K extends ArrayKind> = { type: 'attribute', kind: K, itemSize: BufferItemSize, divisor: number }
export function AttributeSpec<K extends ArrayKind>(kind: K, itemSize: BufferItemSize, divisor: number): AttributeSpec<K> {
    return { type: 'attribute', kind, itemSize, divisor }
}

export type UniformSpec<K extends UniformKind> = { type: 'uniform', kind: K }
export function UniformSpec<K extends UniformKind>(kind: K): UniformSpec<K> {
    return { type: 'uniform', kind }
}

export type TextureSpec = { type: 'texture', kind: 'image' }
export function TextureSpec(): TextureSpec {
    return { type: 'texture', kind: 'image' }
}

export type ElementsSpec<K extends ElementsKind> = { type: 'elements', kind: K }
export function ElementsSpec<K extends ElementsKind>(kind: K): ElementsSpec<K> {
    return { type: 'elements', kind }
}

export type DefineSpec<K extends DefineKind> = { type: 'define', kind: K, options?: string[] }
export function DefineSpec<K extends DefineKind>(kind: K, options?: string[]): DefineSpec<K> {
    return { type: 'define', kind, options }
}

export type ValueSpec<K extends ValueKind> = { type: 'value', kind: K }
export function ValueSpec<K extends ValueKind>(kind: K): ValueSpec<K> {
    return { type: 'value', kind }
}

//

export type RenderableSchema = {
    [k: string]: (
        AttributeSpec<ArrayKind> | UniformSpec<UniformKind> | TextureSpec |
        ValueSpec<ValueKind> | DefineSpec<DefineKind> | ElementsSpec<ElementsKind>
    )
}
export type RenderableValues = { [k: string]: ValueCell<any> }

//

export const GlobalUniformSchema = {
    uModel: UniformSpec('m4'),
    uView: UniformSpec('m4'),
    uProjection: UniformSpec('m4'),
    // uLightPosition: Uniform('v3'),
    uLightColor: UniformSpec('v3'),
    uLightAmbient: UniformSpec('v3'),

    uPixelRatio: UniformSpec('f'),
    uViewportHeight: UniformSpec('f'),
}
export type GlobalUniformSchema = typeof GlobalUniformSchema
export type GlobalUniformValues = { [k in keyof GlobalUniformSchema]: ValueCell<any> }

export const BaseSchema = {
    aInstanceId: AttributeSpec('float32', 1, 1),
    aPosition: AttributeSpec('float32', 3, 0),
    aElementId: AttributeSpec('float32', 1, 0),
    aTransform: AttributeSpec('float32', 16, 1),
    aColor: AttributeSpec('float32', 3, 0),

    uAlpha: UniformSpec('f'),
    uObjectId: UniformSpec('i'),
    uInstanceCount: UniformSpec('i'),
    uElementCount: UniformSpec('i'),
    uColorTexSize: UniformSpec('v2'),
    uColor: UniformSpec('v3'),

    tColor: TextureSpec(),

    drawCount: ValueSpec('number'),
    instanceCount: ValueSpec('number'),

    dColorType: DefineSpec('string', ['uniform', 'attribute', 'instance', 'element', 'element_instance']),
}
export type BaseSchema = typeof BaseSchema
export type BaseValues = Values<BaseSchema>