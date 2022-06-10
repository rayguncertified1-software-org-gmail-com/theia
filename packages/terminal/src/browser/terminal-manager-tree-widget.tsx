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
import { createTreeContainer, Message, TreeModel, TreeWidget } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';
import { TerminalManagerTreeModel, TerminalManagerTreeTypes } from './terminal-manager-tree-model';
import { Emitter } from '@theia/core';

@injectable()
export class TerminalManagerTreeWidget extends TreeWidget {
    static ID = 'terminal-manager-tree-widget';

    static createContainer(parent: interfaces.Container): Container {
        const child = createTreeContainer(parent);
        child.bind(TerminalManagerTreeModel).toSelf().inSingletonScope();
        child.rebind(TreeModel).to(TerminalManagerTreeModel);
        child.bind(TerminalManagerTreeWidget).toSelf().inSingletonScope();
        return child;
    }

    static createWidget(parent: interfaces.Container): TerminalManagerTreeWidget {
        return TerminalManagerTreeWidget.createContainer(parent).get(TerminalManagerTreeWidget);
    }
    protected onDidChangeEmitter = new Emitter();
    readonly onDidChange = this.onDidChangeEmitter.event;
    protected onTreeSelectionChangedEmitter = new Emitter<TerminalManagerTreeTypes.SelectionChangedEvent>();
    readonly onTreeSelectionChanged = this.onTreeSelectionChangedEmitter.event;

    @inject(TreeModel) override readonly model: TerminalManagerTreeModel;

    @postConstruct()
    protected override init(): void {
        super.init();
        this.toDispose.push(this.onDidChangeEmitter);
        this.toDispose.push(this.model.onTreeSelectionChanged(e => this.onTreeSelectionChangedEmitter.fire(e)));
    }

    addWidget(widget: TerminalWidget, activePage: TerminalManagerTreeTypes.PageNode): void {
        this.model.addWidget(widget, activePage);
    }

    addPage(): void {
        this.model.addPage();
    }

    protected override toNodeName(node: TerminalManagerTreeTypes.TerminalNode): string {
        return node.id ?? 'root';
    }

    protected override onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.onDidChangeEmitter.fire(undefined);
    }
}

