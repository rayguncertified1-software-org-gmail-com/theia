// *****************************************************************************
// Copyright (C) 2022 YourCompany and others.
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

import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { TreeImpl, CompositeTreeNode, SelectableTreeNode } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';

export namespace TerminalManagerTreeTypes {
    export interface TerminalTreeNode extends SelectableTreeNode, CompositeTreeNode {
        widget: TerminalWidget;
    };
    export interface PageNode extends SelectableTreeNode, CompositeTreeNode {
        children: TerminalTreeNode[];
    }
    export const isPageNode = (obj: unknown): obj is PageNode => !!obj && typeof obj === 'object' && 'page' in obj;
}
@injectable()
export class TerminalManagerTree extends TreeImpl {
    protected pages: Set<TerminalManagerTreeTypes.PageNode> = new Set();
    protected activePage: TerminalManagerTreeTypes.PageNode;
    protected pageNum = 0;

    @postConstruct()
    protected init(): void {
        this.root = { id: 'root', parent: undefined, children: [], visible: false } as CompositeTreeNode;
    }

    addWidget(widget: TerminalWidget, page: number): void {
        const widgetNode = this.createWidgetNode(widget);
        if (this.root && CompositeTreeNode.is(this.root)) {
            CompositeTreeNode.addChild(this.activePage, widgetNode);
            this.refresh();
        }
    }

    protected createPageNode(): TerminalManagerTreeTypes.PageNode {
        return {
            id: `page ${this.pageNum++}`,
            parent: undefined,
            selected: false,
            children: [],
        };
    }

    protected createWidgetNode(widget: TerminalWidget): TerminalManagerTreeTypes.TerminalTreeNode {
        return {
            id: `${widget.id}`,
            parent: undefined,
            children: [],
            widget,
            selected: false,
        };
    }

    addPage(): void {
        const pageNode = this.createPageNode();
        if (this.root && CompositeTreeNode.is(this.root)) {
            this.root = CompositeTreeNode.addChild(this.root, pageNode);
            this.activePage = pageNode;
        }
    }
}
