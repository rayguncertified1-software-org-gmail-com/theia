/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, postConstruct } from 'inversify';
import { TreeDecorator, TreeDecoration } from '@theia/core/lib/browser/tree/tree-decorator';
import { Emitter } from '@theia/core/lib/common/event';
import { Tree } from '@theia/core/lib/browser/tree/tree';


@injectable()
export class OpenEditorsFileDecorator implements TreeDecorator {
    readonly id = 'theia-open-editors-file-decorator';
    // THIS SHOULD FIRE ONLY WHEN SAVEABLE STATE CHANGES
    protected decorationsMap = new Map<string, TreeDecoration.Data>();

    protected readonly decorationsChangedEmitter = new Emitter();
    readonly onDidChangeDecorations = this.decorationsChangedEmitter.event;
    @postConstruct()
    init(): void {

    }

    protected fireDidChangeDecorations(event: (tree: Tree) => Map<string, TreeDecoration.Data>): void {
        this.decorationsChangedEmitter.fire(event);
    }

    decorations(tree: Tree): Map<string, TreeDecoration.Data> {
        return this.decorationsMap;
    }

}
