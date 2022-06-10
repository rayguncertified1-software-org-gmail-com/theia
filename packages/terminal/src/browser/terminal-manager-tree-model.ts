// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { TreeModelImpl, Tree } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';
import { TerminalManagerTree, TerminalManagerTreeTypes } from './terminal-manager-tree';
import { Emitter } from '@theia/core';

@injectable()
export class TerminalManagerTreeModel extends TreeModelImpl {
    @inject(Tree) protected override readonly tree: TerminalManagerTree;

    protected onTreeSelectionChangedEmitter = new Emitter<TerminalManagerTreeTypes.SelectionChangedEvent>();
    readonly onTreeSelectionChanged = this.onTreeSelectionChangedEmitter.event;

    @postConstruct()
    protected override init(): void {
        super.init();
        this.toDispose.push(this.selectionService.onSelectionChanged(selectionEvent => {
            const selectedNode = selectionEvent.find(node => node.selected);
            if (selectedNode) {
                this.tree.handleSelectionChanged(selectedNode);
            }
        }));
        this.toDispose.push(this.tree.onTreeSelectionChanged(changeEvent => this.onTreeSelectionChangedEmitter.fire(changeEvent)));
    }

    addWidget(widget: TerminalWidget, _activePage: TerminalManagerTreeTypes.PageNode): void {
        this.tree.addWidget(widget, _activePage);
    }

    addPage(): void {
        this.tree.addPage();
    }
}
