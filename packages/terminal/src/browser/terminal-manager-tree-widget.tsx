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

import { Container, inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
import { createTreeContainer, Message, Tree, TreeModel, TreeWidget } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';
import { TerminalManagerTree, TerminalManagerTreeTypes } from './terminal-manager-tree';
import { TerminalManagerTreeModel } from './terminal-manager-tree-model';
import { Emitter } from '@theia/core';

@injectable()
export class TerminalManagerTreeWidget extends TreeWidget {
    static ID = 'terminal-manager-tree-widget';

    static createContainer(parent: interfaces.Container): Container {
        const child = createTreeContainer(parent);
        child.bind(TerminalManagerTree).toSelf().inSingletonScope();
        child.rebind(Tree).to(TerminalManagerTree);
        child.bind(TerminalManagerTreeModel).toSelf().inSingletonScope();
        child.rebind(TreeModel).to(TerminalManagerTreeModel);
        child.bind(TerminalManagerTreeWidget).toSelf().inSingletonScope();
        return child;
    }

    protected onDidChangeEmitter = new Emitter();
    readonly onDidChange = this.onDidChangeEmitter.event;

    @inject(TreeModel) override readonly model: TerminalManagerTreeModel;

    @postConstruct()
    protected override init(): void {
        super.init();
        this.toDispose.push(this.onDidChangeEmitter);
    }

    static createWidget(parent: interfaces.Container): TerminalManagerTreeWidget {
        return TerminalManagerTreeWidget.createContainer(parent).get(TerminalManagerTreeWidget);
    }

    addWidget(widget: TerminalWidget, page: number): void {
        this.model.addWidget(widget, page);
    }

    addPage(): void {
        this.model.addPage();
    }

    protected override toNodeName(node: TerminalManagerTreeTypes.TerminalTreeNode): string {
        console.log('SENTINEL TREE NODE', node);
        return node.id ?? 'root';
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.onDidChangeEmitter.fire(undefined);
    }
}

