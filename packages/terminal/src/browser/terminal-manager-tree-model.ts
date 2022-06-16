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

import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { TreeModelImpl, CompositeTreeNode, SelectableTreeNode } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';
import { Emitter } from '@theia/core';

export namespace TerminalManagerTreeTypes {
    export interface TerminalNode extends SelectableTreeNode, CompositeTreeNode {
        terminal: true;
        widget: TerminalWidget;
        isEditing: boolean;
        label: string;
    };
    export interface PageNode extends SelectableTreeNode, CompositeTreeNode {
        page: true;
        children: TerminalNode[];
        isEditing: boolean;
        label: string;
    }

    export type TreeNode = PageNode | TerminalNode;
    export const isPageNode = (obj: unknown): obj is PageNode => !!obj && typeof obj === 'object' && 'page' in obj;
    export const isTerminalNode = (obj: unknown): obj is TerminalNode => !!obj && typeof obj === 'object' && 'terminal' in obj;
    export const isTerminalOrPageNode = (obj: unknown): obj is (PageNode | TerminalNode) => isPageNode(obj) || isTerminalNode(obj);
    export interface SelectionChangedEvent {
        activePage: PageNode;
        activeTerminal: TerminalNode;
    }

    export const TerminalContextMenuID = 'terminal-manager-tree';
    export type ContextMenuArgs = [typeof TerminalContextMenuID, TreeNode];
    export const toContextMenuArgs = (node: TreeNode): ContextMenuArgs => ([TerminalContextMenuID, node]);
}
@injectable()
export class TerminalManagerTreeModel extends TreeModelImpl {

    activePage: TerminalManagerTreeTypes.PageNode;
    activeTerminal: TerminalManagerTreeTypes.TerminalNode;

    protected pageNum = 0;

    protected onTreeSelectionChangedEmitter = new Emitter<TerminalManagerTreeTypes.SelectionChangedEvent>();
    readonly onTreeSelectionChanged = this.onTreeSelectionChangedEmitter.event;

    protected onPageAddedEmitter = new Emitter<TerminalManagerTreeTypes.PageNode>();
    readonly onPageAdded = this.onPageAddedEmitter.event;
    protected onPageRemovedEmitter = new Emitter<TerminalManagerTreeTypes.PageNode>();
    readonly onPageRemoved = this.onPageRemovedEmitter.event;

    protected onTerminalAddedEmitter = new Emitter<TerminalManagerTreeTypes.TerminalNode>();
    readonly onTerminalAdded = this.onTerminalAddedEmitter.event;
    protected onTerminalRemovedEmitter = new Emitter<TerminalManagerTreeTypes.TerminalNode>();
    readonly onTerminalRemoved = this.onTerminalRemovedEmitter.event;

    @postConstruct()
    protected override init(): void {
        super.init();
        this.toDispose.push(this.selectionService.onSelectionChanged(selectionEvent => {
            const selectedNode = selectionEvent.find(node => node.selected);
            if (selectedNode) {
                this.handleSelectionChanged(selectedNode);
            }
        }));
        this.root = { id: 'root', parent: undefined, children: [], visible: false } as CompositeTreeNode;
    }

    handleSelectionChanged(selectedNode: SelectableTreeNode): void {
        if (TerminalManagerTreeTypes.isPageNode(selectedNode)) {
            if (selectedNode === this.activePage) {
                return;
            }
            this.activePage = selectedNode;
        } else if (TerminalManagerTreeTypes.isTerminalNode(selectedNode)) {
            const activePage = selectedNode.parent;
            if (activePage === this.activePage) {
                return;
            }
            if (TerminalManagerTreeTypes.isPageNode(activePage) && TerminalManagerTreeTypes.isTerminalNode(selectedNode)) {
                this.activePage = activePage;
                this.activeTerminal = selectedNode;
            }
        }
        this.onTreeSelectionChangedEmitter.fire({ activePage: this.activePage, activeTerminal: this.activeTerminal });
    }

    addWidget(widget: TerminalWidget): void {
        const widgetNode = this.createWidgetNode(widget);
        if (this.root && CompositeTreeNode.is(this.root)) {
            this.activeTerminal = widgetNode;
            this.onTreeSelectionChangedEmitter.fire({ activePage: this.activePage, activeTerminal: this.activeTerminal });
            setTimeout(() => {
                this.selectionService.addSelection(this.activeTerminal);
            });
            CompositeTreeNode.addChild(this.activePage, widgetNode);
            this.onTerminalAddedEmitter.fire(widgetNode);
            this.refresh();
        }
    }

    addPage(): TerminalManagerTreeTypes.PageNode | undefined {
        const pageNode = this.createPageNode();
        if (this.root && CompositeTreeNode.is(this.root)) {
            this.activePage = pageNode;
            this.root = CompositeTreeNode.addChild(this.root, pageNode);
            this.onPageAddedEmitter.fire(pageNode);
            return pageNode;
        }
    }

    protected createPageNode(): TerminalManagerTreeTypes.PageNode {
        // TODO this will reset
        const defaultPageName = `page-${this.pageNum++}`;
        return {
            id: defaultPageName,
            label: defaultPageName,
            parent: undefined,
            selected: false,
            children: [],
            page: true,
            isEditing: false,
        };
    }

    protected createWidgetNode(widget: TerminalWidget): TerminalManagerTreeTypes.TerminalNode {
        return {
            id: `${widget.id}`,
            label: `${widget.id}`,
            parent: undefined,
            children: [],
            widget,
            selected: false,
            terminal: true,
            isEditing: false,
        };
    }

    deleteTerminal(node: TerminalManagerTreeTypes.TerminalNode): void {
        if (TerminalManagerTreeTypes.isTerminalNode(node) && TerminalManagerTreeTypes.isPageNode(node.parent)) {
            CompositeTreeNode.removeChild(node.parent, node);
            this.onTerminalRemovedEmitter.fire(node);
            this.refresh();
        }
    }

    deletePage(pageNode: TerminalManagerTreeTypes.PageNode): void {
        if (TerminalManagerTreeTypes.isPageNode(pageNode)) {
            while (pageNode.children.length > 0) {
                this.deleteTerminal(pageNode.children[0]);
            }
            if (this.root && CompositeTreeNode.is(this.root)) {
                CompositeTreeNode.removeChild(this.root, pageNode);
                this.onPageRemovedEmitter.fire(pageNode);
                this.refresh();
            }
        }
    }

    splitTerminalHorizontally(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        if (TerminalManagerTreeTypes.isTerminalNode(terminalNode)) {
            // const
        }
    }

    toggleRenameTerminal(node: TerminalManagerTreeTypes.TreeNode): void {
        if (TerminalManagerTreeTypes.isTerminalOrPageNode(node)) {
            node.isEditing = true;
            this.root = this.root;
        }
    }

    acceptRename(nodeId: string, newName: string): void {
        const node = this.getNode(nodeId);
        if (TerminalManagerTreeTypes.isTerminalOrPageNode(node)) {
            node.label = newName.trim();
            node.isEditing = false;
            this.root = this.root;
        }
    }
}
