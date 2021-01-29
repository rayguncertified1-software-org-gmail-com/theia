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

import { injectable, inject, postConstruct } from 'inversify';
import { EditorManager } from '@theia/editor/lib/browser';
import { ApplicationShell, CompositeTreeNode, TreeModelImpl } from '@theia/core/lib/browser';

@injectable()
export class OpenEditorsModel extends TreeModelImpl {
    @inject(ApplicationShell) protected readonly applicationShell: ApplicationShell;
    @inject(EditorManager) protected readonly editorManager: EditorManager;

    counter = 0;

    @postConstruct()
    protected init(): void {
        super.init();
        this.toDispose.push(this.applicationShell.onDidAddWidget(widget => {
            console.log('SENTINEL ROOT NAME BEFORE ADD CHILD', this.root?.name);
            const treeNode: CompositeTreeNode = {
                id: `${this.counter++}`,
                parent: undefined,
                // label: `LABEL ${this.counter}`,
                name: `NAME ${this.counter}`,
                children: []
            };
            if (this.root) {
                CompositeTreeNode.addChild(this.root as CompositeTreeNode, treeNode);
            }
            console.log('SENTINEL ROOT', this.root);
            this.fireChanged();
        }));
        this.toDispose.push(this.applicationShell.onDidRemoveWidget(widget => {
        }));
        const treeNode: CompositeTreeNode = {
            id: 'node 1',
            parent: undefined,
            name: 'Super special name',
            children: []
        }
        this.root = treeNode;
        console.log('SENTINEL ROOT IN INIT', this.root);
    }
}
