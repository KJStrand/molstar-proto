/**
 * Copyright (c) 2017 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import AtomSet from '../set'
import Atom from '../../atom'
import { OrderedSet, IntMap } from 'mol-data/int'
import { sortArray } from 'mol-data/util/sort'

export class Builder {
    private keys: number[] = [];
    private units = IntMap.Mutable<number[]>();
    private currentUnit: number[] = [];

    atomCount = 0;

    add(u: number, a: number) {
        const unit = this.units.get(u);
        if (!!unit) { unit[unit.length] = a; }
        else {
            this.units.set(u, [a]);
            this.keys[this.keys.length] = u;
        }
        this.atomCount++;
    }

    beginUnit() { this.currentUnit = this.currentUnit.length > 0 ? [] : this.currentUnit; }
    addToUnit(a: number) { this.currentUnit[this.currentUnit.length] = a; this.atomCount++; }
    commitUnit(u: number) {
        if (this.currentUnit.length === 0) return;
        this.keys[this.keys.length] = u;
        this.units.set(u, this.currentUnit);
    }

    getSet(): AtomSet {
        const generator = AtomSet.TemplateGenerator(this.parent);

        for (let i = 0, _i = this.keys.length; i < _i; i++) {
            const k = this.keys[i];
            const unit = this.units.get(k);
            const l = unit.length;
            if (!this.sorted && l > 1) sortArray(unit);
            generator.add(k, OrderedSet.ofSortedArray(unit));
        }

        return generator.getSet();
    }

    singleton(): Atom {
        const u = this.keys[0];
        return Atom.create(u, this.units.get(u)[0]);
    }

    constructor(private parent: AtomSet, private sorted: boolean) { }
}

export function LinearBuilder(parent: AtomSet) {
    return new Builder(parent, true);
}

export function UnsortedBuilder(parent: AtomSet) {
    return new Builder(parent, false);
}