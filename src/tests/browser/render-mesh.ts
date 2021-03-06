/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import './index.html'
import { Canvas3D } from 'mol-canvas3d/canvas3d';
import { MeshBuilder } from 'mol-geo/geometry/mesh/mesh-builder';
import { Sphere } from 'mol-geo/primitive/sphere';
import { Mat4 } from 'mol-math/linear-algebra';
import { Mesh } from 'mol-geo/geometry/mesh/mesh';
import { Geometry } from 'mol-geo/geometry/geometry';
import { createMeshRenderObject } from 'mol-gl/render-object';
import { Representation } from 'mol-repr/representation';
import { Color } from 'mol-util/color';

const parent = document.getElementById('app')!
parent.style.width = '100%'
parent.style.height = '100%'

const canvas = document.createElement('canvas')
canvas.style.width = '100%'
canvas.style.height = '100%'
parent.appendChild(canvas)

const canvas3d = Canvas3D.create(canvas, parent)
canvas3d.animate()

const builderState = MeshBuilder.createState()
const t = Mat4.identity()
const sphere = Sphere(2)
MeshBuilder.addPrimitive(builderState, t, sphere)
const mesh = MeshBuilder.getMesh(builderState)

const values = Mesh.createValuesSimple(mesh, {}, Color(0xFF0000))
const state = Geometry.createRenderableState()
const renderObject = createMeshRenderObject(values, state)
const repr = Representation.fromRenderObject('sphere-mesh', renderObject)

canvas3d.add(repr)
canvas3d.resetCamera()