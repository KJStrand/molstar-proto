/**
 * Copyright (c) 2017-2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import Iterator from 'mol-data/iterator'
import { Column, Table, Database, DatabaseCollection } from 'mol-data/db'
import { Tensor } from 'mol-math/linear-algebra'
import EncoderBase from '../encoder'
import { ArrayEncoder, ArrayEncoding } from '../../common/binary-cif';

// TODO: support for "coordinate fields", make "coordinate precision" a parameter of the encoder
// TODO: automatically detect "precision" of floating point arrays.
// TODO: automatically detect "best encoding" for integer arrays. This could be used for "fixed-point" as well.
// TODO: add "repeat encoding"? [[1, 2], [1, 2], [1, 2]] --- Repeat ---> [[1, 2], 3]
// TODO: Add "higher level fields"? (i.e. generalization of repeat)
// TODO: align "data blocks" to 8 byte offsets for fast typed array windows? (prolly needs some testing if this is actually the case too)

export interface Field<Key = any, Data = any> {
    name: string,
    type: Field.Type,
    value(key: Key, data: Data, index: number): string | number
    valueKind?: (key: Key, data: Data) => Column.ValueKind,
    defaultFormat?: Field.Format,
    shouldInclude?: (data: Data) => boolean
}

export namespace Field {
    export const enum Type { Str, Int, Float }

    export interface Format {
        digitCount?: number,
        encoder?: ArrayEncoder,
        typedArray?: ArrayEncoding.TypedArrayCtor
    }

    export type ParamsBase<K, D> = {
        valueKind?: (k: K, d: D) => Column.ValueKind,
        encoder?: ArrayEncoder,
        shouldInclude?: (data: D) => boolean
    }

    export function str<K, D = any>(name: string, value: (k: K, d: D, index: number) => string, params?: ParamsBase<K, D>): Field<K, D> {
        return { name, type: Type.Str, value, valueKind: params && params.valueKind, defaultFormat: params && params.encoder ? { encoder: params.encoder } : void 0, shouldInclude: params && params.shouldInclude };
    }

    export function int<K, D = any>(name: string, value: (k: K, d: D, index: number) => number, params?:  ParamsBase<K, D> & { typedArray?: ArrayEncoding.TypedArrayCtor }): Field<K, D> {
        return {
            name,
            type: Type.Int,
            value,
            valueKind: params && params.valueKind,
            defaultFormat: params ? { encoder: params.encoder, typedArray: params.typedArray } : void 0,
            shouldInclude: params && params.shouldInclude
        };
    }

    export function float<K, D = any>(name: string, value: (k: K, d: D, index: number) => number, params?: ParamsBase<K, D> & { typedArray?: ArrayEncoding.TypedArrayCtor, digitCount?: number }): Field<K, D> {
        return {
            name,
            type: Type.Float,
            value,
            valueKind: params && params.valueKind,
            defaultFormat: params ? { encoder: params.encoder, typedArray: params.typedArray, digitCount: typeof params.digitCount !== 'undefined' ? params.digitCount : void 0 } : void 0,
            shouldInclude: params && params.shouldInclude
        };
    }

    export function index(name: string) {
        return int(name, (e, d, i) => i + 1, { typedArray: Int32Array, encoder: ArrayEncoding.by(ArrayEncoding.delta).and(ArrayEncoding.runLength).and(ArrayEncoding.integerPacking) })
    }

    export class Builder<K = number, D = any> {
        private fields: Field<K, D>[] = [];

        index(name: string) {
            this.fields.push(Field.index(name));
            return this;
        }

        str(name: string, value: (k: K, d: D, index: number) => string, params?: ParamsBase<K, D>) {
            this.fields.push(Field.str(name, value, params));
            return this;
        }

        int(name: string, value: (k: K, d: D, index: number) => number, params?:  ParamsBase<K, D> & { typedArray?: ArrayEncoding.TypedArrayCtor }) {
            this.fields.push(Field.int(name, value, params));
            return this;
        }

        float(name: string, value: (k: K, d: D, index: number) => number, params?: ParamsBase<K, D> & { typedArray?: ArrayEncoding.TypedArrayCtor, digitCount?: number }) {
            this.fields.push(Field.float(name, value, params));
            return this;
        }

        many(fields: ArrayLike<Field<K, D>>) {
            for (let i = 0; i < fields.length; i++) this.fields.push(fields[i]);
            return this;
        }

        getFields() { return this.fields; }
    }

    export function build<K = number, D = any>() {
        return new Builder<K, D>();
    }
}

export interface Category<Ctx = any> {
    name: string,
    instance(ctx: Ctx): Category.Instance
}

export namespace Category {
    export const Empty: Instance = { fields: [], source: [] };

    export interface DataSource<Key = any, Data = any> {
        data?: Data,
        rowCount: number,
        keys?: () => Iterator<Key>
    }

    export interface Instance<Key = any, Data = any> {
        fields: Field[],
        source: DataSource<Key, Data>[]
    }

    export interface Filter {
        includeCategory(categoryName: string): boolean,
        includeField(categoryName: string, fieldName: string): boolean,
    }

    export const DefaultFilter: Filter = {
        includeCategory(cat) { return true; },
        includeField(cat, field) { return true; }
    }

    export interface Formatter {
        getFormat(categoryName: string, fieldName: string): Field.Format | undefined
    }

    export const DefaultFormatter: Formatter = {
        getFormat(cat, field) { return void 0; }
    }

    export function ofTable(table: Table<Table.Schema>, indices?: ArrayLike<number>): Category.Instance {
        if (indices) {
            return {
                fields: cifFieldsFromTableSchema(table._schema),
                source: [{ data: table, rowCount: indices.length, keys: () => Iterator.Array(indices) }]
            };
        }
        return {
            fields: cifFieldsFromTableSchema(table._schema),
            source: [{ data: table, rowCount: table._rowCount }]
        };
    }
}

export interface Encoder<T = string | Uint8Array> extends EncoderBase {
    setFilter(filter?: Category.Filter): void,
    setFormatter(formatter?: Category.Formatter): void,

    startDataBlock(header: string): void,
    writeCategory<Ctx>(category: Category<Ctx>, context?: Ctx): void,
    getData(): T
}

export namespace Encoder {
    export function writeDatabase(encoder: Encoder, name: string, database: Database<Database.Schema>) {
        encoder.startDataBlock(name);
        for (const table of database._tableNames) {
            encoder.writeCategory({ name: table, instance: () => Category.ofTable(database[table]) });
        }
    }

    export function writeDatabaseCollection(encoder: Encoder, collection: DatabaseCollection<Database.Schema>) {
        for (const name of Object.keys(collection)) {
            writeDatabase(encoder, name, collection[name])
        }
    }
}

function columnValue(k: string) {
    return (i: number, d: any) => d[k].value(i);
}

function columnListValue(k: string) {
    return (i: number, d: any) => d[k].value(i).join(d[k].schema.separator);
}

function columnTensorValue(k: string, ...coords: number[]) {
    return (i: number, d: any) => d[k].schema.space.get(d[k].value(i), ...coords);
}

function columnValueKind(k: string) {
    return (i: number, d: any) => d[k].valueKind(i);
}

function getTensorDefinitions(field: string, space: Tensor.Space) {
    const fieldDefinitions: Field[] = []
    const type = Field.Type.Float
    const valueKind = columnValueKind(field)
    if (space.rank === 1) {
        const rows = space.dimensions[0]
        for (let i = 0; i < rows; i++) {
            const name = `${field}[${i + 1}]`
            fieldDefinitions.push({ name, type, value: columnTensorValue(field, i), valueKind })
        }
    } else if (space.rank === 2) {
        const rows = space.dimensions[0], cols = space.dimensions[1]
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const name = `${field}[${i + 1}][${j + 1}]`
                fieldDefinitions.push({ name, type, value: columnTensorValue(field, i, j), valueKind })
            }
        }
    } else if (space.rank === 3) {
        const d0 = space.dimensions[0], d1 = space.dimensions[1], d2 = space.dimensions[2]
        for (let i = 0; i < d0; i++) {
            for (let j = 0; j < d1; j++) {
                for (let k = 0; k < d2; k++) {
                    const name = `${field}[${i + 1}][${j + 1}][${k + 1}]`
                    fieldDefinitions.push({ name, type, value: columnTensorValue(field, i, j, k), valueKind })
                }
            }
        }
    } else {
        throw new Error('Tensors with rank > 3 or rank 0 are currently not supported.')
    }
    return fieldDefinitions
}

function cifFieldsFromTableSchema(schema: Table.Schema) {
    const fields: Field[] = [];
    for (const k of Object.keys(schema)) {
        const t = schema[k];
        if (t.valueType === 'int') {
            fields.push({ name: k, type: Field.Type.Int, value: columnValue(k), valueKind: columnValueKind(k) });
        } else if (t.valueType === 'float') {
            fields.push({ name: k, type: Field.Type.Float, value: columnValue(k), valueKind: columnValueKind(k) });
        } else if (t.valueType === 'str') {
            fields.push({ name: k, type: Field.Type.Str, value: columnValue(k), valueKind: columnValueKind(k) });
        } else if (t.valueType === 'list') {
            fields.push({ name: k, type: Field.Type.Str, value: columnListValue(k), valueKind: columnValueKind(k) })
        } else if (t.valueType === 'tensor') {
            fields.push(...getTensorDefinitions(k, t.space))
        } else {
            throw new Error(`Unknown valueType ${t.valueType}`);
        }
    }
    return fields;
}