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
import { CompositeTreeNode, createTreeContainer, SelectableTreeNode, Tree, TreeImpl, TreeModel, TreeModelImpl, TreeWidget } from '@theia/core/lib/browser';
import { TerminalWidgetImpl } from './terminal-widget-impl';

export interface TerminalManagerTreeNode extends SelectableTreeNode {
    widget: TerminalWidgetImpl;
};

@injectable()
export class TerminalManagerTreeWidget extends TreeWidget {
    static ID = 'terminal-manager-tree-widget';

    static createContainer(parent: interfaces.Container): Container {
        const child = createTreeContainer(parent);
        child.bind(TerminalManagerTreeWidget).toSelf().inSingletonScope();
        child.bind(TerminalManagerTreeModel).toSelf().inSingletonScope();
        child.bind(TerminalManagerTree).toSelf().inSingletonScope();
        child.rebind(TreeModelImpl).to(TerminalManagerTreeModel);
        child.rebind(TreeImpl).to(TerminalManagerTree);
        return child;
    }

    @inject(TreeModel) override readonly model: TerminalManagerTreeModel;

    static createWidget(parent: interfaces.Container): TerminalManagerTreeWidget {
        return TerminalManagerTreeWidget.createContainer(parent).get(TerminalManagerTreeWidget);
    }

    addWidget(widget: TerminalWidgetImpl): void {
        this.model.addWidget(widget);
    }
}

@injectable()
export class TerminalManagerTreeModel extends TreeModelImpl {
    @inject(Tree) protected override readonly tree: TerminalManagerTree;

    addWidget(widget: TerminalWidgetImpl): void {
        this.tree.addWidget(widget);
    }
}

@injectable()
export class TerminalManagerTree extends TreeImpl {
    @postConstruct()
    protected init(): void {
        const dummyRoot: CompositeTreeNode = { id: 'root', parent: undefined, children: [] };
        this.root = dummyRoot;
        CompositeTreeNode.addChild(this.root as CompositeTreeNode, { id: 'child1', parent: undefined });
    }

    addWidget(widget: TerminalWidgetImpl): void {
        const widgetNode: TerminalManagerTreeNode = {
            id: widget.id,
            parent: undefined,
            widget,
        };
    }
}

