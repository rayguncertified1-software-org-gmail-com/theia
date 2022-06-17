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
import { TreeModelImpl, CompositeTreeNode, SelectableTreeNode, SplitPanel } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';
import { Emitter } from '@theia/core';
import { TerminalManager, TerminalManagerTreeTypes } from './terminal-manager-types';

@injectable()
export class TerminalManagerTreeModel extends TreeModelImpl {

    activePage: TerminalManagerTreeTypes.PageNode;
    activeTerminal: TerminalManagerTreeTypes.TerminalNode;

    protected pageNum = 0;
    protected groupNum = 0;

    protected onTreeSelectionChangedEmitter = new Emitter<TerminalManagerTreeTypes.SelectionChangedEvent>();
    readonly onTreeSelectionChanged = this.onTreeSelectionChangedEmitter.event;

    protected onPageAddedEmitter = new Emitter<TerminalManagerTreeTypes.PageNode>();
    readonly onPageAdded = this.onPageAddedEmitter.event;
    protected onPageRemovedEmitter = new Emitter<TerminalManagerTreeTypes.PageNode>();
    readonly onPageRemoved = this.onPageRemovedEmitter.event;

    protected onTerminalColumnAddedEmitter = new Emitter<TerminalManagerTreeTypes.TerminalNode>();
    readonly onTerminalColumnAdded = this.onTerminalColumnAddedEmitter.event;
    protected onTerminalRemovedEmitter = new Emitter<TerminalManagerTreeTypes.TerminalNode>();
    readonly onTerminalRemoved = this.onTerminalRemovedEmitter.event;
    protected onTerminalSplitEmitter = new Emitter<{ groupNode: TerminalManagerTreeTypes.TerminalGroupNode, terminalWidget: TerminalWidget }>();
    readonly onTerminalSplit = this.onTerminalSplitEmitter.event;

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

    addWidget(widget: SplitPanel | TerminalWidget, parent?: TerminalManagerTreeTypes.PageNode | TerminalManagerTreeTypes.TerminalGroupNode): void {
        const widgetNode = this.createWidgetNode(widget);
        this.activeTerminal = widgetNode;
        this.onTreeSelectionChangedEmitter.fire({ activePage: this.activePage, activeTerminal: this.activeTerminal });
        setTimeout(() => {
            this.selectionService.addSelection(this.activeTerminal);
        });
        CompositeTreeNode.addChild(parent ?? this.activePage, widgetNode);
        if (widget instanceof SplitPanel) {
            this.onTerminalColumnAddedEmitter.fire(widgetNode);
        }
        this.refresh();
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
            panel: undefined,
        };
    }

    protected createGroupNode(widget: SplitPanel): TerminalManagerTreeTypes.TerminalGroupNode {
        const defaultGroupName = `group-${this.groupNum++}`;
        return {
            id: defaultGroupName,
            label: defaultGroupName,
            parent: undefined,
            selected: false,
            widget,
            children: [],
            terminalGroup: true,
            isEditing: false,
        };
    }

    protected createWidgetNode(widget: SplitPanel | TerminalWidget): TerminalManagerTreeTypes.TerminalNode {
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

    deleteTerminalNode(node: TerminalManagerTreeTypes.TerminalNode): void {
        if (TerminalManagerTreeTypes.isTerminalNode(node) && TerminalManagerTreeTypes.isPageNode(node.parent)) {
            CompositeTreeNode.removeChild(node.parent, node);
            this.onTerminalRemovedEmitter.fire(node);
            this.refresh();
        }
    }

    deletePageNode(pageNode: TerminalManagerTreeTypes.PageNode): void {
        if (TerminalManagerTreeTypes.isPageNode(pageNode)) {
            while (pageNode.children.length > 0) {
                const child = pageNode.children[0];
                if (TerminalManagerTreeTypes.isTerminalNode(child)) {
                    this.deleteTerminalNode(child);
                } else if (TerminalManagerTreeTypes.isTerminalGroupNode(child)) {
                    this.deleteTerminalGroupNode(child);
                }
            }
            if (this.root && CompositeTreeNode.is(this.root)) {
                CompositeTreeNode.removeChild(this.root, pageNode);
                this.onPageRemovedEmitter.fire(pageNode);
                this.refresh();
                setTimeout(() => {
                    if (CompositeTreeNode.is(this.root) && SelectableTreeNode.is(this.root?.children[0])) {
                        this.selectionService.addSelection(this.root.children[0]);
                    }
                });
            }
        }
    }

    deleteTerminalGroupNode(groupNode: TerminalManagerTreeTypes.TerminalGroupNode): void {
        // TODO
    }

    splitTerminalHorizontally(terminalWidget: TerminalWidget, parentId: TerminalManager.TerminalID): void {
        const parentTerminalColumn = this.getNode(parentId);
        if (TerminalManagerTreeTypes.isTerminalNode(parentTerminalColumn)) {
            const pageOrGroup = parentTerminalColumn.parent;
            if (TerminalManagerTreeTypes.isPageNode(pageOrGroup) && parentTerminalColumn.widget instanceof SplitPanel) {
                CompositeTreeNode.removeChild(pageOrGroup, parentTerminalColumn);
                const newGroupNode = this.createGroupNode(parentTerminalColumn.widget);
                CompositeTreeNode.addChild(pageOrGroup, newGroupNode);
                CompositeTreeNode.addChild(newGroupNode, parentTerminalColumn);
                this.addWidget(terminalWidget, newGroupNode);
                this.onTerminalSplitEmitter.fire({ groupNode: newGroupNode, terminalWidget });
            } else if (TerminalManagerTreeTypes.isTerminalGroupNode(pageOrGroup)) {
                this.addWidget(terminalWidget, pageOrGroup);
                this.onTerminalSplitEmitter.fire({ groupNode: pageOrGroup, terminalWidget });
            }
            this.refresh();
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
